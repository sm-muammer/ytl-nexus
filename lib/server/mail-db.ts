import "server-only";
import { Kysely, MysqlDialect, type Generated } from "kysely";
import { createPool } from "mysql2";
import { z } from "zod";

// A minimal Kysely connection for the `nexus_mail` database. It is separate from
// the main `ytl_nexus` database, and its account (`nexus_mail_app`) can touch
// only the two virtual-mail tables (MAIL-10). The schema is in
// infrastructure/mail/schema.sql.

export type VirtualDomainRow = {
  id: Generated<number>;
  name: string;
};

export type VirtualUserRow = {
  id: Generated<number>;
  domain_id: number;
  local_part: string;
  email: string;
  /** `{SHA512-CRYPT}$6$...`. Never selected into a page. */
  password: string;
  quota_bytes: number;
  enabled: 0 | 1;
  nexus_user_id: string | null;
  created_at: Generated<Date | string>;
  updated_at: Generated<Date | string>;
};

export interface MailDatabase {
  virtual_domains: VirtualDomainRow;
  virtual_users: VirtualUserRow;
}

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
  return parsed.success ? parsed.data : null;
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

let instance: Kysely<MailDatabase> | undefined;

/** The app's shared mail database handle. Created on first use; never created in demo mode. */
export function getMailDb(): Kysely<MailDatabase> | null {
  const config = readMailDbConfig();
  if (!config) return null;
  instance ??= createMailDb(config);
  return instance;
}
