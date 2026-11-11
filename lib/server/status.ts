import "server-only";
import { sql, type Kysely } from "kysely";
import { demoStatus } from "@/lib/fixtures/status";
import type { Actor } from "@/lib/roles";
import { getDb } from "@/lib/server/db";
import type { Database } from "@/lib/server/db/schema";
import { getMode } from "@/lib/server/mode";
import {
  UPTIME_WINDOWS,
  nodeHealth,
  type CheckState,
  type UptimeSummary,
} from "@/lib/status/health";
import {
  toPublicService,
  type FullStatus,
  type HistoryBucket,
  type IncidentDto,
  type IncidentState,
  type ServiceStatus,
  type StatusView,
} from "@/lib/status/types";

// The one reader of Nexus Status data. Pages call `getStatusView(actor)`, which
// returns the Visitor shape (names and states only) or the full shape, so a
// page cannot show a Viewer's detail to a Visitor by forgetting a check
// (STA-03, STA-04). Live results are cached for 30 seconds: the page is public
// and the uptime query reads 30 days of checks.

const CACHE_MS = 30_000;
const BUCKET_MS = 30 * 60_000;
const DAY_MS = 24 * 3_600_000;

let cache: { at: number; value: FullStatus } | undefined;

type LatestRow = {
  service_id: number;
  state: CheckState;
  latency_ms: number | null;
  detail: string | null;
  checked_at: Date;
};

type UptimeRow = {
  service_id: number;
  n24: string | number;
  h24: string | number;
  n7: string | number;
  h7: string | number;
  n30: string | number;
  h30: string | number;
};

function ratio(healthy: string | number, total: string | number) {
  const n = Number(total);
  return n === 0 ? null : Number(healthy) / n;
}

/** Reads the full status from the database. Exported for the integration tests. */
export async function loadLiveStatus(
  db: Kysely<Database>,
  now: number,
): Promise<FullStatus> {
  const at24 = new Date(now - UPTIME_WINDOWS[0].ms);
  const at7 = new Date(now - UPTIME_WINDOWS[1].ms);
  const at30 = new Date(now - UPTIME_WINDOWS[2].ms);

  const [services, latest, uptimeRows, recent] = await Promise.all([
    db
      .selectFrom("services")
      .select(["id", "slug", "name"])
      .orderBy("id")
      .execute(),
    sql<LatestRow>`
      SELECT c.service_id, c.state, c.latency_ms, c.detail, c.checked_at
      FROM service_checks c
      JOIN (SELECT service_id, MAX(checked_at) AS m FROM service_checks GROUP BY service_id) x
        ON x.service_id = c.service_id AND x.m = c.checked_at`.execute(db),
    sql<UptimeRow>`
      SELECT service_id,
        SUM(checked_at >= ${at24}) AS n24,
        SUM(checked_at >= ${at24} AND state = 'healthy') AS h24,
        SUM(checked_at >= ${at7}) AS n7,
        SUM(checked_at >= ${at7} AND state = 'healthy') AS h7,
        COUNT(*) AS n30,
        SUM(state = 'healthy') AS h30
      FROM service_checks
      WHERE checked_at >= ${at30}
      GROUP BY service_id`.execute(db),
    db
      .selectFrom("service_checks")
      .select(["service_id", "checked_at", "state"])
      .where("checked_at", ">=", at24)
      .execute(),
  ]);

  const latestBy = new Map<number, LatestRow>();
  for (const row of latest.rows) {
    if (!latestBy.has(row.service_id)) latestBy.set(row.service_id, row);
  }
  const uptimeBy = new Map<number, UptimeSummary>();
  for (const r of uptimeRows.rows) {
    uptimeBy.set(r.service_id, {
      "24h": ratio(r.h24, r.n24),
      "7d": ratio(r.h7, r.n7),
      "30d": ratio(r.h30, r.n30),
    });
  }
  const start = Math.floor((now - DAY_MS) / BUCKET_MS) * BUCKET_MS;
  const history = new Map<number, HistoryBucket[]>();
  for (const s of services) {
    const buckets: HistoryBucket[] = [];
    for (let t = start; t < now; t += BUCKET_MS)
      buckets.push({ t, state: null });
    history.set(s.id, buckets);
  }
  const rank = { healthy: 1, degraded: 2, down: 3 } as const;
  for (const row of recent) {
    const buckets = history.get(row.service_id);
    const index = Math.floor((row.checked_at.getTime() - start) / BUCKET_MS);
    const bucket = buckets?.[index];
    if (!bucket) continue;
    if (bucket.state === null || rank[row.state] > rank[bucket.state]) {
      bucket.state = row.state;
    }
  }

  const rows: ServiceStatus[] = services.map((s) => {
    const last = latestBy.get(s.id);
    return {
      slug: s.slug,
      name: s.name,
      health: nodeHealth(
        last ? { state: last.state, checkedAt: last.checked_at } : undefined,
        now,
      ),
      latencyMs: last?.latency_ms ?? null,
      detail: last?.state === "healthy" ? null : (last?.detail ?? null),
      lastCheckedAt: last ? last.checked_at.getTime() : null,
      uptime: uptimeBy.get(s.id) ?? { "24h": null, "7d": null, "30d": null },
      history: history.get(s.id) ?? [],
    };
  });

  return {
    kind: "full",
    source: "live",
    takenAt: now,
    services: rows,
    incidents: await loadIncidents(db, now),
  };
}

export async function loadIncidents(
  db: Kysely<Database>,
  now: number,
): Promise<IncidentDto[]> {
  const since = new Date(now - 30 * DAY_MS);
  const incidents = await db
    .selectFrom("incidents")
    .innerJoin("services", "services.id", "incidents.service_id")
    .select([
      "incidents.id",
      "incidents.title",
      "incidents.state",
      "incidents.opened_at",
      "incidents.resolved_at",
      "services.slug as service_slug",
      "services.name as service_name",
    ])
    .where((eb) =>
      eb.or([
        eb("incidents.state", "!=", "resolved"),
        eb("incidents.opened_at", ">=", since),
      ]),
    )
    .orderBy("incidents.opened_at", "desc")
    .limit(50)
    .execute();
  if (incidents.length === 0) return [];
  const updates = await db
    .selectFrom("incident_updates")
    .select(["id", "incident_id", "ts", "body"])
    .where(
      "incident_id",
      "in",
      incidents.map((i) => i.id),
    )
    .orderBy("ts", "desc")
    .orderBy("id", "desc")
    .execute();
  return incidents.map((i) => ({
    id: i.id,
    serviceSlug: i.service_slug,
    serviceName: i.service_name,
    title: i.title,
    state: i.state as IncidentState,
    openedAt: i.opened_at.getTime(),
    resolvedAt: i.resolved_at ? i.resolved_at.getTime() : null,
    updates: updates
      .filter((u) => u.incident_id === i.id)
      .map((u) => ({ id: u.id, ts: u.ts.getTime(), body: u.body })),
  }));
}

/** The full dataset for this process, from the database or the fixtures. */
async function loadFull(now: number): Promise<FullStatus> {
  if (getMode() === "demo") return demoStatus(now);
  if (cache && now - cache.at < CACHE_MS) return cache.value;
  const value = await loadLiveStatus(getDb(), now);
  cache = { at: now, value };
  return value;
}

/** Drops the cached reading, so a change shows at once. */
export function invalidateStatusCache(): void {
  cache = undefined;
}

/**
 * What this actor may see. A Visitor gets names and states and nothing else:
 * no latency, no detail text, no history, no incidents (STA-03).
 */
export async function getStatusView(
  actor: Actor,
  now: number = Date.now(),
): Promise<StatusView> {
  const full = await loadFull(now);
  if (actor === null) {
    return {
      kind: "public",
      source: full.source,
      takenAt: full.takenAt,
      services: full.services.map(toPublicService),
    };
  }
  return full;
}
