# YTL Nexus configuration

> **Purpose:** every environment variable YTL Nexus reads, what it does and where it lives.
> **Audience:** developers running the app locally and the IT Infrastructure team configuring the server.

Variables are added to this file in the same commit that starts reading them. Secrets are named here, never shown. Locally they live in `.env.local` (Git-ignored); on Nexus Core 01 they live in `/etc/ytl-nexus/*.env` (`root:nexus`, mode 0640), loaded by the `nexus-web` systemd unit and by `deploy.sh` when it builds (Task 4). On Core 01, `/etc/ytl-nexus/web.env` currently holds `NEXUS_MODE=live` and nothing secret; the unit adds `NODE_ENV=production`, `PORT=3000` and `HOSTNAME=127.0.0.1` itself. Do not put `NODE_ENV=production` in `web.env`: the build would then skip dev dependencies and fail. See [Deploy](deploy.md).

## Variables

| Variable                | Required              | Values                                                           | Used by                                                      | Secret  |
| ----------------------- | --------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------ | ------- |
| `NEXUS_MODE`            | Yes                   | `live` or `demo`                                                 | `instrumentation.ts`, `lib/server/mode.ts`, the adapter sets | No      |
| `NEXUS_DB_HOST`         | Live mode, migrations | host name or IP, default `127.0.0.1`                             | `lib/server/db/connection.ts`                                | No      |
| `NEXUS_DB_PORT`         | No                    | default `3306`                                                   | same                                                         | No      |
| `NEXUS_DB_NAME`         | No                    | default `ytl_nexus`                                              | same                                                         | No      |
| `NEXUS_DB_USER`         | Live mode, migrations | `nexus_app` for the web app, `nexus_migrate` for scripts         | same                                                         | No      |
| `NEXUS_DB_PASSWORD`     | Live mode, migrations | the user's password                                              | same                                                         | **Yes** |
| `BETTER_AUTH_SECRET`    | Live mode             | at least 32 characters; `setup-auth` generates 64 hex characters | `lib/server/auth/create-auth.ts`                             | **Yes** |
| `BETTER_AUTH_URL`       | Live mode             | the public address, `https://ytl-nexus.ytlcomms.my` on Core 01   | same                                                         | No      |
| `NEXUS_TRUSTED_ORIGINS` | No                    | comma-separated other addresses people use                       | same                                                         | No      |

### `NEXUS_MODE`

Chooses which of the two adapter sets the server uses ([`lib/server/adapters`](../../lib/server/adapters/index.ts)).

| Value  | Behaviour                                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo` | The whole UI runs on fixtures from `lib/fixtures`. No adapter opens a network or database connection. Every value carries a "Demo data" label. A demo session switcher lets a presenter view as each role |
| `live` | Adapters talk to the real services. Authentication is real (Task 6); the others are placeholders that report "Not connected" until their module task connects them                                        |

The value must be exactly `live` or `demo` (lower case, no spaces). Anything else, or no value, stops the server at start with an error that names `NEXUS_MODE` and the accepted values. The same applies to `npm run build`, because pages read the mode while building.

Run it locally:

```bash
cp .env.example .env.local     # sets NEXUS_MODE=demo
npm run dev
```

Run the production build offline, as a portfolio demo:

```bash
NEXUS_MODE=demo npm run build && NEXUS_MODE=demo npm start
```

CI and the Playwright test server set `NEXUS_MODE=demo`.

### `NEXUS_DB_*`

Database connection settings, read only in `live` mode (and by the scripts under `scripts/db`). Demo mode never reads them and never connects. A missing or invalid value gives an error that names the variable, never its value. On Core 01, `web.env` holds `nexus_app`'s settings and `migrate.env` holds `nexus_migrate`'s; both are created by `setup-database` ([Database](database.md)). `scripts/db/provision.ts` also reads `NEXUS_DB_ADMIN_SOCKET` (or `NEXUS_DB_ADMIN_USER` and `NEXUS_DB_ADMIN_PASSWORD`), `NEXUS_{MIGRATE,APP,INGEST}_DB_PASSWORD` and `NEXUS_DB_USER_HOST` (default `127.0.0.1`); only the server administrator runs it. The integration tests read `NEXUS_TEST_DB_HOST`, `NEXUS_TEST_DB_PORT` and `NEXUS_TEST_DB_ROOT_PASSWORD`.

For local work in live mode against the test container: `NEXUS_DB_PORT=3307`, user and password from a scratch database (see [Database](database.md#local-test-database)). Most local work uses `NEXUS_MODE=demo` and needs none of these.

### Authentication

`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` and `NEXUS_TRUSTED_ORIGINS` are read in `live` mode only, the first time a request needs authentication (and by `npm run auth:create-user`). A missing or invalid value gives an error that names the variable, never its value. Demo mode never reads them.

- `BETTER_AUTH_URL` decides the cookie flags: an `https` address gives `Secure` cookies with the `__Secure-` prefix; plain `http` (local development, `http://localhost:3000`) gives ordinary ones.
- `NEXUS_TRUSTED_ORIGINS` lists the other names people reach the server by (`https://ytl-nexus.internal`, the legacy name, the IP). Better Auth's origin check accepts these for its HTTP handler.
- `BETTER_AUTH_SECRET` encrypts the stored TOTP secrets. Back it up with `web.env` and do not change it without planning to re-enrol everyone ([Authentication](../security/auth.md#the-secret)).

On Core 01 run `infrastructure/scripts/server-run setup-auth` once. It appends the three lines to `/etc/ytl-nexus/web.env` (`root:nexus`, 0640), keeps any that exist and prints only the names. For local live-mode work add the same three to `.env.local`; any 32-character string is enough for the secret there.

## WordPress (Nexus Studio)

Read in `live` mode only, by `lib/server/wordpress.ts`. Written to `/etc/ytl-nexus/web.env` by `setup-wordpress`. If a variable is missing, Library and Story show "The content service is not reachable" instead of failing. Demo mode reads none of them.

- `NEXUS_WP_URL`: the loopback reader, `http://127.0.0.1:8081/studio`.
- `NEXUS_WP_USER`: the read-only account `nexus-reader`.
- `NEXUS_WP_APP_PASSWORD`: its Application Password.
- `NEXUS_WP_WEBHOOK_SECRET`: the shared secret for `/api/revalidate` and preview links (at least 32 characters).

## Prometheus (Nexus Command)

Read in `live` mode only, by `lib/server/prometheus.ts`. Optional.

- `NEXUS_PROMETHEUS_URL`: where Prometheus listens, default `http://127.0.0.1:9090`. Installed by `setup-monitoring`; see [Monitoring](monitoring.md). Demo mode never connects.

## Operations agent (Nexus Status and Command)

Read in `live` mode only. `NEXUS_OPS_SECRET` is **secret**: at least 32 characters, shared by `nexus-web` and `nexus-ops`. It lives in `/etc/ytl-nexus/ops.env` (`root:root`, mode 0600), which systemd reads for both units, and nowhere else. `setup-ops` creates it. See [Operations agent](../security/ops-agent.md).

- `NEXUS_OPS_SECRET`: the shared HMAC secret. Read by `lib/server/ops-client.ts` and `services/ops-agent/main.ts`. Without it the Operator controls report that the agent is unavailable.
- `NEXUS_OPS_SOCKET`: the agent socket, default `/run/nexus-ops/ops.sock`.
- `NEXUS_OPS_REDACT_RANGES`: comma-separated IPv4 CIDRs masked in logs by the agent; default the private ranges and loopback.

`nexus-worker` reads only `/etc/ytl-nexus/app-db.env` (the `NEXUS_DB_*` settings of `nexus_app`), through its unit.

## SFTPGo (Nexus Transfer)

Read in `live` mode only, by `lib/server/sftpgo.ts`. Written to `/etc/ytl-nexus/web.env` by `setup-sftpgo`. If one is missing, `/transfer` and the Control section say the file transfer service does not answer. Demo mode reads none of them. See [Nexus Transfer](sftp.md).

- `NEXUS_SFTPGO_URL`: the REST API, `http://127.0.0.1:8091/api/v2`. The client accepts only `localhost`, `127.0.0.1` or `::1`, so a wrong value cannot send the key to another host.
- `NEXUS_SFTPGO_API_KEY`: **secret.** The key of the limited administrator `nexus-api`. Sent only in a request header, never in a URL, a log line or an error.
- `NEXUS_SFTPGO_HOST`: the name shown in the connection guides; defaults to the host of `BETTER_AUTH_URL`.
- `NEXUS_SFTPGO_HOME_BASE`: optional, the parent folder of account homes, default `/srv/nexus-transfer`.

## Demo session cookie

In demo mode the session switcher stores the chosen role in the HttpOnly cookie `nexus-demo-role` (values `viewer`, `member`, `operator`, `admin`; no cookie means Visitor). Only the demo auth adapter reads it, and the Server Function that sets it does nothing in `live` mode. It is a presentation aid: it changes menus and labels and grants nothing. Real access control is the guards in `lib/server/guards.ts`, which run in both modes: demo mode enforces the same role matrix on this cookie, and never touches a database or the audit trail.

Related: [Technology](../tech.md) · [Security](../security.md) · [Nexus Tour, Project Story and demo mode](../spec/22-nexus-tour-story-and-demo-mode.md)
