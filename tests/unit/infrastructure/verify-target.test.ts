// @vitest-environment node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const script = path.resolve(
  import.meta.dirname,
  "../../../infrastructure/scripts/verify-target",
);

const GOOD_HOST = "sn1lyvx1d0002.ytlcomms.my";
const GOOD_IPS = "10.26.64.164 10.88.0.1";
// The recorded machine ID lives only on the server; the script stores its hash.
const GOOD_MACHINE_ID = "eff4e26087e2429a832150e5a4d1a161";

function run(host: string, ips: string, machineId: string) {
  const facts = `printf '%s\\n%s\\n%s\\n' '${host}' '${ips}' '${machineId}'`;
  return spawnSync("bash", [script], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "test",
      NEXUS_TARGET_FACTS_CMD: facts,
    },
    encoding: "utf8",
  });
}

describe("verify-target (gate 1, requirements 4.1 and 4.2)", () => {
  it("passes when hostname, IP and machine ID all match", () => {
    const result = run(GOOD_HOST, GOOD_IPS, GOOD_MACHINE_ID);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Target verified");
  });

  it("fails when the hostname differs", () => {
    const result = run("other.ytlcomms.my", GOOD_IPS, GOOD_MACHINE_ID);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("hostname");
  });

  it("fails when the IP address is not on the host", () => {
    const result = run(GOOD_HOST, "10.26.64.99", GOOD_MACHINE_ID);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("IP");
  });

  it("does not accept an IP that only contains the expected one as a prefix", () => {
    const result = run(GOOD_HOST, "10.26.64.1640", GOOD_MACHINE_ID);
    expect(result.status).not.toBe(0);
  });

  it("fails when the machine ID differs, without printing either ID", () => {
    const wrong = "0".repeat(32);
    const result = run(GOOD_HOST, GOOD_IPS, wrong);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("machine ID");
    expect(result.stderr).not.toContain(wrong);
    expect(result.stderr).not.toContain(GOOD_MACHINE_ID);
  });

  it("fails when the facts cannot be read", () => {
    const result = spawnSync("bash", [script], {
      env: {
        PATH: process.env.PATH,
        NODE_ENV: "test",
        NEXUS_TARGET_FACTS_CMD: "exit 3",
      },
      encoding: "utf8",
    });
    expect(result.status).not.toBe(0);
  });
});
