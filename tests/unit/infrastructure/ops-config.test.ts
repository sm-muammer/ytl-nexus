// @vitest-environment node
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OPS_UNITS } from "@/lib/ops/units";
import { SERVICE_PROBES } from "@/lib/status/checks";

// The polkit rule is the last gate (OPS-05). These tests run the real rule file
// against a fake polkit object, so a typo in the allowlist or a loosened
// condition fails here before it reaches the server.

const INFRA = path.resolve(import.meta.dirname, "../../../infrastructure");
const read = (rel: string) => readFileSync(path.join(INFRA, rel), "utf8");

type Subject = { user: string };
type Action = { id: string; lookup(name: string): string | undefined };
const Result = {
  YES: "yes",
  NO: "no",
  NOT_HANDLED: "not-handled",
} as const;

function loadRule() {
  let rule: ((action: Action, subject: Subject) => string) | undefined;
  const polkit = {
    Result,
    addRule(fn: typeof rule) {
      rule = fn;
    },
  };
  new Function("polkit", read("polkit/50-nexus-ops.rules"))(polkit);
  if (!rule) throw new Error("the rule file registered no rule");
  return rule;
}

const manage = (verb: string, unit: string): Action => ({
  id: "org.freedesktop.systemd1.manage-units",
  lookup: (name) => ({ verb, unit })[name],
});

describe("polkit rule", () => {
  const rule = loadRule();
  const agent = { user: "nexus-ops" };

  it.each(OPS_UNITS)("lets nexus-ops restart %s.service", (unit) => {
    expect(rule(manage("restart", `${unit}.service`), agent)).toBe(Result.YES);
  });

  it.each([
    "sshd.service",
    "mariadb.service",
    "httpd.service",
    "firewalld.service",
    "nexus-ops.service",
    "polkit.service",
    "nexus-web",
    "nexus-web.service ",
    "nexus-web@1.service",
    "nexus-web.socket",
    "../nexus-web.service",
    "",
  ])("denies a restart of %j", (unit) => {
    expect(rule(manage("restart", unit), agent)).toBe(Result.NO);
  });

  it.each(["start", "stop", "reload", "try-restart", "kill", "reset-failed"])(
    "denies the verb %s on an allowed unit",
    (verb) => {
      expect(rule(manage(verb, "nexus-web.service"), agent)).toBe(Result.NO);
    },
  );

  it.each([
    "org.freedesktop.systemd1.manage-unit-files",
    "org.freedesktop.systemd1.reload-daemon",
    "org.freedesktop.systemd1.set-environment",
    "org.freedesktop.login1.power-off",
    "org.freedesktop.hostname1.set-hostname",
  ])("denies the action %s", (id) => {
    const action: Action = { id, lookup: () => "restart" };
    expect(rule(action, agent)).toBe(Result.NO);
  });

  it("does not decide for any other user", () => {
    for (const user of ["root", "nexus", "apache", "nexus-ops2", "Nexus-Ops"]) {
      expect(rule(manage("restart", "nexus-web.service"), { user })).toBe(
        Result.NOT_HANDLED,
      );
    }
  });

  it("lists exactly the units in lib/ops/units.ts", () => {
    const src = read("polkit/50-nexus-ops.rules");
    const listed = [...src.matchAll(/"([a-z0-9-]+)\.service"/g)].map(
      (m) => m[1],
    );
    expect(listed.sort()).toEqual([...OPS_UNITS].sort());
  });
});

describe("nexus-ops.service", () => {
  const unit = read("systemd/nexus-ops.service");

  it("runs unprivileged, in the clients group, with a private socket directory", () => {
    expect(unit).toMatch(/^User=nexus-ops$/m);
    expect(unit).toMatch(/^Group=nexus-ops-clients$/m);
    expect(unit).toMatch(/^RuntimeDirectory=nexus-ops$/m);
    expect(unit).toMatch(/^RuntimeDirectoryMode=0750$/m);
    expect(unit).toMatch(/^UMask=0007$/m);
  });

  it("is sandboxed, writes nothing and reaches only loopback", () => {
    for (const line of [
      "NoNewPrivileges=yes",
      "ProtectSystem=strict",
      "ProtectHome=yes",
      "PrivateTmp=yes",
      "PrivateDevices=yes",
      "CapabilityBoundingSet=",
      "IPAddressDeny=any",
      "IPAddressAllow=localhost",
    ]) {
      expect(unit, line).toMatch(new RegExp(`^${line}$`, "m"));
    }
    expect(unit).not.toMatch(/^ReadWritePaths=/m);
    expect(unit).not.toMatch(/^User=root/m);
  });

  it("gains no group beyond the journal", () => {
    expect(unit).toMatch(/^SupplementaryGroups=systemd-journal$/m);
  });

  it("takes its secret from a root-read file, not from the environment line", () => {
    expect(unit).toMatch(/^EnvironmentFile=\/etc\/ytl-nexus\/ops\.env$/m);
    expect(unit).not.toMatch(/NEXUS_OPS_SECRET=/);
  });
});

describe("nexus-worker.service and nexus-web.service", () => {
  it("run the worker as nexus with database settings only, on loopback", () => {
    const unit = read("systemd/nexus-worker.service");
    expect(unit).toMatch(/^User=nexus$/m);
    expect(unit).toMatch(/^EnvironmentFile=\/etc\/ytl-nexus\/app-db\.env$/m);
    expect(unit).toMatch(/^IPAddressAllow=localhost$/m);
    expect(unit).toMatch(/^NoNewPrivileges=yes$/m);
  });

  it("gives nexus-web the operations secret without failing before setup-ops", () => {
    expect(read("systemd/nexus-web.service")).toMatch(
      /^EnvironmentFile=-\/etc\/ytl-nexus\/ops\.env$/m,
    );
  });
});

describe("setup-ops", () => {
  const script = read("scripts/setup-ops");

  it("verifies the target first and never prints the secret", () => {
    expect(script.indexOf("verify-target")).toBeGreaterThan(-1);
    expect(script.indexOf("verify-target")).toBeLessThan(
      script.indexOf("groupadd"),
    );
    expect(script).not.toMatch(/echo[^\n]*\$\(.*NEXUS_OPS_SECRET/);
    expect(script).toMatch(/chmod 0600 "\$ENV_DIR\/ops\.env"/);
  });

  it("keeps the nexus user as the only member of the clients group", () => {
    expect(script).toContain("nexus-ops-clients");
    expect(script).toMatch(/gpasswd --delete/);
  });
});

describe("worker checks", () => {
  it("probe loopback only", () => {
    for (const target of Object.values(SERVICE_PROBES)) {
      const host =
        target.kind === "tcp" ? target.host : new URL(target.url).hostname;
      expect(host).toBe("127.0.0.1");
    }
  });
});
