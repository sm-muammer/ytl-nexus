import type { Kysely } from "kysely";
import { sql } from "kysely";
import { FIELDS, type DataTable, type RecordValues } from "@/lib/data/tables";
import type { Database } from "@/lib/server/db/schema";

// Writes to Nexus Data (DAT-02). These functions take the database handle so
// the integration tests run them against a real MariaDB. The Server Functions in
// ./data-actions.ts check the role, validate the input and write the audit
// event; this file only changes rows. Values are bound parameters; column names
// come from the table definitions. Foreign keys and unique keys are enforced by
// the database, and their violations come back as plain outcomes.

export type WriteError =
  "not-found" | "duplicate" | "missing-reference" | "in-use";

export type WriteResult =
  { ok: true; id: number } | { ok: false; error: WriteError };

/** Maps MariaDB error codes for constraint violations; anything else is rethrown. */
function constraintError(error: unknown): WriteError | null {
  const code = (error as { code?: unknown } | null)?.code;
  switch (code) {
    case "ER_DUP_ENTRY":
      return "duplicate";
    case "ER_NO_REFERENCED_ROW_2":
      return "missing-reference";
    case "ER_ROW_IS_REFERENCED_2":
      return "in-use";
    default:
      return null;
  }
}

function columnsOf(table: DataTable, values: RecordValues): string[] {
  const allowed = new Set(FIELDS[table].map((f) => f.name));
  return Object.keys(values).filter((name) => allowed.has(name));
}

export async function createRecord(
  db: Kysely<Database>,
  table: DataTable,
  values: RecordValues,
): Promise<WriteResult> {
  const columns = columnsOf(table, values);
  try {
    const result = await sql`
      INSERT INTO ${sql.table(table)} (${sql.join(columns.map((c) => sql.ref(c)))})
      VALUES (${sql.join(columns.map((c) => sql`${values[c] ?? null}`))})`.execute(
      db,
    );
    return { ok: true, id: Number(result.insertId) };
  } catch (error) {
    const mapped = constraintError(error);
    if (mapped) return { ok: false, error: mapped };
    throw error;
  }
}

export async function updateRecord(
  db: Kysely<Database>,
  table: DataTable,
  id: number,
  values: RecordValues,
): Promise<WriteResult> {
  const columns = columnsOf(table, values);
  try {
    return await db.transaction().execute(async (trx) => {
      const found = await sql<{ id: number }>`
        SELECT id FROM ${sql.table(table)} WHERE id = ${id} FOR UPDATE`.execute(
        trx,
      );
      if (found.rows.length === 0)
        return { ok: false as const, error: "not-found" as const };
      await sql`
        UPDATE ${sql.table(table)}
        SET ${sql.join(columns.map((c) => sql`${sql.ref(c)} = ${values[c] ?? null}`))}
        WHERE id = ${id}`.execute(trx);
      return { ok: true as const, id };
    });
  } catch (error) {
    const mapped = constraintError(error);
    if (mapped) return { ok: false, error: mapped };
    throw error;
  }
}

export async function deleteRecord(
  db: Kysely<Database>,
  table: DataTable,
  id: number,
): Promise<WriteResult> {
  try {
    return await db.transaction().execute(async (trx) => {
      const found = await sql<{ id: number }>`
        SELECT id FROM ${sql.table(table)} WHERE id = ${id} FOR UPDATE`.execute(
        trx,
      );
      if (found.rows.length === 0)
        return { ok: false as const, error: "not-found" as const };
      await sql`DELETE FROM ${sql.table(table)} WHERE id = ${id}`.execute(trx);
      return { ok: true as const, id };
    });
  } catch (error) {
    const mapped = constraintError(error);
    if (mapped) return { ok: false, error: mapped };
    throw error;
  }
}
