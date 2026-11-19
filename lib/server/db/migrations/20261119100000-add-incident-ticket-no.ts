import { sql, type Kysely } from "kysely";
import { formatIncidentTicketNo } from "../../../status/tickets.ts";

// Adds an auto-generated unique ticket number (`INC-YYYY-NNNN`) to every
// incident and backfills all existing rows deterministically from `opened_at`
// and `id`.

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE incidents
      ADD COLUMN ticket_no VARCHAR(24) NULL AFTER id
  `.execute(db);

  const existing = await sql<{ id: number; opened_at: Date | string }>`
    SELECT id, opened_at
    FROM incidents
    WHERE ticket_no IS NULL
    ORDER BY id ASC
  `.execute(db);

  for (const row of existing.rows) {
    const id = Number(row.id);
    const ticketNo = formatIncidentTicketNo(new Date(row.opened_at), id);
    await sql`
      UPDATE incidents
      SET ticket_no = ${ticketNo}
      WHERE id = ${id}
    `.execute(db);
  }

  await sql`
    ALTER TABLE incidents
      MODIFY COLUMN ticket_no VARCHAR(24) NOT NULL,
      ADD UNIQUE KEY incidents_ticket_no (ticket_no)
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    ALTER TABLE incidents
      DROP INDEX incidents_ticket_no,
      DROP COLUMN ticket_no
  `.execute(db);
}
