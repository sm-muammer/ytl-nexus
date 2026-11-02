import { spawnSync } from "node:child_process";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { totpCode } from "../helpers/totp";
import {
  Jar,
  auditRows,
  createHarness,
  enrolTotp,
  signIn,
  signInWithTotp,
  type Harness,
} from "./helpers/auth-harness";

// The first-admin script, run as the real process an operator would run on the
// server: node with native TypeScript, environment from the settings files.

const ROOT = path.resolve(import.meta.dirname, "../..");

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});

function run(args: string[], input?: string) {
  const db = h.scratch.config("app");
  return spawnSync(
    process.execPath,
    [
      "--disable-warning=MODULE_TYPELESS_PACKAGE_JSON",
      "scripts/auth/create-user.ts",
      ...args,
    ],
    {
      cwd: ROOT,
      input,
      encoding: "utf8",
      env: {
        NODE_ENV: "test",
        PATH: process.env.PATH,
        NEXUS_DB_HOST: db.host,
        NEXUS_DB_PORT: String(db.port),
        NEXUS_DB_NAME: db.database,
        NEXUS_DB_USER: db.user,
        NEXUS_DB_PASSWORD: db.password,
        BETTER_AUTH_SECRET: "s".repeat(48),
        BETTER_AUTH_URL: "https://nexus.test",
      },
    },
  );
}

describe("first-admin script (requirement 6.14)", () => {
  it("creates an Administrator with a generated password that works, and audits it", () => {
    const result = run(["--email", "Logesh@Example.com", "--name", "Logesh"]);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toMatch(
      /Created admin account for logesh@example\.com/,
    );
    const password = /Password \(shown once[^)]*\): (\S+)/.exec(
      result.stdout,
    )?.[1];
    expect(password?.length).toBeGreaterThanOrEqual(24);
    // Stored in lower case, signs in, and is told to set up two-factor.
    return (async () => {
      const jar = new Jar("10.20.0.1");
      const r = await signIn(h, jar, "logesh@example.com", password as string);
      expect(r.kind).toBe("session");
      const rows = (await auditRows(h, "admin.create-user")).filter((x) =>
        x.target.startsWith("logesh@example.com"),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ result: "success", role: null });
      expect(rows[0]?.actor_id).toMatch(/^cli:/);
      expect(JSON.stringify(rows)).not.toContain(password as string);
    })();
  });

  it("takes a password from standard input and creates other roles", async () => {
    const result = run(
      [
        "--email",
        "azlin@example.com",
        "--name",
        "Azlin",
        "--role",
        "operator",
        "--password-stdin",
      ],
      "a long passphrase from stdin\n",
    );
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).not.toMatch(/Password \(shown once/);
    const r = await signIn(
      h,
      new Jar("10.20.0.2"),
      "azlin@example.com",
      "a long passphrase from stdin",
    );
    expect(r.kind).toBe("session");
  });

  it("refuses a duplicate email and a weak password, and creates nothing", async () => {
    const dup = run(["--email", "azlin@example.com", "--name", "Again"]);
    expect(dup.status).toBe(1);
    expect(dup.stderr).toMatch(/already exists/);
    const weak = run(
      ["--email", "weak@example.com", "--name", "Weak", "--password-stdin"],
      "short\n",
    );
    expect(weak.status).toBe(1);
    const none = await h.scratch.app
      .selectFrom("user")
      .select("id")
      .where("email", "=", "weak@example.com")
      .execute();
    expect(none).toHaveLength(0);
    const failures = (await auditRows(h, "admin.create-user")).filter(
      (x) => x.result === "failure",
    );
    expect(failures.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects a bad role or a missing name before it connects", () => {
    const bad = run([
      "--email",
      "x@example.com",
      "--name",
      "X",
      "--role",
      "root",
    ]);
    expect(bad.status).toBe(1);
    expect(bad.stderr).toMatch(/role/);
    const missing = run(["--email", "x@example.com"]);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toMatch(/name/);
  });

  it("makes an Administrator who can enrol two-factor and sign in with it", async () => {
    const result = run(
      ["--email", "sonu@example.com", "--name", "Sonu", "--password-stdin"],
      "another long passphrase here\n",
    );
    expect(result.status, result.stderr).toBe(0);
    const user = {
      email: "sonu@example.com",
      password: "another long passphrase here",
    };
    const secret = await enrolTotp(h, user);
    const headers = await signInWithTotp(h, user, secret);
    expect(headers.get("cookie")).toContain("session_token");
    expect(totpCode(secret)).toMatch(/^\d{6}$/);
  });
});
