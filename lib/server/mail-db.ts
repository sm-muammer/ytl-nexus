import "server-only";
import { Kysely, MysqlDialect } from "kysely";
import { createPool } from "mysql2";
import { z } from "zod";

// A minimal Kysely connection for the `nexus_mail` database (virtual_domains,
// virtual_users, virtual_aliases). Separate from the main `ytl_nexus` DB so the
// mail user has the minimum possible privileges (MAIL-10).

// ---- Schema ------------------------------------------------------------------

export type VirtualDomainRow = {
  id: number;
  name: string;
};

export type VirtualUserRow = {
  id: number;
  domain_id: number;
  username: string;
  password: string;
  enabled: 0 | 1;
  quota_bytes: number;
  used_bytes: number | null;
  nexus_user_id: string | null;
  created_at: Date | string | null;
};

export type VirtualAliasRow = {
  id: number;
  domain_id: number;
  source: string;
  destination: string;
};

export interface MailDatabase {
  virtual_domains: VirtualDomainRow;
  virtual_users: VirtualUserRow;
  virtual_aliases: VirtualAliasRow;
}

// ---- Config ------------------------------------------------------------------

const configSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  database: z.string().regex(/^[A-Za-z0-9_]{1,64}$/),
  user: z.string().min(1).max(32),
  password: z.string().min(1),
});

export type MailDbConfig = z.infer<typeof configSchema>;

type Env = Record<string, string | undefined>;

/** Reads NEXUS_MAIL_DB_* from the environment, or null if not configured. */
export function readMailDbConfig(env: Env = process.env): MailDbConfig | null {
  const parsed = configSchema.safeParse({
    host: env.NEXUS_MAIL_DB_HOST ?? "127.0.0.1",
    port: env.NEXUS_MAIL_DB_PORT ?? "3306",
    database: env.NEXUS_MAIL_DB_NAME ?? "nexus_mail",
    user: env.NEXUS_MAIL_DB_USER,
    password: env.NEXUS_MAIL_DB_PASSWORD,
  });
  if (!parsed.success) return null;
  return parsed.data;
}

/** A Kysely instance over the nexus_mail database. Call `destroy()` when done. */
export function createMailDb(config: MailDbConfig): Kysely<MailDatabase> {
  return new Kysely<MailDatabase>({
    dialect: new MysqlDialect({
      pool: createPool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
        connectionLimit: 3,
        connectTimeout: 2000,
        timezone: "Z",
        multipleStatements: false,
      }),
    }),
  });
}

// ---- Singleton ---------------------------------------------------------------

let instance: Kysely<MailDatabase> | undefined;

/** The app's mail database handle. Created on first use; never created in demo mode. */
export function getMailDb(): Kysely<MailDatabase> {
  const config = readMailDbConfig();
  if (!config) throw new Error("Mail database is not configured.");
  instance ??= createMailDb(config);
  return instance;
}
