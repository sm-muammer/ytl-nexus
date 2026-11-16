import { demoContinuity } from "@/lib/fixtures/continuity";
import type { Actor } from "@/lib/roles";
import {
  continuityView,
  type BackupRunRow,
  type ContinuityDto,
  type RestoreTestRow,
} from "@/lib/continuity/model";
import { getDb } from "@/lib/server/db";
import { getMode } from "@/lib/server/mode";

/**
 * Reads Continuity backup runs and restore verification tests from the database,
 * or serves demo fixtures when running in Demo_Mode.
 * Formats according to actor permissions (Viewer vs Operator/Admin).
 */
export async function getContinuityView(
  actor: Actor,
  now: Date = new Date(),
): Promise<ContinuityDto> {
  if (getMode() === "demo") {
    return demoContinuity(actor, now);
  }

  const db = getDb();
  if (!db) {
    return demoContinuity(actor, now);
  }

  try {
    const [runsRaw, testsRaw] = await Promise.all([
      db
        .selectFrom("backup_runs")
        .select([
          "id",
          "started_at",
          "completed_at",
          "status",
          "components_json",
        ])
        .orderBy("completed_at", "desc")
        .limit(30)
        .execute(),
      db
        .selectFrom("restore_tests")
        .select(["id", "tested_at", "component", "result", "detail"])
        .orderBy("tested_at", "desc")
        .limit(30)
        .execute(),
    ]);

    const runs: BackupRunRow[] = runsRaw.map((r) => ({
      id: r.id,
      started_at: new Date(r.started_at),
      completed_at: new Date(r.completed_at),
      status: r.status,
      components_json: r.components_json,
    }));

    const tests: RestoreTestRow[] = testsRaw.map((t) => ({
      id: t.id,
      tested_at: new Date(t.tested_at),
      component: t.component,
      result: t.result,
      detail: t.detail,
    }));

    return continuityView(actor, runs, tests, now);
  } catch (err) {
    // If table doesn't exist or DB is down, gracefully fallback
    console.error("Continuity DB read error:", err);
    return demoContinuity(actor, now);
  }
}
