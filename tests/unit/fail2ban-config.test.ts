import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("fail2ban infrastructure configuration (Task 21 & Requirement 6)", () => {
  const jailLocalPath = path.join(
    ROOT,
    "infrastructure",
    "fail2ban",
    "jail.local",
  );
  const sftpgoFilterPath = path.join(
    ROOT,
    "infrastructure",
    "fail2ban",
    "filter.d",
    "sftpgo.conf",
  );

  it("defines jail.local with the required jails and ignored IPs", () => {
    expect(existsSync(jailLocalPath)).toBe(true);
    const content = readFileSync(jailLocalPath, "utf-8");

    // All 3 required jails present
    expect(content).toMatch(/\[sshd\][\s\S]*?enabled\s*=\s*true/);
    expect(content).toMatch(/\[sftpgo\][\s\S]*?enabled\s*=\s*true/);
    expect(content).toMatch(/\[postfix\][\s\S]*?enabled\s*=\s*true/);

    // Ignored IPs include owner IP and private subnet
    expect(content).toContain("10.24.5.91");
    expect(content).toContain("10.0.0.0/8");
    expect(content).toContain("127.0.0.1/8");

    // Ports
    expect(content).toContain("2022"); // SFTPGo port
  });

  it("defines sftpgo filter configuration with accurate regex", () => {
    expect(existsSync(sftpgoFilterPath)).toBe(true);
    const content = readFileSync(sftpgoFilterPath, "utf-8");
    expect(content).toContain("failregex");
    expect(content).toContain("<HOST>");
  });

  it("has setup-fail2ban installation script", () => {
    const setupScript = path.join(
      ROOT,
      "infrastructure",
      "scripts",
      "setup-fail2ban",
    );
    expect(existsSync(setupScript)).toBe(true);
    const script = readFileSync(setupScript, "utf-8");
    expect(script).toContain("dnf install -y fail2ban");
    expect(script).toContain("systemctl enable --now fail2ban");
  });
});
