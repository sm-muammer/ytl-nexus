import type { Connection } from "mysql2/promise";
import { z } from "zod";
import { APPLICATION_TABLES } from "./schema.ts";

// Creates the database and its three users, then applies the table grants.
// Run with an administrator connection (root on the server, the throwaway root
// of the local container in tests). The application never runs this.
//
//   nexus_migrate  every privilege on the database, no GRANT OPTION (DDL)
//   nexus_app      SELECT, INSERT, UPDATE, DELETE on application tables;
//                  audit_events is SELECT and INSERT only (append-only)
//   nexus_ingest   INSERT only on the scan and backup tables

const identifier = z.string().regex(/^[A-Za-z0-9_]{1,32}$/);

// Passwords are needed only to create or rotate users; the grants step ignores them.
const accountSchema = z.object({
  user: identifier,
  password: z.string().min(16).optional(),
});

const optionsSchema = z.object({
  database: identifier,
  // The server runs with skip-name-resolve, so a 'localhost' account would not
  // match the app's TCP connection to 127.0.0.1. Accounts are tied to the IP.
  host: z
    .string()
    .regex(/^[A-Za-z0-9_.%:-]{1,60}$/)
    .default("127.0.0.1"),
  migrate: accountSchema,
  app: accountSchema,
  ingest: accountSchema,
});

export type ProvisionOptions = z.input<typeof optionsSchema>;

/** Tables the `nexus_ingest` user may insert into. */
export const INGEST_TABLES = [
  "backup_runs",
  "restore_tests",
  "shield_findings",
] as const;

/** Tables where `nexus_app` may not update or delete rows. */
export const APPEND_ONLY_TABLES = ["audit_events"] as const;

/** Creates the database and users. Safe to run again; it also rotates passwords. */
export async function createDatabaseAndUsers(
  admin: Connection,
  rawOptions: ProvisionOptions,
): Promise<void> {
  const o = optionsSchema.parse(rawOptions);
  await admin.query(
    "CREATE DATABASE IF NOT EXISTS ?? CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    [o.database],
  );
  for (const account of [o.migrate, o.app, o.ingest]) {
    if (!account.password) {
      throw new Error(
        `A password of 16 or more characters is required for ${account.user}.`,
      );
    }
    await admin.query("CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?", [
      account.user,
      o.host,
      account.password,
    ]);
    await admin.query("ALTER USER ?@? IDENTIFIED BY ?", [
      account.user,
      o.host,
      account.password,
    ]);
  }
  await admin.query("REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@?", [
    o.migrate.user,
    o.host,
  ]);
  await admin.query("GRANT ALL PRIVILEGES ON ??.* TO ?@?", [
    o.database,
    o.migrate.user,
    o.host,
  ]);
}

/**
 * Applies the table-level grants for `nexus_app` and `nexus_ingest`. Run it
 * after the migrations, and again whenever a migration adds a table. Each run
 * first removes every earlier privilege of the two users, so the result is
 * exactly the list below and nothing is left over.
 */
export async function applyTableGrants(
  admin: Connection,
  rawOptions: ProvisionOptions,
): Promise<void> {
  const o = optionsSchema.parse(rawOptions);
  for (const account of [o.app, o.ingest]) {
    await admin.query("REVOKE ALL PRIVILEGES, GRANT OPTION FROM ?@?", [
      account.user,
      o.host,
    ]);
  }
  for (const table of APPLICATION_TABLES) {
    const privileges = (APPEND_ONLY_TABLES as readonly string[]).includes(table)
      ? "SELECT, INSERT"
      : "SELECT, INSERT, UPDATE, DELETE";
    await admin.query(`GRANT ${privileges} ON ??.?? TO ?@?`, [
      o.database,
      table,
      o.app.user,
      o.host,
    ]);
  }
  for (const table of INGEST_TABLES) {
    await admin.query("GRANT INSERT ON ??.?? TO ?@?", [
      o.database,
      table,
      o.ingest.user,
      o.host,
    ]);
  }
  await admin.query("FLUSH PRIVILEGES");
}
