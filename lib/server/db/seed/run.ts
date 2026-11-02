import { sql, type Kysely } from "kysely";
import type { Database } from "../schema.ts";
import {
  SHIELD_SCAN_ID,
  BASE,
  backupRuns,
  buildAssets,
  buildChecks,
  buildTickets,
  dependencies,
  incidentUpdates,
  incidents,
  restoreTests,
  services,
  shieldFindings,
  sites,
} from "./data.ts";

/** Seeded tables, children first (the order rows are deleted on reset). */
export const SEEDED_TABLES = [
  "data_tickets",
  "data_assets",
  "data_sites",
  "shield_findings",
  "restore_tests",
  "backup_runs",
  "incident_updates",
  "incidents",
  "service_checks",
  "service_dependencies",
  "services",
] as const satisfies readonly (keyof Database)[];

export interface SeedResult {
  rows: Record<(typeof SEEDED_TABLES)[number], number>;
}

/**
 * Loads the sample data. Every row carries an explicit id and a fixed
 * timestamp, so a run on an empty database always produces the same rows
 * (requirement 5.7).
 *
 * Without `reset` the seed refuses to touch a database that already holds
 * seeded rows, so edits made through Nexus Data are never overwritten by
 * accident. With `reset` it deletes the seeded tables first. `audit_events` is
 * never deleted; the seed appends one audit row describing itself.
 */
export async function seedDatabase(
  db: Kysely<Database>,
  options: { reset?: boolean } = {},
): Promise<SeedResult> {
  const assets = buildAssets();
  const tickets = buildTickets(assets);
  const checks = buildChecks();

  return db.transaction().execute(async (trx) => {
    if (options.reset) {
      for (const table of SEEDED_TABLES) {
        await trx.deleteFrom(table).execute();
      }
    } else {
      for (const table of SEEDED_TABLES) {
        const row = await trx
          .selectFrom(table)
          .select(sql<number>`1`.as("present"))
          .limit(1)
          .executeTakeFirst();
        if (row) {
          throw new Error(
            `Seed refused: ${table} already holds rows. Run with --reset to replace the sample data.`,
          );
        }
      }
    }

    await trx
      .insertInto("services")
      .values(services.map((s) => ({ ...s, runbook_slug: s.slug })))
      .execute();
    await trx
      .insertInto("service_dependencies")
      .values(
        dependencies.map(([service_id, depends_on_id]) => ({
          service_id,
          depends_on_id,
        })),
      )
      .execute();
    await trx.insertInto("service_checks").values(checks).execute();
    await trx
      .insertInto("incidents")
      .values(incidents.map((i) => ({ ...i, opened_by: null })))
      .execute();
    await trx
      .insertInto("incident_updates")
      .values(incidentUpdates.map((u) => ({ ...u, author_id: null })))
      .execute();
    await trx.insertInto("backup_runs").values(backupRuns).execute();
    await trx.insertInto("restore_tests").values(restoreTests).execute();
    await trx
      .insertInto("shield_findings")
      .values(
        shieldFindings.map((f) => ({
          ...f,
          scan_id: SHIELD_SCAN_ID,
          seen_at: new Date(BASE - 21 * 60 * 60 * 1000),
        })),
      )
      .execute();
    await trx.insertInto("data_sites").values(sites).execute();
    await trx.insertInto("data_assets").values(assets).execute();
    await trx.insertInto("data_tickets").values(tickets).execute();

    await trx
      .insertInto("audit_events")
      .values({
        actor_id: null,
        role: null,
        action: "database.seed",
        target: options.reset ? "ytl_nexus:reset" : "ytl_nexus",
        result: "success",
        source_ip: "127.0.0.1",
      })
      .execute();

    return {
      rows: {
        services: services.length,
        service_dependencies: dependencies.length,
        service_checks: checks.length,
        incidents: incidents.length,
        incident_updates: incidentUpdates.length,
        backup_runs: backupRuns.length,
        restore_tests: restoreTests.length,
        shield_findings: shieldFindings.length,
        data_sites: sites.length,
        data_assets: assets.length,
        data_tickets: tickets.length,
      },
    };
  });
}
