import "server-only";
import type { Kysely } from "kysely";
import { createDb, readDbConfig } from "./connection.ts";
import type { Database } from "./schema.ts";

export type { Database } from "./schema.ts";

let instance: Kysely<Database> | undefined;

/**
 * The application's database handle (user `nexus_app`). Created on first use so
 * demo mode, builds and tests that never touch the database never open a pool.
 */
export function getDb(): Kysely<Database> {
  instance ??= createDb(readDbConfig());
  return instance;
}
