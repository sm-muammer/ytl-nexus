import type {
  AssetCategory,
  CheckState,
  IncidentState,
  ServiceKind,
  Severity,
  SiteKind,
  TicketPriority,
  TicketStatus,
} from "../schema.ts";

// Deterministic, generic sample data. Nothing here is real inventory: sites are
// public Malaysian cities, vendors are public product lines, and no row holds a
// password, key or token (requirements 5.7 and 5.8). Every timestamp is fixed
// relative to BASE so two runs produce identical rows.

export const BASE = Date.UTC(2026, 10, 1, 0, 0, 0); // 2026-11-01T00:00:00Z
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** mulberry32: a tiny seeded generator, so "random" values repeat exactly. */
export function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (offsetMs: number) => new Date(BASE + offsetMs);

// --- Atlas inventory -------------------------------------------------------

interface SeedService {
  id: number;
  slug: string;
  name: string;
  kind: ServiceKind;
  unit: string | null;
}

export const services: SeedService[] = [
  {
    id: 1,
    slug: "apache",
    name: "Apache HTTP Server",
    kind: "proxy",
    unit: "httpd.service",
  },
  {
    id: 2,
    slug: "nexus-web",
    name: "Nexus Web",
    kind: "web",
    unit: "nexus-web.service",
  },
  {
    id: 3,
    slug: "mariadb",
    name: "MariaDB",
    kind: "database",
    unit: "mariadb.service",
  },
  {
    id: 4,
    slug: "php-fpm",
    name: "PHP-FPM",
    kind: "web",
    unit: "php-fpm.service",
  },
  {
    id: 5,
    slug: "wordpress",
    name: "WordPress (Nexus Studio)",
    kind: "web",
    unit: null,
  },
  {
    id: 6,
    slug: "roundcube",
    name: "Roundcube (Nexus Mail)",
    kind: "mail",
    unit: null,
  },
  {
    id: 7,
    slug: "postfix",
    name: "Postfix",
    kind: "mail",
    unit: "postfix.service",
  },
  {
    id: 8,
    slug: "dovecot",
    name: "Dovecot",
    kind: "mail",
    unit: "dovecot.service",
  },
  {
    id: 9,
    slug: "sftpgo",
    name: "SFTPGo (Nexus Transfer)",
    kind: "storage",
    unit: "sftpgo.service",
  },
  {
    id: 10,
    slug: "ollama",
    name: "Ollama (Nexus AI)",
    kind: "ai",
    unit: "ollama.service",
  },
  {
    id: 11,
    slug: "prometheus",
    name: "Prometheus",
    kind: "monitoring",
    unit: "prometheus.service",
  },
  {
    id: 12,
    slug: "node-exporter",
    name: "node_exporter",
    kind: "monitoring",
    unit: "node_exporter.service",
  },
  {
    id: 13,
    slug: "chronyd",
    name: "chrony time sync",
    kind: "system",
    unit: "chronyd.service",
  },
];

/** [service, depends on] */
export const dependencies: Array<[number, number]> = [
  [1, 2],
  [1, 4],
  [2, 3],
  [2, 11],
  [4, 3],
  [5, 4],
  [5, 3],
  [6, 4],
  [6, 8],
  [6, 3],
  [7, 8],
  [8, 3],
  [9, 3],
  [10, 12],
  [11, 12],
];

const checkProfile: Record<number, { base: number; spread: number }> = {
  1: { base: 8, spread: 6 },
  2: { base: 35, spread: 30 },
  3: { base: 3, spread: 4 },
  4: { base: 12, spread: 10 },
  5: { base: 90, spread: 60 },
  6: { base: 70, spread: 50 },
  7: { base: 15, spread: 10 },
  8: { base: 12, spread: 8 },
  9: { base: 25, spread: 15 },
  10: { base: 220, spread: 180 },
  11: { base: 18, spread: 12 },
  12: { base: 5, spread: 4 },
  13: { base: 2, spread: 2 },
};

export interface SeedCheck {
  id: number;
  service_id: number;
  checked_at: Date;
  state: CheckState;
  latency_ms: number | null;
  detail: string | null;
}

/** 48 checks per service, one every 30 minutes over the day before BASE. */
export function buildChecks(): SeedCheck[] {
  const rand = prng(20261101);
  const rows: SeedCheck[] = [];
  for (const svc of services) {
    const profile = checkProfile[svc.id] ?? { base: 20, spread: 10 };
    for (let i = 0; i < 48; i++) {
      const checked_at = at(-DAY + i * 30 * MIN);
      const roll = rand();
      let state: CheckState = "healthy";
      let detail: string | null = null;
      // Ollama is slow on the shared CPU, so it degrades now and then.
      if (svc.id === 10 && roll < 0.12) {
        state = "degraded";
        detail = "Response above 400 ms";
      }
      // One scripted outage matches the first incident below.
      if (svc.id === 5 && i >= 20 && i <= 21) {
        state = "down";
        detail = "Connection refused";
      }
      rows.push({
        id: rows.length + 1,
        service_id: svc.id,
        checked_at,
        state,
        latency_ms:
          state === "down"
            ? null
            : Math.round(profile.base + rand() * profile.spread),
        detail,
      });
    }
  }
  return rows;
}

export const incidents: Array<{
  id: number;
  service_id: number;
  title: string;
  state: IncidentState;
  opened_at: Date;
  resolved_at: Date | null;
}> = [
  {
    id: 1,
    service_id: 5,
    title: "Nexus Studio unavailable after PHP-FPM restart",
    state: "resolved",
    opened_at: at(-DAY + 10 * HOUR),
    resolved_at: at(-DAY + 11 * HOUR + 20 * MIN),
  },
  {
    id: 2,
    service_id: 10,
    title: "Nexus AI answers slower than usual",
    state: "monitoring",
    opened_at: at(-6 * HOUR),
    resolved_at: null,
  },
  {
    id: 3,
    service_id: 3,
    title: "Planned MariaDB minor upgrade window",
    state: "resolved",
    opened_at: at(-9 * DAY),
    resolved_at: at(-9 * DAY + 45 * MIN),
  },
];

export const incidentUpdates: Array<{
  id: number;
  incident_id: number;
  ts: Date;
  body: string;
}> = [
  {
    id: 1,
    incident_id: 1,
    ts: at(-DAY + 10 * HOUR + 5 * MIN),
    body: "The /studio path returns 503. PHP-FPM was restarted by a package update.",
  },
  {
    id: 2,
    incident_id: 1,
    ts: at(-DAY + 10 * HOUR + 40 * MIN),
    body: "The pool configuration was reloaded and the unit is healthy again.",
  },
  {
    id: 3,
    incident_id: 1,
    ts: at(-DAY + 11 * HOUR + 20 * MIN),
    body: "Resolved. The next package update will run with a graceful reload.",
  },
  {
    id: 4,
    incident_id: 2,
    ts: at(-6 * HOUR),
    body: "Model responses take longer on the shared CPU. Checking for competing jobs.",
  },
  {
    id: 5,
    incident_id: 2,
    ts: at(-4 * HOUR),
    body: "A background indexing job finished. Watching latency for the next few hours.",
  },
  {
    id: 6,
    incident_id: 3,
    ts: at(-9 * DAY),
    body: "Maintenance started. Dumps were verified before the upgrade.",
  },
  {
    id: 7,
    incident_id: 3,
    ts: at(-9 * DAY + 45 * MIN),
    body: "Upgrade finished and all connections recovered.",
  },
];

// --- Continuity ------------------------------------------------------------

export const backupRuns = Array.from({ length: 7 }, (_, i) => {
  const day = -(7 - i) * DAY;
  const started = at(day + 2 * HOUR);
  const rand = prng(1000 + i);
  const failed = i === 3;
  const components = [
    {
      name: "ytl_nexus-database",
      sizeBytes: 4_200_000 + Math.round(rand() * 200_000),
    },
    {
      name: "web-releases",
      sizeBytes: 380_000_000 + Math.round(rand() * 5_000_000),
    },
    { name: "config", sizeBytes: 90_000 + Math.round(rand() * 1_000) },
  ].map((c) => ({
    ...c,
    // A stable fake digest derived from the values, not a real file hash.
    sha256: Array.from({ length: 8 }, (_, k) =>
      Math.floor(prng(c.sizeBytes + k)() * 0xffffffff)
        .toString(16)
        .padStart(8, "0"),
    ).join(""),
  }));
  return {
    id: i + 1,
    started_at: started,
    completed_at: new Date(started.getTime() + (failed ? 3 : 14) * MIN),
    status: failed ? ("failed" as const) : ("ok" as const),
    components_json: JSON.stringify(
      failed ? components.slice(0, 2) : components,
    ),
  };
});

export const restoreTests = [
  {
    id: 1,
    tested_at: at(-21 * DAY),
    component: "ytl_nexus-database",
    result: "ok" as const,
    detail: "Restored into a scratch database; row counts matched",
  },
  {
    id: 2,
    tested_at: at(-21 * DAY),
    component: "config",
    result: "ok" as const,
    detail: "Archive listed and checksums verified",
  },
  {
    id: 3,
    tested_at: at(-14 * DAY),
    component: "web-releases",
    result: "failed" as const,
    detail: "Archive truncated; backup re-run the same day",
  },
  {
    id: 4,
    tested_at: at(-7 * DAY),
    component: "ytl_nexus-database",
    result: "ok" as const,
    detail: "Restored into a scratch database; row counts matched",
  },
];

// --- Shield ----------------------------------------------------------------

export const SHIELD_SCAN_ID = "scan-2026-11-01-0300";

export const shieldFindings: Array<{
  id: number;
  check_id: string;
  severity: Severity;
  evidence: string;
  remediation: string;
}> = [
  {
    id: 1,
    check_id: "ssh-root-login",
    severity: "high",
    evidence: "PermitRootLogin is set to yes",
    remediation:
      "Create an administrator account with sudo, then set PermitRootLogin no after confirming key access.",
  },
  {
    id: 2,
    check_id: "ssh-password-auth",
    severity: "medium",
    evidence: "PasswordAuthentication is enabled",
    remediation: "Disable password logins once every operator has a key.",
  },
  {
    id: 3,
    check_id: "selinux-mode",
    severity: "medium",
    evidence: "SELinux is disabled",
    remediation: "Move to permissive mode, review denials, then enforce.",
  },
  {
    id: 4,
    check_id: "tls-cert-expiry",
    severity: "low",
    evidence: "Internal certificate expires in more than 12 months",
    remediation: "Renew before expiry using the server baseline guide.",
  },
  {
    id: 5,
    check_id: "firewall-allowlist",
    severity: "info",
    evidence: "Only ports 22, 80, 443, 2022, 587 and 993 are open",
    remediation: "None. Matches the documented allowlist.",
  },
  {
    id: 6,
    check_id: "db-loopback",
    severity: "info",
    evidence: "MariaDB listens on 127.0.0.1 only",
    remediation: "None.",
  },
  {
    id: 7,
    check_id: "pending-updates",
    severity: "low",
    evidence: "Security updates are available for 3 packages",
    remediation: "Apply updates in the next maintenance window.",
  },
  {
    id: 8,
    check_id: "world-writable-files",
    severity: "info",
    evidence: "No world-writable files found under /opt/ytl-nexus",
    remediation: "None.",
  },
];

// --- Nexus Data ------------------------------------------------------------

export const sites: Array<{
  id: number;
  code: string;
  name: string;
  city: string;
  state: string;
  kind: SiteKind;
}> = [
  {
    id: 1,
    code: "KUL-DC1",
    name: "Kuala Lumpur Data Centre 1",
    city: "Kuala Lumpur",
    state: "Wilayah Persekutuan",
    kind: "data-centre",
  },
  {
    id: 2,
    code: "CYB-DC2",
    name: "Cyberjaya Data Centre 2",
    city: "Cyberjaya",
    state: "Selangor",
    kind: "data-centre",
  },
  {
    id: 3,
    code: "PJY-EX1",
    name: "Petaling Jaya Exchange",
    city: "Petaling Jaya",
    state: "Selangor",
    kind: "exchange",
  },
  {
    id: 4,
    code: "PEN-EX1",
    name: "Penang Exchange",
    city: "George Town",
    state: "Pulau Pinang",
    kind: "exchange",
  },
  {
    id: 5,
    code: "JHB-EX1",
    name: "Johor Bahru Exchange",
    city: "Johor Bahru",
    state: "Johor",
    kind: "exchange",
  },
  {
    id: 6,
    code: "KCH-OF1",
    name: "Kuching Regional Office",
    city: "Kuching",
    state: "Sarawak",
    kind: "office",
  },
  {
    id: 7,
    code: "KTN-TW1",
    name: "Kota Kinabalu Tower Site",
    city: "Kota Kinabalu",
    state: "Sabah",
    kind: "tower",
  },
  {
    id: 8,
    code: "IPH-OF1",
    name: "Ipoh Regional Office",
    city: "Ipoh",
    state: "Perak",
    kind: "office",
  },
];

const categoryPlan: Array<{
  category: AssetCategory;
  prefix: string;
  models: Array<[vendor: string, model: string]>;
}> = [
  {
    category: "server",
    prefix: "SRV",
    models: [
      ["Dell", "PowerEdge R650"],
      ["HPE", "ProLiant DL360 Gen10"],
      ["Lenovo", "ThinkSystem SR630"],
    ],
  },
  {
    category: "switch",
    prefix: "SWT",
    models: [
      ["Cisco", "Catalyst 9300"],
      ["Juniper", "EX4300"],
      ["Arista", "7050X3"],
    ],
  },
  {
    category: "router",
    prefix: "RTR",
    models: [
      ["Cisco", "ASR 1001-X"],
      ["Juniper", "MX204"],
    ],
  },
  {
    category: "firewall",
    prefix: "FWL",
    models: [
      ["Fortinet", "FortiGate 100F"],
      ["Palo Alto", "PA-440"],
    ],
  },
  {
    category: "access-point",
    prefix: "WAP",
    models: [
      ["Ubiquiti", "U6-Pro"],
      ["Aruba", "AP-515"],
    ],
  },
  {
    category: "ups",
    prefix: "UPS",
    models: [
      ["APC", "Smart-UPS SRT 5000"],
      ["Eaton", "9PX 6000"],
    ],
  },
  {
    category: "storage",
    prefix: "STO",
    models: [
      ["NetApp", "AFF A250"],
      ["Dell", "PowerStore 500T"],
    ],
  },
];

export interface SeedAsset {
  id: number;
  asset_tag: string;
  name: string;
  category: AssetCategory;
  site_id: number;
  status: "active" | "maintenance" | "retired";
  vendor: string;
  model: string;
  purchased_on: string;
}

/** 42 assets: six of each category spread over the eight sites. */
export function buildAssets(): SeedAsset[] {
  const rand = prng(4242);
  const rows: SeedAsset[] = [];
  let id = 1;
  for (const plan of categoryPlan) {
    for (let n = 1; n <= 6; n++) {
      const [vendor, model] = plan.models[(n - 1) % plan.models.length] ?? [
        "Generic",
        "Model",
      ];
      const site = sites[Math.floor(rand() * sites.length)];
      const roll = rand();
      const year = 2019 + Math.floor(rand() * 7);
      const month = 1 + Math.floor(rand() * 12);
      const tag = `${plan.prefix}-${String(n).padStart(3, "0")}`;
      rows.push({
        id,
        asset_tag: tag,
        name: `${site?.code ?? "SITE"} ${plan.category} ${n}`,
        category: plan.category,
        site_id: site?.id ?? 1,
        status: roll < 0.1 ? "retired" : roll < 0.25 ? "maintenance" : "active",
        vendor,
        model,
        purchased_on: `${year}-${String(month).padStart(2, "0")}-15`,
      });
      id++;
    }
  }
  return rows;
}

const ticketTitles = [
  "Replace failed fan module",
  "Firmware upgrade to current release",
  "Quarterly battery test",
  "Re-cable patch panel",
  "Replace SFP transceiver with link errors",
  "Install additional memory",
  "Rotate administrative credentials",
  "Verify configuration backup",
  "Clean air filters",
  "Review rack power draw",
];

export interface SeedTicket {
  id: number;
  ticket_no: string;
  title: string;
  asset_id: number | null;
  site_id: number;
  priority: TicketPriority;
  status: TicketStatus;
  scheduled_for: string | null;
  description: string;
}

export function buildTickets(assets: SeedAsset[]): SeedTicket[] {
  const rand = prng(777);
  const priorities: TicketPriority[] = ["low", "medium", "high"];
  const statuses: TicketStatus[] = ["open", "scheduled", "in-progress", "done"];
  return Array.from({ length: 28 }, (_, i) => {
    const asset = assets[Math.floor(rand() * assets.length)];
    const status = statuses[Math.floor(rand() * statuses.length)] ?? "open";
    const title = ticketTitles[i % ticketTitles.length] ?? "Maintenance";
    const day = 1 + Math.floor(rand() * 28);
    const needsDate = status === "scheduled" || status === "in-progress";
    return {
      id: i + 1,
      ticket_no: `MT-2026-${String(i + 1).padStart(4, "0")}`,
      title,
      // Every fifth ticket is site-level work with no single asset.
      asset_id: i % 5 === 4 ? null : (asset?.id ?? null),
      site_id: i % 5 === 4 ? (i % sites.length) + 1 : (asset?.site_id ?? 1),
      priority: priorities[Math.floor(rand() * priorities.length)] ?? "medium",
      status,
      scheduled_for: needsDate
        ? `2026-11-${String(day).padStart(2, "0")}`
        : null,
      description: `${title}. Generic maintenance record for demonstration.`,
    };
  });
}
