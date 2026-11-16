import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

const SCRIPTS_DIR = path.resolve(__dirname, "../../infrastructure/scripts");

describe("nexus-backup script structure", () => {
  it("defines the five databases and required directories", () => {
    const content = fs.readFileSync(
      path.join(SCRIPTS_DIR, "nexus-backup"),
      "utf8",
    );
    expect(content).toContain("ytl_nexus");
    expect(content).toContain("nexus_mail");
    expect(content).toContain("nexus_roundcube");
    expect(content).toContain("nexus_sftpgo");
    expect(content).toContain("nexus_wordpress");
    expect(content).toContain("/etc/ytl-nexus");
    expect(content).toContain("/var/mail/vmail");
    expect(content).toContain("/srv/nexus-transfer");
    expect(content).toContain("/var/backups/nexus");
    expect(content).toContain("backup_runs");
    expect(content).toContain("SHA256SUMS");
  });
});

describe("nexus-restore-test script structure", () => {
  it("defines scratch database creation, verification, cleanup and restore_tests logging", () => {
    const content = fs.readFileSync(
      path.join(SCRIPTS_DIR, "nexus-restore-test"),
      "utf8",
    );
    expect(content).toContain("scratch_test_");
    expect(content).toContain("CREATE DATABASE");
    expect(content).toContain("DROP DATABASE");
    expect(content).toContain("SHA256SUMS");
    expect(content).toContain("restore_tests");
  });
});
