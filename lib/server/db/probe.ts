import { sql, type Kysely } from "kysely";
import type { Database } from "./schema.ts";

/**
 * `ok` when a trivial query succeeds. A failure throws; `checkReadiness`
 * turns that into "unavailable" without exposing the error text.
 */
export async function probeDatabase(db: Kysely<Database>): Promise<"ok"> {
  await sql`SELECT 1`.execute(db);
  return "ok";
}
