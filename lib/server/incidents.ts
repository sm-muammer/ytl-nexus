import type { Kysely } from "kysely";
import type { Database } from "@/lib/server/db/schema";
import type { IncidentState } from "@/lib/status/types";

// Incident writes, with the database handle as a parameter so integration tests
// run them against a real MariaDB. The Server Functions in ./status-actions.ts
// authorize, validate and audit; this file only changes rows.

/** Opens an incident with its first update. Null when the service does not exist. */
export async function openIncident(
  db: Kysely<Database>,
  input: { serviceSlug: string; title: string; body: string },
  authorId: string | null,
  now: Date,
): Promise<number | null> {
  return db.transaction().execute(async (trx) => {
    const service = await trx
      .selectFrom("services")
      .select("id")
      .where("slug", "=", input.serviceSlug)
      .executeTakeFirst();
    if (!service) return null;
    const created = await trx
      .insertInto("incidents")
      .values({
        service_id: service.id,
        title: input.title,
        state: "open",
        opened_at: now,
        opened_by: authorId,
      })
      .executeTakeFirstOrThrow();
    const id = Number(created.insertId);
    await trx
      .insertInto("incident_updates")
      .values({
        incident_id: id,
        ts: now,
        author_id: authorId,
        body: input.body,
      })
      .execute();
    return id;
  });
}

/**
 * Posts an update and, when `state` is given, changes the state. The table
 * requires `resolved_at` exactly when the state is resolved, so resolving sets
 * it and any other state clears it (a reopened incident). False when the
 * incident does not exist.
 */
export async function updateIncident(
  db: Kysely<Database>,
  input: { id: number; state: IncidentState | ""; body: string },
  authorId: string | null,
  now: Date,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    const incident = await trx
      .selectFrom("incidents")
      .select(["id", "opened_at"])
      .where("id", "=", input.id)
      .forUpdate()
      .executeTakeFirst();
    if (!incident) return false;
    if (input.state !== "") {
      // Never resolve before the incident opened, whatever the clocks say.
      const at = now < incident.opened_at ? incident.opened_at : now;
      await trx
        .updateTable("incidents")
        .set({
          state: input.state,
          resolved_at: input.state === "resolved" ? at : null,
        })
        .where("id", "=", incident.id)
        .execute();
    }
    await trx
      .insertInto("incident_updates")
      .values({
        incident_id: incident.id,
        ts: now,
        author_id: authorId,
        body: input.body,
      })
      .execute();
    return true;
  });
}
