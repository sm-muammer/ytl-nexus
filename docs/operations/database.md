# Database

> **Purpose:** how the `ytl_nexus` database is built, protected, seeded, tested and rebuilt, and how to run it on Oracle MySQL 8 if that is ever required.
> **Audience:** developers changing the schema and the IT Infrastructure team operating Nexus Core 01.

The supervisor asked for "a MySQL database with some data". Nexus Core 01 runs **MariaDB 10.5** (MySQL-compatible), listening on `127.0.0.1:3306` only. Requirements: [Nexus Data and the platform database](../spec/14-nexus-data.md).

## What exists

| Item                 | Where                                                                                               |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| Typed schema         | `lib/server/db/schema.ts` (Kysely types, enums, table list)                                         |
| Migrations           | `lib/server/db/migrations/<timestamp>-<description>.ts`, each with `up` and `down`                  |
| Seed                 | `lib/server/db/seed/` (data and runner)                                                             |
| Users and grants     | `lib/server/db/provision.ts` (one source of truth for the tests and the server)                     |
| Application handle   | `lib/server/db/index.ts` (`getDb()`, server-only); audit writer in `audit.ts`                       |
| Command-line scripts | `scripts/db/{migrate,seed,provision}.ts`, run through `npm run`                                     |
| Server scripts       | `infrastructure/scripts/{setup-database,db-grants}`                                                 |
| Test harness         | `infrastructure/database/docker-compose.yml`, `vitest.integration.config.mts`, `tests/integration/` |

### Tables

`audit_events`, `services`, `service_dependencies`, `service_checks`, `incidents`, `incident_updates`, `backup_runs`, `restore_tests`, `shield_findings`, `data_sites`, `data_assets`, `data_tickets`, `ai_chunks`, `ai_conversations`. The Task 6 migration adds six more: Better Auth's `user`, `session`, `account`, `verification` and `twoFactor` (camel-case column names, as the library expects), and `auth_failures` (the sign-in lockout). `session.stepUpAt` is our own column. `incidents.opened_by`, `incident_updates.author_id` and `ai_conversations.user_id` now reference `user.id` (cleared or deleted with the user); `audit_events.actor_id` stays free text so the trail outlives an account. Tables are created by the migration, never by Better Auth's own CLI. Details: [Authentication, roles and audit](../security/auth.md).

All timestamps are UTC `DATETIME(3)`. Constraints in the database, not only in code: unique slugs and tags, enum columns, foreign keys, no service depending on itself, an incident is `resolved` exactly when it has a resolution time, and JSON text columns must be valid JSON.

## Users

| User            | Can do                                                                                                                    | Used by                                 |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `nexus_migrate` | Everything inside `ytl_nexus` (DDL and DML), no `GRANT OPTION`                                                            | `npm run migrate`, `npm run db:seed`    |
| `nexus_app`     | SELECT, INSERT, UPDATE, DELETE on application tables. `audit_events`: SELECT and INSERT only, so the trail is append-only | `nexus-web` (settings in `web.env`)     |
| `nexus_ingest`  | INSERT only on `backup_runs`, `restore_tests`, `shield_findings`. No SELECT, UPDATE or DELETE anywhere                    | Backup and scan reporters (later tasks) |

Accounts are tied to the host `127.0.0.1`, not `localhost`: the server runs with `skip-name-resolve`, so a `localhost` account would not match the app's TCP connection.

Four more databases exist for later modules, each with one user that can reach only that database: `nexus_mail`, `nexus_roundcube`, `nexus_sftpgo`, `nexus_wordpress` (user names equal the database names).

### Password files on the server

Created by `setup-database`; generated with `openssl rand -hex 16`; never printed, never in Git.

| File                                | Owner and mode    | Holds                                        |
| ----------------------------------- | ----------------- | -------------------------------------------- |
| `/etc/ytl-nexus/web.env`            | `root:nexus 0640` | `NEXUS_MODE` plus `nexus_app` settings       |
| `/etc/ytl-nexus/migrate.env`        | `root:nexus 0640` | `nexus_migrate` settings (deploy loads it)   |
| `/etc/ytl-nexus/app-db.env`         | `root:root 0600`  | Copy of the `nexus_app` password for re-runs |
| `/etc/ytl-nexus/ingest.env`         | `root:root 0600`  | `nexus_ingest` settings                      |
| `/etc/ytl-nexus/nexus_<module>.env` | `root:root 0600`  | One per module database                      |

To rotate one: delete its file (and, for `nexus_app`, the `NEXUS_DB_*` lines in `web.env` and `app-db.env`), run `infrastructure/scripts/server-run setup-database`, then deploy so the service restarts with the new value.

## Day-to-day commands

```bash
npm run migrate            # apply pending migrations
npm run migrate:down       # reverse the newest migration (read it first)
npm run migrate:status     # list applied and pending migrations
npm run db:seed            # load sample data; refuses if seeded tables hold rows
npm run db:seed -- --reset # replace the sample data (audit_events is kept)
```

They read `NEXUS_DB_HOST`, `NEXUS_DB_PORT`, `NEXUS_DB_NAME`, `NEXUS_DB_USER` and `NEXUS_DB_PASSWORD` ([configuration](configuration.md)). On the server:

```bash
ssh root@10.26.64.164 'cd /opt/ytl-nexus/current && runuser -u nexus -- bash -c "set -a; . /etc/ytl-nexus/migrate.env; set +a; npm run migrate:status"'
```

### Adding a migration

1. Add `lib/server/db/migrations/<yyyymmddhhmmss>-<imperative-description>.ts` exporting `up` and `down`. A file with only one of them is refused.
2. Update `lib/server/db/schema.ts`. If you added a table, add its name to `APPLICATION_TABLES` (and to the ingest list only if the ingest user must write to it).
3. Run `npm run db:test:up` and `npm run test:integration`. The up, down, up test compares column, index and constraint snapshots.
4. Deploy. `deploy.sh` migrates as `nexus_migrate`, then runs `db-grants` as root, so the new table is usable before the new release starts.

A rollback of the application does **not** reverse migrations ([rollback](rollback.md)). Keep migrations additive when you can, so the previous release still works against the new schema.

## Seed data

Deterministic and generic: 13 services with 15 dependencies, 624 service checks (48 per service over one day), 3 incidents with 7 updates, 7 backup runs, 4 restore tests, 8 Shield findings, 8 sites, 42 assets and 28 maintenance tickets. Sites are public Malaysian cities; vendors and models are public product lines. A fixed seed (`mulberry32`) and a fixed base time (2026-11-01 00:00 UTC) make two runs identical. There are no passwords, keys or tokens. `ai_chunks` and `ai_conversations` start empty; the indexer (Task 9) and the chat (Task 14) fill them. **Label the data "Demo data" wherever it is shown**: it describes a pilot, not live telemetry.

## Local test database

The Mac has Homebrew `mysql` (version 26.10), which conflicts with Homebrew `mariadb`, so tests use a container that matches the server:

```bash
npm run db:test:up        # mariadb:10.5 on 127.0.0.1:3307, data in memory
npm run test:integration  # 61 tests: migrations, seed, constraints, grants, audit, readiness, authentication, first-admin script
npm run db:test:down
```

Docker Desktop must be running (`open -a Docker`). Each test file creates its own scratch database and users and drops them afterwards. The container's root password is a throwaway for the local container only. Override with `NEXUS_TEST_DB_HOST`, `NEXUS_TEST_DB_PORT` and `NEXUS_TEST_DB_ROOT_PASSWORD`. CI runs the same tests against a `mariadb:10.5` service container.

## First-time setup on the server (done 2026-11-02)

```bash
infrastructure/scripts/server-run setup-database   # databases, users, password files
infrastructure/scripts/deploy-remote               # builds, migrates, applies grants, restarts
# then, once, on the server, as the migrate user:
#   cd /opt/ytl-nexus/current && set -a && . /etc/ytl-nexus/migrate.env && set +a && npm run db:seed
```

Check: `curl -sk https://ytl-nexus.internal/api/health/ready` returns `{"status":"ready","checks":{"app":"ok","database":"ok"}}`.

## Readiness check

`/api/health/ready` runs `SELECT 1` through `nexus_app` with a 2 second limit. In demo mode it reports `database: not-configured` and opens no connection. In live mode a missing setting, a refused connection or a timeout all give `unavailable` and HTTP 503, with no error text. If the grants are wrong, the connection fails at login, so a bad grants step also fails the deploy's health check.

## Rebuilding the database

To rebuild `ytl_nexus` from nothing (for example after a corrupted test): run `npm run migrate:down` until `migrate:status` shows everything pending, then `npm run migrate` and `npm run db:seed`. This deletes data, including edits made in Nexus Data. Take a dump first: `mariadb-dump --single-transaction ytl_nexus > /root/ytl_nexus-$(date +%F).sql` (the dump holds no secrets but keep it private anyway). Do not do this on the server without the owner's approval.

## Oracle MySQL 8 (optional)

Enable only if Logesh confirms that exact Oracle MySQL is required. MariaDB stays in place; MySQL 8 runs beside it in an isolated container, on a different loopback port, with the same dataset.

**Compatibility check, done on 2026-11-02:** the full integration suite (migrations up, down, up; seed; constraints; grants; audit) passes unchanged against `mysql:8.0` and `mariadb:10.5`. Run it yourself with `NEXUS_TEST_DB_PORT=<port> npm run test:integration` against any MySQL 8 instance whose root password is `local-test-root`.

Procedure on Nexus Core 01 (not run; Podman is not installed there yet):

```bash
# 1. Install and prepare (root). The firewall needs no change: the port stays on loopback.
dnf install -y podman
install -d -m 700 /var/lib/nexus-mysql8
openssl rand -hex 16 > /root/nexus-mysql8-root.pw && chmod 600 /root/nexus-mysql8-root.pw

# 2. Run Oracle's community server image, loopback only, data on disk.
podman run -d --name nexus-mysql8 --restart=always \
  -p 127.0.0.1:3308:3306 \
  -v /var/lib/nexus-mysql8:/var/lib/mysql:Z \
  -e MYSQL_ROOT_PASSWORD="$(cat /root/nexus-mysql8-root.pw)" \
  container-registry.oracle.com/mysql/community-server:8.0

# 3. Create the database and users with the same code the tests use.
#    Admin settings go in the environment; the three user passwords come from new files.
NEXUS_DB_HOST=127.0.0.1 NEXUS_DB_PORT=3308 NEXUS_DB_ADMIN_USER=root \
NEXUS_DB_ADMIN_PASSWORD="$(cat /root/nexus-mysql8-root.pw)" \
NEXUS_MIGRATE_DB_PASSWORD=... NEXUS_APP_DB_PASSWORD=... NEXUS_INGEST_DB_PASSWORD=... \
  npm run db:provision -- users

# 4. Same migrations and the same seed, pointed at port 3308 as nexus_migrate.
NEXUS_DB_PORT=3308 NEXUS_DB_USER=nexus_migrate NEXUS_DB_PASSWORD=... npm run migrate
NEXUS_DB_PORT=3308 NEXUS_DB_USER=nexus_migrate NEXUS_DB_PASSWORD=... npm run db:seed

# 5. Table grants.
NEXUS_DB_HOST=127.0.0.1 NEXUS_DB_PORT=3308 NEXUS_DB_ADMIN_USER=root \
NEXUS_DB_ADMIN_PASSWORD="$(cat /root/nexus-mysql8-root.pw)" \
  npm run db:provision -- grants
```

Re-running the migrations and the seed is preferred to copying a MariaDB dump: it avoids dump-format differences between the two servers. To make the app use MySQL 8, change `NEXUS_DB_PORT` and the password in `web.env` and restart `nexus-web`. Replace the `...` placeholders with generated values; do not paste passwords into chat or tickets.

Related: [Configuration](configuration.md) · [Deploy](deploy.md) · [Rollback](rollback.md) · [Nexus Data spec](../spec/14-nexus-data.md)
