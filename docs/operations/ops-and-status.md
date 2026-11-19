# Operations and Status

> **Purpose:** run, check and troubleshoot the operations agent, the service-check worker and the Nexus Status page on Nexus Core 01.
> **Audience:** the IT Infrastructure team. The design and the security argument are in [Operations agent](../security/ops-agent.md); the requirements are in [spec 12](../spec/12-nexus-status-and-operations.md).

## What runs

| Unit           | User        | Code                         | Does                                                                                      |
| -------------- | ----------- | ---------------------------- | ----------------------------------------------------------------------------------------- |
| `nexus-ops`    | `nexus-ops` | `services/ops-agent/main.ts` | Answers signed restart, log and health requests on `/run/nexus-ops/ops.sock`              |
| `nexus-worker` | `nexus`     | `services/worker/main.ts`    | Probes 8 services every 60 seconds into `service_checks`; deletes rows older than 35 days |
| `nexus-web`    | `nexus`     | the Next.js app              | `/status`, the Operator controls on `/command/services`, incident forms                   |

All three run the code in `/opt/ytl-nexus/current`. `deploy.sh` restarts `nexus-web`, then `nexus-worker` and `nexus-ops` when they are enabled, so a deploy updates all three.

## Install (once)

1. Deploy a release that contains `services/ops-agent` and `services/worker`: `infrastructure/scripts/deploy-remote`.
2. Run `infrastructure/scripts/server-run setup-ops`. It creates the user `nexus-ops`, the group `nexus-ops-clients` (member: `nexus`), `/etc/ytl-nexus/ops.env` with a new secret, the polkit rule `/etc/polkit-1/rules.d/50-nexus-ops.rules` and the units, then starts them and restarts `nexus-web` once. Running it again keeps the secret and the accounts.
3. Check it: `infrastructure/scripts/server-run verify-ops` (47 checks) and `infrastructure/scripts/smoke-test`.

## Use it

- **Status page:** `https://ytl-nexus.ytlcomms.my/status`. A Visitor sees service names and states. A signed-in Viewer, Member, Operator or Administrator also sees uptime over 24 hours, 7 days and 30 days, the last 24 hours as a strip, incidents and their updates. WordPress `announcement` items appear as maintenance notices.
- **States:** Operational, Degraded (slow or unexpected reply), Down (no answer), **Stale** (the last result is older than 5 minutes) and **Unknown** (no check has run). A service without a predefined check shows Unknown, not Operational. Services not installed yet (Dovecot, Roundcube) and services with no port to probe (PHP-FPM, chrony) have no check; add one in `lib/status/checks.ts` when the module that installs it ships.
- **Incidents and ticket tracking:** an Operator or Administrator opens an incident on `/status` (service, title, first message), posts updates and moves it through Open, Investigating, Monitoring and Resolved. Every incident automatically receives a unique ticket number (`INC-YYYY-NNNN`) derived from its UTC opening year and database sequence (`openIncident` transaction, backfilled for pre-existing rows by migration `20261119100000-add-incident-ticket-no`). Signed-in Viewers and above can copy the ticket number or shareable link, search by ticket number on `/status` or Command Palette (<kbd>Cmd</kbd>+<kbd>K</kbd>), and view full status progress and update history at `/status/incidents/<ticket>` (even after 30 days). Visitors never see incidents or ticket numbers. Resolving sets the resolution time; moving it back clears it. Every change is audited (`status.incident.open`, `status.incident.update`).
- **Operator controls:** on `/command/services`, below the service table, Operators and Administrators get three forms: run a health check, show the last 1 to 500 log lines of one of four services, and restart one of them. Restart asks for confirmation in a dialog. Each action writes a request event and a result event to the audit trail (`/control` shows the audit trail in a later task; until then read `audit_events`).

```
mariadb -e "SELECT ts, actor_id, role, action, target, result FROM ytl_nexus.audit_events WHERE action LIKE 'ops.%' ORDER BY id DESC LIMIT 20"
```

## Check by hand

```
ssh root@10.26.64.164 'systemctl status nexus-ops nexus-worker --no-pager'
ssh root@10.26.64.164 'journalctl -u nexus-ops -u nexus-worker --since "10 minutes ago" -o cat'
ssh root@10.26.64.164 'mariadb -e "SELECT s.slug, c.state, c.latency_ms, c.checked_at FROM ytl_nexus.service_checks c JOIN ytl_nexus.services s ON s.id = c.service_id WHERE c.checked_at > UTC_TIMESTAMP() - INTERVAL 5 MINUTE ORDER BY c.id DESC LIMIT 16"'
```

Timestamps in the database are UTC; the server clock is UTC+8.

## When something is wrong

| You see                                                      | Likely cause                                                 | What to do                                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| "The operations agent does not answer" in the Operator forms | `nexus-ops` is stopped, or `nexus-web` has not got the group | `systemctl status nexus-ops`; `id nexus` must list `nexus-ops-clients`; `systemctl restart nexus-web` after `usermod`. Run `verify-ops` |
| "did not accept the request signature"                       | The secret differs, or the clocks differ by over 30 seconds  | Restart both units after a rotation; `chronyc tracking`                                                                                 |
| "refused this request ... not on its allowlist"              | The unit is not one of the four                              | Expected. Nothing ran. The audit shows the request and the failure                                                                      |
| Every service shows Stale                                    | `nexus-worker` is down or cannot reach the database          | `journalctl -u nexus-worker`; check `app-db.env` and MariaDB                                                                            |
| One service shows Down                                       | Its port does not answer                                     | Check the unit (`systemctl status <unit>`), then open an incident on `/status`                                                          |
| Restart "was accepted" but the service is not back           | The unit failed to start                                     | `journalctl -u <unit> -n 50`; the Operator log viewer shows the same lines, masked                                                      |
| polkit denied a restart you expected                         | The unit is not in `50-nexus-ops.rules`                      | The rule and `lib/ops/units.ts` must list the same four units; a unit test compares them                                                |

## Rotate the shared secret

1. `NEW=$(openssl rand -hex 32)`; replace the `NEXUS_OPS_SECRET=` line in `/etc/ytl-nexus/ops.env` (keep owner `root:root`, mode 0600). Do not paste the value into chat or tickets.
2. `systemctl restart nexus-ops nexus-web` (the agent first, then the web).
3. Run `infrastructure/scripts/server-run verify-ops`.

## Add a unit to the allowlist

Change all of: `lib/ops/units.ts`, the `allowed` list in `infrastructure/polkit/50-nexus-ops.rules`, and the tests. Then run `setup-ops` to install the rule. A unit test fails if the rule and the code disagree. Anything that is not a Nexus-owned or Nexus-managed service (`sshd`, `mariadb`, `httpd`, `firewalld`) does not belong on the list.

## Remove the Task 5 sample data

The Task 5 seed put invented health checks and incidents in the database. `/status` shows these tables as Live, so remove them once:

```
infrastructure/scripts/server-run clear-sample-status-data          # prints the plan, deletes nothing
infrastructure/scripts/server-run clear-sample-status-data --yes    # backs up to /root, then deletes
```

It deletes `service_checks` before 2026-11-10 (624 rows), the 3 incidents with no author and their 7 updates, after writing a dump of exactly those rows to `/root/nexus-sample-status-backup-<time>.sql`. The 13 service rows and the worker's checks stay. To restore: `mariadb ytl_nexus < <that file>`.
