import type { ShieldFindingItem, ShieldSummaryDto } from "@/lib/shield/model";

// Demo fixtures for Nexus Shield (Requirement 21.36 / 1.7)
// Demonstrates realistic security findings, severity distribution, and known operational risks
// (SELinux disabled, root SSH enabled, etc.) with honest labeling.

export const demoShieldFindings: ShieldFindingItem[] = [
  {
    id: 1,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-06",
    severity: "high",
    evidence:
      "PermitRootLogin is enabled and PasswordAuthentication is enabled in sshd_config",
    remediation:
      "Verify operator SSH key access, ensure non-root sudoer exists, then set PermitRootLogin no and PasswordAuthentication no.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 2,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-07",
    severity: "medium",
    evidence: "SELinux mode is Disabled (known operational risk)",
    remediation:
      "Transition SELinux to permissive mode, audit denial events with audit2allow, then enforce.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 3,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-04",
    severity: "medium",
    evidence:
      "3 pending security updates waiting: openssh-server, kernel-core, curl",
    remediation:
      "Execute 'dnf upgrade --security' during the upcoming scheduled maintenance window.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 4,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-11",
    severity: "low",
    evidence: "fail2ban is inactive or not installed",
    remediation:
      "Install and enable fail2ban to automatically block brute-force SSH and SFTP attempts.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 5,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-01",
    severity: "info",
    evidence: "All certificates valid (nearest expiry in 383 days)",
    remediation: "None. Certificates are healthy.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 6,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-02",
    severity: "info",
    evidence:
      "Only approved ports (22, 80, 443, 587, 993, 2022) listen publicly; all others bind to loopback.",
    remediation: "None. Port bindings match documented allowlist.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 7,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-03",
    severity: "info",
    evidence: "firewalld is active enforcing zone 'public'",
    remediation: "None. Firewall enforcement active.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 8,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-05",
    severity: "info",
    evidence:
      "Failed authentication attempts within baseline (2 SSH, 0 SFTP in 24h)",
    remediation: "None. Authentication volumes normal.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 9,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-08",
    severity: "info",
    evidence: "All filesystem mounts below threshold (peak utilisation 44%)",
    remediation: "None. Storage capacity healthy.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 10,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-09",
    severity: "info",
    evidence: "System clock synchronised with stratum 4 NTP source.",
    remediation: "None. Clock synchronisation healthy.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
  {
    id: 11,
    scan_id: "scan-2026-11-16-0300",
    check_id: "SHD-10",
    severity: "info",
    evidence:
      "Root backups fresh (latest completed 8 hours ago, under 26h threshold)",
    remediation: "None. Backups are up to date.",
    seen_at: new Date("2026-11-16T03:00:00.000Z"),
  },
];

export function demoShield(): ShieldSummaryDto {
  return {
    findings: demoShieldFindings,
    scannedAt: new Date("2026-11-16T03:00:00.000Z"),
    scanId: "scan-2026-11-16-0300",
    highCount: 1,
    mediumCount: 2,
    lowCount: 1,
    infoCount: 7,
    totalChecks: 11,
  };
}
