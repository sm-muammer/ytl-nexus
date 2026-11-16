import { describe, expect, it } from "vitest";
import {
  evaluateShieldChecks,
  parseShieldReport,
  severityWeight,
  SHIELD_CHECKS,
  type RawShieldReport,
} from "@/lib/shield/model";

describe("Nexus Shield model", () => {
  it("defines all 11 required checks from SHD-01 to SHD-11", () => {
    const ids = SHIELD_CHECKS.map((c) => c.id);
    expect(ids).toEqual([
      "SHD-01",
      "SHD-02",
      "SHD-03",
      "SHD-04",
      "SHD-05",
      "SHD-06",
      "SHD-07",
      "SHD-08",
      "SHD-09",
      "SHD-10",
      "SHD-11",
    ]);
  });

  it("maps severity weights correctly", () => {
    expect(severityWeight("high")).toBe(4);
    expect(severityWeight("medium")).toBe(3);
    expect(severityWeight("low")).toBe(2);
    expect(severityWeight("info")).toBe(1);
  });

  describe("fixture-driven check evaluations", () => {
    const validBaseline: RawShieldReport = {
      scan_id: "scan-test-1",
      scanned_at: "2026-11-16T12:00:00.000Z",
      tls_certs: [
        {
          name: "web",
          path: "/etc/pki/nexus-ca/server.crt",
          days_remaining: 380,
          subject: "CN=ytl-nexus.ytlcomms.my",
        },
        {
          name: "mail",
          path: "/etc/pki/nexus-ca/server.crt",
          days_remaining: 380,
          subject: "CN=ytl-nexus.ytlcomms.my",
        },
      ],
      listening_ports: [
        { port: 22, proto: "tcp", bind: "0.0.0.0", process: "sshd" },
        { port: 80, proto: "tcp", bind: "0.0.0.0", process: "httpd" },
        { port: 443, proto: "tcp", bind: "0.0.0.0", process: "httpd" },
        { port: 587, proto: "tcp", bind: "0.0.0.0", process: "master" },
        { port: 993, proto: "tcp", bind: "0.0.0.0", process: "dovecot" },
        { port: 2022, proto: "tcp", bind: "*", process: "sftpgo" },
        { port: 3306, proto: "tcp", bind: "127.0.0.1", process: "mariadbd" },
      ],
      firewall: {
        active: true,
        zone: "public",
        open_ports: ["80/tcp", "443/tcp", "587/tcp", "993/tcp", "2022/tcp"],
        services: ["ssh"],
      },
      updates: {
        security_count: 0,
        packages: [],
      },
      failed_logins_24h: {
        ssh_failures: 2,
        sftp_failures: 0,
      },
      sshd_config: {
        permit_root_login: "no",
        password_authentication: "no",
      },
      selinux: {
        mode: "Enforcing",
      },
      disks: [
        { mount: "/", use_percent: 45, filesystem: "/dev/mapper/rlm-root" },
        {
          mount: "/srv/nexus-transfer",
          use_percent: 2,
          filesystem: "/dev/sdb",
        },
      ],
      time_sync: {
        synchronized: true,
        offset_seconds: 0.0001,
        stratum: 4,
      },
      backup_freshness: {
        latest_backup_hours_ago: 10,
        status: "ok",
      },
      fail2ban: {
        active: true,
        jails: ["sshd"],
      },
    };

    it("evaluates healthy baseline to info findings", () => {
      const findings = evaluateShieldChecks(validBaseline);
      expect(findings.length).toBe(11);
      for (const f of findings) {
        expect(f.severity).toBe("info");
      }
    });

    it("SHD-01: flags TLS expiry under 30 days as high, under 60 days as medium", () => {
      const reportExpiringSoon: RawShieldReport = {
        ...validBaseline,
        tls_certs: [
          {
            name: "web",
            path: "/etc/pki/nexus-ca/server.crt",
            days_remaining: 15,
            subject: "CN=ytl-nexus.ytlcomms.my",
          },
        ],
      };
      const findings = evaluateShieldChecks(reportExpiringSoon);
      const f = findings.find((x) => x.check_id === "SHD-01");
      expect(f).toBeDefined();
      expect(f?.severity).toBe("high");
      expect(f?.evidence).toContain("15 days");

      const reportExpiringMedium: RawShieldReport = {
        ...validBaseline,
        tls_certs: [
          {
            name: "web",
            path: "/etc/pki/nexus-ca/server.crt",
            days_remaining: 45,
            subject: "CN=ytl-nexus.ytlcomms.my",
          },
        ],
      };
      const findingsMed = evaluateShieldChecks(reportExpiringMedium);
      const fMed = findingsMed.find((x) => x.check_id === "SHD-01");
      expect(fMed?.severity).toBe("medium");
    });

    it("SHD-02: flags unexpected public listener as high", () => {
      const reportUnallowedPort: RawShieldReport = {
        ...validBaseline,
        listening_ports: [
          ...validBaseline.listening_ports,
          {
            port: 6379,
            proto: "tcp",
            bind: "0.0.0.0",
            process: "redis-server",
          },
        ],
      };
      const findings = evaluateShieldChecks(reportUnallowedPort);
      const f = findings.find((x) => x.check_id === "SHD-02");
      expect(f?.severity).toBe("high");
      expect(f?.evidence).toContain("6379");
    });

    it("SHD-03: flags inactive firewall as high", () => {
      const reportNoFirewall: RawShieldReport = {
        ...validBaseline,
        firewall: { ...validBaseline.firewall, active: false },
      };
      const findings = evaluateShieldChecks(reportNoFirewall);
      const f = findings.find((x) => x.check_id === "SHD-03");
      expect(f?.severity).toBe("high");
      expect(f?.evidence).toContain("Firewall is inactive");
    });

    it("SHD-04: flags pending security updates", () => {
      const reportUpdates: RawShieldReport = {
        ...validBaseline,
        updates: {
          security_count: 5,
          packages: ["openssh-server", "kernel-core", "curl"],
        },
      };
      const findings = evaluateShieldChecks(reportUpdates);
      const f = findings.find((x) => x.check_id === "SHD-04");
      expect(f?.severity).toBe("medium");
      expect(f?.evidence).toContain("5 pending security updates");
    });

    it("SHD-05: flags failed login spikes as medium or high", () => {
      const reportSpike: RawShieldReport = {
        ...validBaseline,
        failed_logins_24h: {
          ssh_failures: 120,
          sftp_failures: 15,
        },
      };
      const findings = evaluateShieldChecks(reportSpike);
      const f = findings.find((x) => x.check_id === "SHD-05");
      expect(f?.severity).toBe("medium");
      expect(f?.evidence).toContain("120 SSH");
    });

    it("SHD-06: flags root login permitted as high, password auth as medium", () => {
      const reportRootSsh: RawShieldReport = {
        ...validBaseline,
        sshd_config: {
          permit_root_login: "yes",
          password_authentication: "yes",
        },
      };
      const findings = evaluateShieldChecks(reportRootSsh);
      const f = findings.find((x) => x.check_id === "SHD-06");
      expect(f?.severity).toBe("high");
      expect(f?.evidence).toContain("PermitRootLogin is enabled");
      expect(f?.evidence).toContain("PasswordAuthentication is enabled");
      expect(f?.remediation).toContain("PermitRootLogin no");
    });

    it("SHD-07: flags SELinux disabled as medium (known risk)", () => {
      const reportSelinuxDisabled: RawShieldReport = {
        ...validBaseline,
        selinux: {
          mode: "Disabled",
        },
      };
      const findings = evaluateShieldChecks(reportSelinuxDisabled);
      const f = findings.find((x) => x.check_id === "SHD-07");
      expect(f?.severity).toBe("medium");
      expect(f?.evidence).toContain("Disabled");
      expect(f?.remediation).toContain("permissive mode");
    });

    it("SHD-08: flags disk usage above 85% as high", () => {
      const reportFullDisk: RawShieldReport = {
        ...validBaseline,
        disks: [
          { mount: "/", use_percent: 88, filesystem: "/dev/mapper/rlm-root" },
        ],
      };
      const findings = evaluateShieldChecks(reportFullDisk);
      const f = findings.find((x) => x.check_id === "SHD-08");
      expect(f?.severity).toBe("high");
      expect(f?.evidence).toContain("88%");
    });

    it("SHD-09: flags clock out of sync as medium", () => {
      const reportClockDesync: RawShieldReport = {
        ...validBaseline,
        time_sync: {
          synchronized: false,
          offset_seconds: 5.2,
          stratum: 0,
        },
      };
      const findings = evaluateShieldChecks(reportClockDesync);
      const f = findings.find((x) => x.check_id === "SHD-09");
      expect(f?.severity).toBe("medium");
      expect(f?.evidence).toContain("not synchronised");
    });

    it("SHD-10: flags stale backup older than 26h as high", () => {
      const reportStaleBackup: RawShieldReport = {
        ...validBaseline,
        backup_freshness: {
          latest_backup_hours_ago: 32,
          status: "stale",
        },
      };
      const findings = evaluateShieldChecks(reportStaleBackup);
      const f = findings.find((x) => x.check_id === "SHD-10");
      expect(f?.severity).toBe("high");
      expect(f?.evidence).toContain("32 hours ago");
    });

    it("SHD-11: flags missing fail2ban jail as low/medium", () => {
      const reportNoFail2ban: RawShieldReport = {
        ...validBaseline,
        fail2ban: {
          active: false,
          jails: [],
        },
      };
      const findings = evaluateShieldChecks(reportNoFail2ban);
      const f = findings.find((x) => x.check_id === "SHD-11");
      expect(f?.severity).toBe("low");
      expect(f?.evidence).toContain("fail2ban is inactive");
    });
  });

  describe("parseShieldReport", () => {
    it("validates and parses valid json text", () => {
      const json = JSON.stringify({
        scan_id: "scan-2026-11-16-0100",
        scanned_at: "2026-11-16T01:00:00.000Z",
        tls_certs: [],
        listening_ports: [],
        firewall: {
          active: true,
          zone: "public",
          open_ports: [],
          services: [],
        },
        updates: { security_count: 0, packages: [] },
        failed_logins_24h: { ssh_failures: 0, sftp_failures: 0 },
        sshd_config: { permit_root_login: "no", password_authentication: "no" },
        selinux: { mode: "Enforcing" },
        disks: [],
        time_sync: { synchronized: true, offset_seconds: 0, stratum: 4 },
        backup_freshness: { latest_backup_hours_ago: 5, status: "ok" },
        fail2ban: { active: true, jails: ["sshd"] },
      });
      const parsed = parseShieldReport(json);
      expect(parsed).not.toBeNull();
      expect(parsed?.scan_id).toBe("scan-2026-11-16-0100");
    });

    it("returns null for malformed json", () => {
      expect(parseShieldReport("not json")).toBeNull();
    });
  });
});
