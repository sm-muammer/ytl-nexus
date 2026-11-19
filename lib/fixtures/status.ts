import {
  uptimeSummary,
  type CheckSample,
  type Health,
} from "../status/health.ts";
import type {
  FullStatus,
  HistoryBucket,
  IncidentDto,
  ServiceStatus,
} from "../status/types.ts";

// Deterministic Nexus Status fixtures for Demo_Mode (requirement 9.19). The same
// call with the same `now` always returns the same value. Generic names only.

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const BUCKET_MS = 30 * MIN;

type DemoService = {
  slug: string;
  name: string;
  /** Probability that a check is not healthy, per mille. */
  flaky: number;
  latency: number;
  health: Health;
  detail: string | null;
};

const DEMO_SERVICES: DemoService[] = [
  {
    slug: "apache",
    name: "Apache HTTP Server",
    flaky: 0,
    latency: 8,
    health: "healthy",
    detail: null,
  },
  {
    slug: "nexus-web",
    name: "Nexus Web",
    flaky: 1,
    latency: 35,
    health: "healthy",
    detail: null,
  },
  {
    slug: "mariadb",
    name: "MariaDB",
    flaky: 0,
    latency: 3,
    health: "healthy",
    detail: null,
  },
  {
    slug: "php-fpm",
    name: "PHP-FPM",
    flaky: 0,
    latency: 0,
    health: "unknown",
    detail: null,
  },
  {
    slug: "wordpress",
    name: "WordPress (Nexus Studio)",
    flaky: 4,
    latency: 12,
    health: "healthy",
    detail: null,
  },
  {
    slug: "roundcube",
    name: "Roundcube (Nexus Mail)",
    flaky: 0,
    latency: 0,
    health: "unknown",
    detail: null,
  },
  {
    slug: "postfix",
    name: "Postfix",
    flaky: 0,
    latency: 14,
    health: "healthy",
    detail: null,
  },
  {
    slug: "dovecot",
    name: "Dovecot",
    flaky: 0,
    latency: 0,
    health: "unknown",
    detail: null,
  },
  {
    slug: "sftpgo",
    name: "SFTPGo (Nexus Transfer)",
    flaky: 0,
    latency: 0,
    health: "unknown",
    detail: null,
  },
  {
    slug: "ollama",
    name: "Ollama (Nexus AI)",
    flaky: 90,
    latency: 220,
    health: "degraded",
    detail: "Slow reply",
  },
  {
    slug: "prometheus",
    name: "Prometheus",
    flaky: 0,
    latency: 6,
    health: "healthy",
    detail: null,
  },
  {
    slug: "node-exporter",
    name: "node_exporter",
    flaky: 0,
    latency: 4,
    health: "healthy",
    detail: null,
  },
  {
    slug: "chronyd",
    name: "chrony time sync",
    flaky: 0,
    latency: 0,
    health: "unknown",
    detail: null,
  },
];

/** Small deterministic generator (mulberry32). */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Checks every 15 minutes over 30 days, with one scripted outage for WordPress. */
function demoChecks(index: number, now: number): CheckSample[] {
  const svc = DEMO_SERVICES[index]!;
  if (svc.health === "unknown") return [];
  const rand = prng(20261111 + index * 97);
  const samples: CheckSample[] = [];
  for (let t = now - 30 * DAY; t <= now; t += 15 * MIN) {
    let state: CheckSample["state"] = "healthy";
    if (rand() * 1000 < svc.flaky) state = "degraded";
    if (
      svc.slug === "wordpress" &&
      t > now - DAY - HOUR &&
      t < now - DAY + HOUR / 2
    ) {
      state = "down";
    }
    samples.push({ state, checkedAt: t });
  }
  if (svc.health === "degraded") {
    samples.push({ state: "degraded", checkedAt: now - MIN });
  }
  return samples;
}

function demoHistory(checks: CheckSample[], now: number): HistoryBucket[] {
  const start = Math.floor((now - DAY) / BUCKET_MS) * BUCKET_MS;
  const buckets: HistoryBucket[] = [];
  for (let t = start; t < now; t += BUCKET_MS) {
    const inBucket = checks.filter((c) => {
      const at = Number(c.checkedAt);
      return at >= t && at < t + BUCKET_MS;
    });
    const worst = inBucket.some((c) => c.state === "down")
      ? "down"
      : inBucket.some((c) => c.state === "degraded")
        ? "degraded"
        : inBucket.length > 0
          ? "healthy"
          : null;
    buckets.push({ t, state: worst });
  }
  return buckets;
}

export function demoIncidents(now: number): IncidentDto[] {
  const name = (slug: string) =>
    DEMO_SERVICES.find((s) => s.slug === slug)!.name;
  return [
    {
      id: 2,
      ticketNo: "INC-2026-0002",
      serviceSlug: "ollama",
      serviceName: name("ollama"),
      title: "Nexus AI answers slower than usual",
      state: "monitoring",
      openedAt: now - 6 * HOUR,
      resolvedAt: null,
      updates: [
        {
          id: 5,
          ts: now - 4 * HOUR,
          body: "A background indexing job finished. Watching latency for the next few hours.",
        },
        {
          id: 4,
          ts: now - 6 * HOUR,
          body: "Model responses take longer on the shared CPU. Checking for competing jobs.",
        },
      ],
    },
    {
      id: 1,
      ticketNo: "INC-2026-0001",
      serviceSlug: "wordpress",
      serviceName: name("wordpress"),
      title: "Nexus Studio unavailable after PHP-FPM restart",
      state: "resolved",
      openedAt: now - DAY,
      resolvedAt: now - DAY + 80 * MIN,
      updates: [
        {
          id: 3,
          ts: now - DAY + 80 * MIN,
          body: "Resolved. The next package update will run with a graceful reload.",
        },
        {
          id: 2,
          ts: now - DAY + 40 * MIN,
          body: "The pool configuration was reloaded and the unit is healthy again.",
        },
        {
          id: 1,
          ts: now - DAY + 5 * MIN,
          body: "The /studio path returns 503. PHP-FPM was restarted by a package update.",
        },
      ],
    },
    {
      id: 3,
      ticketNo: "INC-2026-0003",
      serviceSlug: "mariadb",
      serviceName: name("mariadb"),
      title: "Planned MariaDB minor upgrade window",
      state: "resolved",
      openedAt: now - 9 * DAY,
      resolvedAt: now - 9 * DAY + 45 * MIN,
      updates: [
        {
          id: 7,
          ts: now - 9 * DAY + 45 * MIN,
          body: "Upgrade finished and all connections recovered.",
        },
        {
          id: 6,
          ts: now - 9 * DAY,
          body: "Maintenance started. Dumps were verified before the upgrade.",
        },
      ],
    },
  ];
}

export function demoStatus(now: number): FullStatus {
  const services: ServiceStatus[] = DEMO_SERVICES.map((svc, i) => {
    const checks = demoChecks(i, now);
    const last = checks[checks.length - 1];
    return {
      slug: svc.slug,
      name: svc.name,
      health: svc.health,
      latencyMs: last && svc.health !== "unknown" ? svc.latency : null,
      detail: svc.detail,
      lastCheckedAt: last ? Number(last.checkedAt) : null,
      uptime: uptimeSummary(checks, now),
      history: demoHistory(checks, now),
    };
  });
  return {
    kind: "full",
    source: "demo",
    takenAt: now,
    services,
    incidents: demoIncidents(now),
  };
}
