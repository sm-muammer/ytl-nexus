import { randomBytes } from "node:crypto";
import mysql from "mysql2/promise";
import { createAuthRuntime } from "../../lib/server/auth/create-auth.ts";
import { createDb } from "../../lib/server/db/connection.ts";
import { migrateToLatest } from "../../lib/server/db/migrate.ts";
import {
  applyTableGrants,
  createDatabaseAndUsers,
} from "../../lib/server/db/provision.ts";
import { createAccount } from "../../lib/server/auth/service.ts";

// Prepares a throwaway database for the live end-to-end test
// (tests/e2e/auth-live.spec.ts): migrates it, grants the app user its rights and
// creates one account per role plus the accounts the test changes. It prints the
// environment for `next start` as KEY=VALUE lines. Everything is test data in the
// local Docker MariaDB (`npm run db:test:up`); nothing here can touch a real server.
//
//   node scripts/e2e/prepare-live.ts > /tmp/live-e2e.env      create
//   node scripts/e2e/prepare-live.ts --drop                  remove

const host = process.env.NEXUS_TEST_DB_HOST ?? "127.0.0.1";
const port = Number(process.env.NEXUS_TEST_DB_PORT ?? 3307);
const rootPassword =
  process.env.NEXUS_TEST_DB_ROOT_PASSWORD ?? "local-test-root";
const database = "nexus_live_e2e";
const user = { migrate: "nx_live_m", app: "nx_live_a", ingest: "nx_live_i" };

export const PASSWORD = "live e2e password 1";
const accounts = [
  ["viewer@example.com", "Live Viewer", "viewer"],
  ["member@example.com", "Live Member", "member"],
  ["operator@example.com", "Live Operator", "operator"],
  ["admin@example.com", "Live Administrator", "admin"],
  ["victim@example.com", "Live Victim", "member"],
  ["resetme@example.com", "Live Reset", "member"],
  ["lockme@example.com", "Live Lock", "viewer"],
] as const;

const admin = await mysql.createConnection({
  host,
  port,
  user: "root",
  password: rootPassword,
  timezone: "Z",
});
await admin.query("DROP DATABASE IF EXISTS ??", [database]);

if (process.argv.includes("--drop")) {
  for (const name of Object.values(user)) {
    await admin.query("DROP USER IF EXISTS ?@?", [name, "%"]);
  }
  await admin.end();
  console.error(`Dropped ${database}.`);
  process.exit(0);
}

const secret = () => randomBytes(16).toString("hex");
const options = {
  database,
  host: "%",
  migrate: { user: user.migrate, password: secret() },
  app: { user: user.app, password: secret() },
  ingest: { user: user.ingest, password: secret() },
};
await createDatabaseAndUsers(admin, options);

const migrateDb = createDb(
  {
    host,
    port,
    database,
    user: user.migrate,
    password: options.migrate.password,
  },
  { connectionLimit: 2 },
);
await migrateToLatest(migrateDb);
await migrateDb.destroy();
await admin.query("USE ??", [database]);
await applyTableGrants(admin, options);
await admin.end();

const appDb = {
  host,
  port,
  database,
  user: user.app,
  password: options.app.password,
};
const rt = createAuthRuntime({
  db: appDb,
  env: {
    secret: randomBytes(32).toString("hex"),
    baseURL: "http://127.0.0.1:3101",
    trustedOrigins: [],
  },
  nextCookies: false,
});
for (const [email, name, role] of accounts) {
  await createAccount(rt, { email, name, role, password: PASSWORD });
}
await rt.destroy();

const lines = [
  "NEXUS_MODE=live",
  `NEXUS_DB_HOST=${host}`,
  `NEXUS_DB_PORT=${port}`,
  `NEXUS_DB_NAME=${database}`,
  `NEXUS_DB_USER=${user.app}`,
  `NEXUS_DB_PASSWORD=${options.app.password}`,
  `BETTER_AUTH_SECRET=${randomBytes(32).toString("hex")}`,
  "BETTER_AUTH_URL=http://127.0.0.1:3101",
];
console.log(lines.join("\n"));
// Better Auth keeps a timer for its in-memory rate limiter; end the process here.
process.exit(0);
