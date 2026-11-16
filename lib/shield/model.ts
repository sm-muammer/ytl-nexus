import { z } from "zod";
import type { Severity } from "@/lib/server/db/schema";

export type ShieldCheckId =
  | "SHD-01"
  | "SHD-02"
  | "SHD-03"
  | "SHD-04"
  | "SHD-05"
  | "SHD-06"
  | "SHD-07"
  | "SHD-08"
  | "SHD-09"
  | "SHD-10"
  | "SHD-11";

export interface ShieldCheckDefinition {
  id: ShieldCheckId;
  name: string;
  category: "crypto" | "network" | "system" | "access" | "storage";
  description: string;
}

export const SHIELD_CHECKS: readonly ShieldCheckDefinition[] = [
  {
    id: "SHD-01",
    name: "TLS Certificate Expiry",
    category: "crypto",
    description:
      "Evaluates remaining validity for public and internal TLS certificates (web, mail)",
  },
  {
    id: "SHD-02",
    name: "Listening Ports Allowlist",
    category: "network",
    description:
      "Asserts only permitted public listeners (22, 80, 443, 2022, 587, 993) bind externally",
  },
  {
    id: "SHD-03",
    name: "Firewall (firewalld) State",
    category: "network",
    description:
      "Verifies firewalld daemon is active, running, and enforces public zone rules",
  },
  {
    id: "SHD-04",
    name: "Pending Security Updates",
    category: "system",
    description: "Checks dnf security update backlog on Rocky Linux",
  },
  {
    id: "SHD-05",
    name: "Failed Logins (24h)",
    category: "access",
    description:
      "Monitors failed SSH and SFTP authentication spikes in the last 24 hours",
  },
  {
    id: "SHD-06",
    name: "SSH Server Configuration",
    category: "access",
    description: "Inspects PermitRootLogin and PasswordAuthentication flags",
  },
  {
    id: "SHD-07",
    name: "SELinux State",
    category: "system",
    description:
      "Inspects SELinux enforcement mode (reporting known risks without breaking changes)",
  },
  {
    id: "SHD-08",
    name: "Disk Mount Usage",
    category: "storage",
    description:
      "Monitors filesystem storage capacity across all mounted partitions",
  },
  {
    id: "SHD-09",
    name: "Time Synchronisation",
    category: "system",
    description: "Verifies NTP time tracking status via chrony",
  },
  {
    id: "SHD-10",
    name: "Backup Freshness",
    category: "storage",
    description:
      "Verifies latest root backup is within the 26-hour freshness threshold",
  },
  {
    id: "SHD-11",
    name: "Fail2ban Jails Active",
    category: "access",
    description:
      "Verifies intrusion prevention fail2ban daemon and jail configurations",
  },
] as const;

export interface ShieldFindingItem {
  id?: number;
  scan_id: string;
  check_id: ShieldCheckId;
  severity: Severity;
  evidence: string;
  remediation: string;
  seen_at: Date;
}

export const rawShieldReportSchema = z.object({
  scan_id: z.string().min(1),
  scanned_at: z.string().datetime(),
  tls_certs: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      days_remaining: z.number(),
      subject: z.string().optional(),
    }),
  ),
  listening_ports: z.array(
    z.object({
      port: z.number(),
      proto: z.string(),
      bind: z.string(),
      process: z.string().optional(),
    }),
  ),
  firewall: z.object({
    active: z.boolean(),
    zone: z.string().optional(),
    open_ports: z.array(z.string()).optional(),
    services: z.array(z.string()).optional(),
  }),
  updates: z.object({
    security_count: z.number(),
    packages: z.array(z.string()).optional(),
  }),
  failed_logins_24h: z.object({
    ssh_failures: z.number(),
    sftp_failures: z.number(),
  }),
  sshd_config: z.object({
    permit_root_login: z.string(),
    password_authentication: z.string(),
  }),
  selinux: z.object({
    mode: z.string(),
  }),
  disks: z.array(
    z.object({
      mount: z.string(),
      use_percent: z.number(),
      filesystem: z.string().optional(),
    }),
  ),
  time_sync: z.object({
    synchronized: z.boolean(),
    offset_seconds: z.number().optional(),
    stratum: z.number().optional(),
  }),
  backup_freshness: z.object({
    latest_backup_hours_ago: z.number().nullable(),
    status: z.enum(["ok", "stale", "missing"]),
  }),
  fail2ban: z.object({
    active: z.boolean(),
    jails: z.array(z.string()).optional(),
  }),
});

export type RawShieldReport = z.infer<typeof rawShieldReportSchema>;

export function parseShieldReport(jsonText: string): RawShieldReport | null {
  try {
    const obj = JSON.parse(jsonText);
    const result = rawShieldReportSchema.safeParse(obj);
    if (!result.success) return null;
    return result.data;
  } catch {
    return null;
  }
}

export function severityWeight(severity: Severity): number {
  switch (severity) {
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "info":
      return 1;
  }
}

export const ALLOWED_PUBLIC_PORTS = new Set([22, 80, 443, 587, 993, 2022]);

export function evaluateShieldChecks(
  report: RawShieldReport,
): ShieldFindingItem[] {
  const seenAt = new Date(report.scanned_at);
  const scanId = report.scan_id;
  const findings: ShieldFindingItem[] = [];

  // SHD-01: TLS certificate expiry
  const certs = report.tls_certs;
  const minDays =
    certs.length > 0 ? Math.min(...certs.map((c) => c.days_remaining)) : 999;
  if (minDays < 0) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-01",
      severity: "high",
      evidence: `Certificate expired (${minDays} days remaining)`,
      remediation:
        "Immediately renew internal CA certificates using the server baseline guide.",
      seen_at: seenAt,
    });
  } else if (minDays <= 30) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-01",
      severity: "high",
      evidence: `Certificate expires in ${minDays} days (under 30-day emergency window)`,
      remediation:
        "Renew certificate immediately using infrastructure/scripts/setup-tls.",
      seen_at: seenAt,
    });
  } else if (minDays <= 60) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-01",
      severity: "medium",
      evidence: `Certificate expires in ${minDays} days`,
      remediation: "Plan certificate renewal in the next maintenance window.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-01",
      severity: "info",
      evidence: `All certificates valid (nearest expiry in ${minDays} days)`,
      remediation: "None. Certificates are healthy.",
      seen_at: seenAt,
    });
  }

  // SHD-02: Listening ports against allowlist
  const unexpectedPublic = report.listening_ports.filter((p) => {
    const isLoopback =
      p.bind === "127.0.0.1" ||
      p.bind === "::1" ||
      p.bind === "localhost" ||
      p.bind.startsWith("127.");
    if (isLoopback) return false;
    return !ALLOWED_PUBLIC_PORTS.has(p.port);
  });

  if (unexpectedPublic.length > 0) {
    const list = unexpectedPublic
      .map((p) => `${p.port}/${p.proto} (${p.process || "unknown"})`)
      .join(", ");
    findings.push({
      scan_id: scanId,
      check_id: "SHD-02",
      severity: "high",
      evidence: `Unexpected public listeners detected: ${list}`,
      remediation:
        "Rebind unexpected listeners to 127.0.0.1 or terminate unauthorized services.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-02",
      severity: "info",
      evidence:
        "Only approved ports (22, 80, 443, 587, 993, 2022) listen publicly; all others bind to loopback.",
      remediation: "None. Port bindings match documented allowlist.",
      seen_at: seenAt,
    });
  }

  // SHD-03: firewalld active
  if (!report.firewall.active) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-03",
      severity: "high",
      evidence: "Firewall is inactive or stopped",
      remediation:
        "Start and enable firewalld: systemctl enable --now firewalld && infrastructure/scripts/setup-firewall.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-03",
      severity: "info",
      evidence: `firewalld is active enforcing zone '${report.firewall.zone || "public"}'`,
      remediation: "None. Firewall enforcement active.",
      seen_at: seenAt,
    });
  }

  // SHD-04: Pending security updates
  const secCount = report.updates.security_count;
  if (secCount > 10) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-04",
      severity: "high",
      evidence: `${secCount} pending security updates waiting: ${report.updates.packages?.slice(0, 5).join(", ")}...`,
      remediation:
        "Execute 'dnf upgrade --security' during the upcoming scheduled maintenance window.",
      seen_at: seenAt,
    });
  } else if (secCount > 0) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-04",
      severity: "medium",
      evidence: `${secCount} pending security updates waiting: ${report.updates.packages?.join(", ")}`,
      remediation: "Review and apply pending package security patches.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-04",
      severity: "info",
      evidence:
        "All installed system packages are up-to-date with security advisories.",
      remediation: "None. System up to date.",
      seen_at: seenAt,
    });
  }

  // SHD-05: Failed SSH and SFTP logins
  const sshFails = report.failed_logins_24h.ssh_failures;
  const sftpFails = report.failed_logins_24h.sftp_failures;
  const totalFails = sshFails + sftpFails;
  if (totalFails >= 100) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-05",
      severity: "medium",
      evidence: `Elevated failed logins in last 24h: ${sshFails} SSH failures, ${sftpFails} SFTP failures`,
      remediation:
        "Investigate source IPs in /var/log/secure or journalctl -u sshd and ensure fail2ban jail is running.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-05",
      severity: "info",
      evidence: `Failed authentication attempts within baseline (${sshFails} SSH, ${sftpFails} SFTP in 24h)`,
      remediation: "None. Authentication volumes normal.",
      seen_at: seenAt,
    });
  }

  // SHD-06: SSH configuration
  const permitRoot = report.sshd_config.permit_root_login.toLowerCase();
  const passwordAuth = report.sshd_config.password_authentication.toLowerCase();
  const rootOpen = permitRoot === "yes";
  const passOpen = passwordAuth === "yes";

  if (rootOpen && passOpen) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-06",
      severity: "high",
      evidence:
        "PermitRootLogin is enabled and PasswordAuthentication is enabled in sshd_config",
      remediation:
        "Verify operator SSH key access, ensure non-root sudoer exists, then set PermitRootLogin no and PasswordAuthentication no.",
      seen_at: seenAt,
    });
  } else if (rootOpen) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-06",
      severity: "high",
      evidence: "PermitRootLogin is enabled in sshd_config",
      remediation:
        "Disable root SSH login once standard sudo operator accounts have verified key access.",
      seen_at: seenAt,
    });
  } else if (passOpen) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-06",
      severity: "medium",
      evidence: "PasswordAuthentication is enabled in sshd_config",
      remediation:
        "Transition all operators to ED25519 SSH keys and set PasswordAuthentication no.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-06",
      severity: "info",
      evidence:
        "SSHD hardened: root login disabled and password authentication disabled.",
      remediation: "None. SSH configuration follows best practices.",
      seen_at: seenAt,
    });
  }

  // SHD-07: SELinux state
  const selinux = report.selinux.mode.toLowerCase();
  if (selinux === "disabled") {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-07",
      severity: "medium",
      evidence: "SELinux mode is Disabled (known operational risk)",
      remediation:
        "Transition SELinux to permissive mode, audit denial events with audit2allow, then enforce.",
      seen_at: seenAt,
    });
  } else if (selinux === "permissive") {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-07",
      severity: "low",
      evidence:
        "SELinux is in Permissive mode (logging denials without enforcing)",
      remediation: "Review audit logs and advance SELINUX=enforcing.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-07",
      severity: "info",
      evidence: "SELinux is active in Enforcing mode.",
      remediation: "None. Mandatory access controls enforced.",
      seen_at: seenAt,
    });
  }

  // SHD-08: Disk mount usage
  const fullDisks = report.disks.filter((d) => d.use_percent >= 85);
  if (fullDisks.length > 0) {
    const list = fullDisks
      .map((d) => `${d.mount} (${d.use_percent}%)`)
      .join(", ");
    findings.push({
      scan_id: scanId,
      check_id: "SHD-08",
      severity: "high",
      evidence: `Disk capacity critical (above 85%): ${list}`,
      remediation:
        "Clean up unneeded logs, old releases or enlarge storage volumes.",
      seen_at: seenAt,
    });
  } else {
    const maxUse = Math.max(0, ...report.disks.map((d) => d.use_percent));
    findings.push({
      scan_id: scanId,
      check_id: "SHD-08",
      severity: "info",
      evidence: `All filesystem mounts below threshold (peak utilisation ${maxUse}%)`,
      remediation: "None. Storage capacity healthy.",
      seen_at: seenAt,
    });
  }

  // SHD-09: Time synchronisation
  if (!report.time_sync.synchronized) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-09",
      severity: "medium",
      evidence: `System clock not synchronised via NTP (offset: ${report.time_sync.offset_seconds ?? "unknown"}s)`,
      remediation:
        "Verify chronyd service is active and upstream NTP servers are reachable.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-09",
      severity: "info",
      evidence: `System clock synchronised with stratum ${report.time_sync.stratum ?? 4} NTP source.`,
      remediation: "None. Clock synchronisation healthy.",
      seen_at: seenAt,
    });
  }

  // SHD-10: Backup freshness
  if (
    report.backup_freshness.status === "missing" ||
    report.backup_freshness.latest_backup_hours_ago === null
  ) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-10",
      severity: "high",
      evidence: "No root backups found on the system",
      remediation:
        "Run infrastructure/scripts/nexus-backup manually and verify nexus-backup.timer is enabled.",
      seen_at: seenAt,
    });
  } else if (report.backup_freshness.latest_backup_hours_ago > 26) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-10",
      severity: "high",
      evidence: `Latest backup is stale: created ${report.backup_freshness.latest_backup_hours_ago} hours ago (threshold 26h)`,
      remediation:
        "Inspect systemctl status nexus-backup.service and run infrastructure/scripts/nexus-backup.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-10",
      severity: "info",
      evidence: `Root backups fresh (latest completed ${report.backup_freshness.latest_backup_hours_ago} hours ago, under 26h threshold)`,
      remediation: "None. Backups are up to date.",
      seen_at: seenAt,
    });
  }

  // SHD-11: fail2ban
  if (!report.fail2ban.active) {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-11",
      severity: "low",
      evidence: "fail2ban is inactive or not installed",
      remediation:
        "Install and enable fail2ban to automatically block brute-force SSH and SFTP attempts.",
      seen_at: seenAt,
    });
  } else {
    findings.push({
      scan_id: scanId,
      check_id: "SHD-11",
      severity: "info",
      evidence: `fail2ban active protecting jails: ${report.fail2ban.jails?.join(", ") || "none"}`,
      remediation: "None. Intrusion prevention active.",
      seen_at: seenAt,
    });
  }

  return findings;
}

export interface ShieldSummaryDto {
  findings: ShieldFindingItem[];
  scannedAt: Date | null;
  scanId: string | null;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
  totalChecks: number;
}

export function buildShieldSummary(
  findings: ShieldFindingItem[],
): ShieldSummaryDto {
  let high = 0;
  let medium = 0;
  let low = 0;
  let info = 0;

  for (const f of findings) {
    if (f.severity === "high") high++;
    else if (f.severity === "medium") medium++;
    else if (f.severity === "low") low++;
    else info++;
  }

  const latestSeen =
    findings.length > 0 && findings[0] ? findings[0].seen_at : null;
  const scanId =
    findings.length > 0 && findings[0] ? findings[0].scan_id : null;

  return {
    findings,
    scannedAt: latestSeen,
    scanId,
    highCount: high,
    mediumCount: medium,
    lowCount: low,
    infoCount: info,
    totalChecks: findings.length,
  };
}
