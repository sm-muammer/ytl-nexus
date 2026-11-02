import { Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import { z } from "zod";
import type { Database } from "./schema.ts";

// Connection settings and the Kysely factory. No `server-only` import here so
// the command-line scripts and integration tests can use it; the application
// reaches it through ./index.ts, which is server-only.

const configSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().regex(/^[A-Za-z0-9_]{1,64}$/),
  user: z.string().min(1).max(32),
  password: z.string().min(1),
});

export type DbConfig = z.infer<typeof configSchema>;

type Env = Record<string, string | undefined>;

/**
 * Reads NEXUS_DB_HOST, NEXUS_DB_PORT, NEXUS_DB_NAME, NEXUS_DB_USER and
 * NEXUS_DB_PASSWORD. The error names the missing variables and never echoes a
 * value, because the password is one of them.
 */
export function readDbConfig(env: Env = process.env): DbConfig {
  const parsed = configSchema.safeParse({
    host: env.NEXUS_DB_HOST ?? "127.0.0.1",
    port: env.NEXUS_DB_PORT ?? "3306",
    database: env.NEXUS_DB_NAME ?? "ytl_nexus",
    user: env.NEXUS_DB_USER,
    password: env.NEXUS_DB_PASSWORD,
  });
  if (!parsed.success) {
    const names: Record<string, string> = {
      host: "NEXUS_DB_HOST",
      port: "NEXUS_DB_PORT",
      database: "NEXUS_DB_NAME",
      user: "NEXUS_DB_USER",
      password: "NEXUS_DB_PASSWORD",
    };
    const bad = [
      ...new Set(parsed.error.issues.map((i) => names[String(i.path[0])])),
    ];
    throw new Error(
      `Database settings are missing or invalid: ${bad.join(", ")}.`,
    );
  }
  return parsed.data;
}

/** A Kysely instance over a small mysql2 pool. Call `destroy()` when done. */
export function createDb(
  config: DbConfig,
  options: { connectionLimit?: number } = {},
): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionLimit: options.connectionLimit ?? 5,
        connectTimeout: 2000,
        timezone: "Z",
        // Statements are parameterized by Kysely; a second statement can never
        // ride along in one query.
        multipleStatements: false,
      }),
    }),
  });
}
