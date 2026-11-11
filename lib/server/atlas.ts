import "server-only";
import { sql, type Kysely } from "kysely";
import { SERVICE_OPS } from "@/lib/atlas/actions";
import type { AtlasEdge } from "@/lib/atlas/graph";
import type {
  AtlasAuditEntry,
  AtlasData,
  AtlasNode,
  AtlasRunbook,
  ServiceKind,
} from "@/lib/atlas/types";
import { DEMO_EDGES, DEMO_KINDS, demoAudit } from "@/lib/fixtures/atlas";
import type { Actor } from "@/lib/roles";
import { listContent } from "@/lib/server/content";
import { getDb } from "@/lib/server/db";
import type { Database } from "@/lib/server/db/schema";
import { getMode } from "@/lib/server/mode";
import { getStatusView } from "@/lib/server/status";

// The one reader of Atlas data (ATL-01). It joins the service inventory and
// its dependencies with Nexus Status (health, uptime, incidents), the Library
// (runbook) and the audit trail (past operator actions). Atlas is a Viewer page;
// a Visitor gets nothing, so a page cannot show detail by forgetting a check.

const AUDIT_PER_SERVICE = 5;
const INCIDENTS_PER_SERVICE = 3;

/** The audit targets an operator action on this service is recorded under. */
export function auditTargets(slug: string): string[] {
  const ops = SERVICE_OPS[slug];
  const targets: string[] = [];
  if (ops?.unit) targets.push(`unit:${ops.unit}`);
  if (ops?.check) targets.push(`check:${ops.check}`);
  return targets;
}

type InventoryRow = { slug: string; kind: ServiceKind };

/** Services and their dependencies from the database. Exported for the integration tests. */
export async function readInventory(db: Kysely<Database>): Promise<{
  kinds: Map<string, ServiceKind>;
  edges: AtlasEdge[];
}> {
  const services = (await db
    .selectFrom("services")
    .select(["slug", "kind"])
    .execute()) as InventoryRow[];
  const deps = await db
    .selectFrom("service_dependencies as d")
    .innerJoin("services as a", "a.id", "d.service_id")
    .innerJoin("services as b", "b.id", "d.depends_on_id")
    .select(["a.slug as from", "b.slug as to"])
    .execute();
  return {
    kinds: new Map(services.map((s) => [s.slug, s.kind])),
    edges: deps.map((d) => ({ from: d.from, to: d.to })),
  };
}

async function loadInventory() {
  if (getMode() === "demo") {
    return {
      kinds: new Map(Object.entries(DEMO_KINDS)),
      edges: [...DEMO_EDGES],
    };
  }
  return readInventory(getDb());
}

/** Past operator actions per service slug. Exported for the integration tests. */
export async function readAudit(
  db: Kysely<Database>,
  slugs: readonly string[],
): Promise<Record<string, AtlasAuditEntry[]>> {
  const bySlug = new Map(slugs.map((s) => [s, auditTargets(s)] as const));
  const targets = [...bySlug.values()].flat();
  if (targets.length === 0) return {};
  const rows = await sql<{
    ts: Date;
    action: string;
    target: string;
    result: AtlasAuditEntry["result"];
    role: string | null;
  }>`
    SELECT ts, action, target, result, role
    FROM audit_events
    WHERE action LIKE 'ops.%' AND action NOT LIKE '%.request' AND target IN (${sql.join(targets)})
    ORDER BY ts DESC, id DESC
    LIMIT 200`.execute(db);
  const out: Record<string, AtlasAuditEntry[]> = {};
  for (const [slug, mine] of bySlug) {
    out[slug] = rows.rows
      .filter((r) => mine.includes(r.target))
      .slice(0, AUDIT_PER_SERVICE)
      .map((r) => ({
        ts: r.ts.getTime(),
        action: r.action,
        result: r.result,
        role: r.role,
      }));
  }
  return out;
}

async function loadAudit(slugs: readonly string[], now: number) {
  if (getMode() === "demo") return demoAudit(now);
  return readAudit(getDb(), slugs);
}

async function loadRunbooks(actor: Actor): Promise<Map<string, AtlasRunbook>> {
  const result = await listContent("runbook", actor);
  const map = new Map<string, AtlasRunbook>();
  if (!result.ok) return map;
  for (const item of result.items) {
    if (item.relatedService && !map.has(item.relatedService)) {
      map.set(item.relatedService, { slug: item.slug, title: item.title });
    }
  }
  return map;
}

/** Atlas data for this actor, or null for a Visitor. */
export async function getAtlas(
  actor: Actor,
  now: number = Date.now(),
): Promise<AtlasData | null> {
  const status = await getStatusView(actor, now);
  if (status.kind !== "full") return null;
  const [inventory, runbooks] = await Promise.all([
    loadInventory(),
    loadRunbooks(actor),
  ]);
  const audit = await loadAudit(
    status.services.map((s) => s.slug),
    now,
  );
  const nodes: AtlasNode[] = status.services.map((s) => ({
    ...s,
    kind: inventory.kinds.get(s.slug) ?? "system",
    runbook: runbooks.get(s.slug) ?? null,
    incidents: status.incidents
      .filter((i) => i.serviceSlug === s.slug)
      .slice(0, INCIDENTS_PER_SERVICE),
    audit: audit[s.slug] ?? [],
  }));
  return {
    source: status.source,
    takenAt: status.takenAt,
    nodes,
    edges: inventory.edges,
  };
}
