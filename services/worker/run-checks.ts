import type { Kysely } from "kysely";
import type { Database } from "../../lib/server/db/schema.ts";
import {
  runProbe,
  type ProbeResult,
  type ProbeTarget,
} from "../../lib/ops/probes.ts";
import { RETENTION_DAYS, SERVICE_PROBES } from "../../lib/status/checks.ts";

// One round of service checks (STA-01): probe every service that has a
// predefined check and store one row each in `service_checks`. The database
// handle and the probe are parameters so the round runs in tests.

export type Probe = (target: ProbeTarget) => Promise<ProbeResult>;

export type RoundResult = { stored: number; skipped: number };

export async function runCheckRound(
  db: Kysely<Database>,
  now: Date,
  probe: Probe = (t) => runProbe(t),
  probes: Readonly<Record<string, ProbeTarget>> = SERVICE_PROBES,
): Promise<RoundResult> {
  const services = await db
    .selectFrom("services")
    .select(["id", "slug"])
    .execute();
  const targets = services.flatMap((s) => {
    const target = probes[s.slug];
    return target ? [{ id: s.id, target }] : [];
  });
  const results = await Promise.all(
    targets.map(async ({ id, target }) => ({
      id,
      result: await probe(target).catch((): ProbeResult => ({
        state: "down",
        latencyMs: null,
        detail: "No answer",
      })),
    })),
  );
  if (results.length > 0) {
    await db
      .insertInto("service_checks")
      .values(
        results.map(({ id, result }) => ({
          service_id: id,
          checked_at: now,
          state: result.state,
          latency_ms: result.latencyMs,
          detail: result.state === "healthy" ? null : result.detail,
        })),
      )
      .execute();
  }
  return { stored: results.length, skipped: services.length - results.length };
}

/** Deletes checks older than the retention period. Returns the number removed. */
export async function pruneChecks(
  db: Kysely<Database>,
  now: Date,
  days: number = RETENTION_DAYS,
): Promise<number> {
  const cutoff = new Date(now.getTime() - days * 24 * 3_600_000);
  const result = await db
    .deleteFrom("service_checks")
    .where("checked_at", "<", cutoff)
    .executeTakeFirst();
  return Number(result.numDeletedRows);
}
