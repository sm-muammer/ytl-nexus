// Creates the database and its users, or re-applies the table grants.
// Run as the MariaDB administrator, on the server only.
//   npm run db:provision -- users    create ytl_nexus and the three users
//   npm run db:provision -- grants   apply table grants (after migrations)
// Needs NEXUS_DB_ADMIN_SOCKET (or NEXUS_DB_ADMIN_USER and NEXUS_DB_ADMIN_PASSWORD)
// and NEXUS_{MIGRATE,APP,INGEST}_DB_PASSWORD. Nothing is printed except step names.
import { createConnection } from "mysql2/promise";
import {
  applyTableGrants,
  createDatabaseAndUsers,
  type ProvisionOptions,
} from "../../lib/server/db/provision.ts";

const env = process.env;
const need = (name: string): string => {
  const value = env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
};
// Passwords matter only when creating or rotating users.
const password = (name: string): string | undefined =>
  process.argv[2] === "users" ? need(name) : undefined;

const options: ProvisionOptions = {
  database: env.NEXUS_DB_NAME ?? "ytl_nexus",
  host: env.NEXUS_DB_USER_HOST ?? "127.0.0.1",
  migrate: {
    user: "nexus_migrate",
    password: password("NEXUS_MIGRATE_DB_PASSWORD"),
  },
  app: { user: "nexus_app", password: password("NEXUS_APP_DB_PASSWORD") },
  ingest: {
    user: "nexus_ingest",
    password: password("NEXUS_INGEST_DB_PASSWORD"),
  },
};

const step = process.argv[2];
if (step !== "users" && step !== "grants") {
  console.error("Usage: db:provision -- users|grants");
  process.exit(1);
}

const admin = await createConnection(
  env.NEXUS_DB_ADMIN_SOCKET
    ? {
        socketPath: env.NEXUS_DB_ADMIN_SOCKET,
        user: env.NEXUS_DB_ADMIN_USER ?? "root",
      }
    : {
        host: env.NEXUS_DB_HOST ?? "127.0.0.1",
        port: Number(env.NEXUS_DB_PORT ?? 3306),
        user: need("NEXUS_DB_ADMIN_USER"),
        password: need("NEXUS_DB_ADMIN_PASSWORD"),
      },
);
try {
  if (step === "users") await createDatabaseAndUsers(admin, options);
  else {
    await admin.query("USE ??", [options.database]);
    await applyTableGrants(admin, options);
  }
  console.log(`Done: ${step}`);
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Provisioning failed.",
  );
  process.exitCode = 1;
} finally {
  await admin.end();
}
