import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Nexus Shield scanner script & systemd units", () => {
  const root = process.cwd();
  const scriptPath = path.join(
    root,
    "infrastructure/scripts/nexus-shield-scan",
  );
  const servicePath = path.join(
    root,
    "infrastructure/systemd/nexus-shield-scan.service",
  );
  const timerPath = path.join(
    root,
    "infrastructure/systemd/nexus-shield-scan.timer",
  );

  it("has executable scanner script with required check commands", () => {
    expect(fs.existsSync(scriptPath)).toBe(true);
    const content = fs.readFileSync(scriptPath, "utf-8");

    // Must cover all check inspections
    expect(content).toContain("openssl x509"); // SHD-01
    expect(content).toContain("ss -tulpn"); // SHD-02
    expect(content).toContain("firewall-cmd"); // SHD-03
    expect(content).toContain("dnf check-update --security"); // SHD-04
    expect(content).toContain("journalctl -u sshd"); // SHD-05
    expect(content).toContain("sshd -T"); // SHD-06
    expect(content).toContain("getenforce"); // SHD-07
    expect(content).toContain("df -hP"); // SHD-08
    expect(content).toContain("chronyc tracking"); // SHD-09
    expect(content).toContain("/var/backups/nexus"); // SHD-10
    expect(content).toContain("fail2ban"); // SHD-11

    // Must output report to /var/log/nexus/shield-scan.json
    expect(content).toContain("/var/log/nexus/shield-scan.json");
    expect(content).toContain("shield_findings");
  });

  it("has valid systemd service unit", () => {
    expect(fs.existsSync(servicePath)).toBe(true);
    const content = fs.readFileSync(servicePath, "utf-8");
    expect(content).toContain(
      "ExecStart=/opt/ytl-nexus/current/infrastructure/scripts/nexus-shield-scan",
    );
    expect(content).toContain("User=root");
  });

  it("has valid systemd timer unit", () => {
    expect(fs.existsSync(timerPath)).toBe(true);
    const content = fs.readFileSync(timerPath, "utf-8");
    expect(content).toContain("OnCalendar=");
    expect(content).toContain("Persistent=true");
  });
});
