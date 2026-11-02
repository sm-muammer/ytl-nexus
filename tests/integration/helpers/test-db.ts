import { randomBytes } from "node:crypto";
import mysql, { type Connection } from "mysql2/promise";
import type { Kysely } from "kysely";
import { createDb, type DbConfig } from "@/lib/server/db/connection";
import {
  applyTableGrants,
  createDatabaseAndUsers,
  type ProvisionOptions,
} from "@/lib/server/db/provision";
import { migrateToLatest } from "@/lib/server/db/migrate";
import type { Database } from "@/lib/server/db/schema";

// A scratch database with its own three users, so test files can run in
// parallel and never touch each other or a real `ytl_nexus`.
// The local container is `npm run db:test:up` (MariaDB 10.5 on 127.0.0.1:3307).

const host = process.env.NEXUS_TEST_DB_HOST ?? "127.0.0.1";
const port = Number(process.env.NEXUS_TEST_DB_PORT ?? 3307);
const rootPassword =
  process.env.NEXUS_TEST_DB_ROOT_PASSWORD ?? "local-test-root";

export interface ScratchDatabase {
  name: string;
  admin: Connection;
  options: ProvisionOptions;
  /** Kysely handles per user. */
  migrate: Kysely<Database>;
  app: Kysely<Database>;
  ingest: Kysely<Database>;
  config(user: "migrate" | "app" | "ingest"): DbConfig;
  /** Creates the tables and applies the grants. */
  prepare(): Promise<void>;
  drop(): Promise<void>;
}

export async function createScratchDatabase(): Promise<ScratchDatabase> {
  const id = randomBytes(4).toString("hex");
  const name = `nx_t_${id}`;
  const options: ProvisionOptions = {
    database: name,
    host: "%",
    migrate: {
      user: `nx_m_${id}`,
      password: `m-${randomBytes(12).toString("hex")}`,
    },
    app: {
      user: `nx_a_${id}`,
      password: `a-${randomBytes(12).toString("hex")}`,
    },
    ingest: {
      user: `nx_i_${id}`,
      password: `i-${randomBytes(12).toString("hex")}`,
    },
  };
  const admin = await mysql.createConnection({
    host,
    port,
    user: "root",
    password: rootPassword,
    timezone: "Z",
  });
  await createDatabaseAndUsers(admin, options);

  const config = (user: "migrate" | "app" | "ingest"): DbConfig => ({
    host,
    port,
    database: name,
    user: options[user].user,
    password: options[user].password as string,
  });
  const handles: Kysely<Database>[] = [];
  const open = (user: "migrate" | "app" | "ingest") => {
    const db = createDb(config(user), { connectionLimit: 2 });
    handles.push(db);
    return db;
  };
  const migrate = open("migrate");
  const app = open("app");
  const ingest = open("ingest");

  return {
    name,
    admin,
    options,
    migrate,
    app,
    ingest,
    config,
    async prepare() {
      await migrateToLatest(migrate);
      await admin.query("USE ??", [name]);
      await applyTableGrants(admin, options);
    },
    async drop() {
      await Promise.all(handles.map((h) => h.destroy()));
      await admin.query("DROP DATABASE IF EXISTS ??", [name]);
      for (const user of [options.migrate, options.app, options.ingest]) {
        await admin.query("DROP USER IF EXISTS ?@?", [user.user, "%"]);
      }
      await admin.end();
    },
  };
}

/** Columns, indexes and constraints of every table, as comparable text. */
export async function schemaSnapshot(
  admin: Connection,
  database: string,
): Promise<string> {
  const q = async (sqlText: string) =>
    (await admin.query(sqlText, [database]))[0] as Record<string, unknown>[];
  const columns = await q(
    "SELECT TABLE_NAME, ORDINAL_POSITION, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME NOT LIKE 'kysely%' ORDER BY TABLE_NAME, ORDINAL_POSITION",
  );
  const indexes = await q(
    "SELECT TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX, COLUMN_NAME, NON_UNIQUE FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = ? AND TABLE_NAME NOT LIKE 'kysely%' ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX",
  );
  const constraints = await q(
    "SELECT TABLE_NAME, CONSTRAINT_NAME, CONSTRAINT_TYPE FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? AND TABLE_NAME NOT LIKE 'kysely%' ORDER BY TABLE_NAME, CONSTRAINT_NAME",
  );
  const checks = await q(
    "SELECT CONSTRAINT_NAME, CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = ? ORDER BY CONSTRAINT_NAME",
  );
  return JSON.stringify({ columns, indexes, constraints, checks });
}
