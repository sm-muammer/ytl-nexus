# Operations agent (`nexus-ops`)

> **Purpose:** the only path by which Nexus can act on the server: what it accepts, how requests are authenticated, which three layers refuse everything else, and the evidence that they do.
> **Audience:** developers changing `services/ops-agent`, `lib/ops` or the Operator controls, and the IT Infrastructure team operating Nexus Core 01. The requirements are in [Nexus Status and controlled operations](../spec/12-nexus-status-and-operations.md); the day-to-day steps are in [Operations and Status](../operations/ops-and-status.md).

## What it is

`nexus-ops` is a small TypeScript service (`services/ops-agent`) that runs as the unprivileged user `nexus-ops` and listens on a Unix socket, `/run/nexus-ops/ops.sock`. The web application (`nexus-web`) is its only client. It has no dependency outside Node.js built-ins.

There is no browser shell, no arbitrary command, no root access and no firewall change through Nexus. The agent accepts exactly three operations:

| Operation           | What it does                                                                            | Who can ask through the UI |
| ------------------- | --------------------------------------------------------------------------------------- | -------------------------- |
| `restart(unit)`     | Queues `systemctl restart --no-block <unit>.service` and answers at once                | Operator, Administrator    |
| `logs(unit, lines)` | Reads the last `lines` (1 to 500) journal lines of the unit and masks sensitive values  | Operator, Administrator    |
| `health(check)`     | Runs one predefined probe on loopback and returns a state, a latency and a fixed phrase | Operator, Administrator    |

The units are fixed in `lib/ops/units.ts`: `nexus-web`, `nexus-worker`, `sftpgo`, `prometheus`. The health checks are `web`, `database`, `prometheus`, `ollama`, `sftpgo` and `mail`; each is a fixed loopback address in `lib/ops/probes.ts`. A request cannot add a unit, a check or an address.

## Three layers, each enough on its own

| Layer        | Where                                                | What it refuses                                                                                                                               |
| ------------ | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Web guard | `lib/server/ops-actions.ts`, `lib/server/policy.ts`  | Anyone below Operator; malformed input; every call in a demo session. Writes the audit events                                                 |
| 2. Agent     | `services/ops-agent/agent.ts`, `lib/ops/protocol.ts` | Bad signatures, old or future timestamps, repeated nonces, unknown operations, units outside the list, unit-name tricks, `lines` out of range |
| 3. polkit    | `infrastructure/polkit/50-nexus-ops.rules`           | Everything except verb `restart` on the four `.service` units for user `nexus-ops`, including actions the agent never asks for                |

## Transport and authentication

- The socket directory `/run/nexus-ops` is created by systemd (`RuntimeDirectory=nexus-ops`, mode 0750), owned by `nexus-ops` with group `nexus-ops-clients`. The socket is mode 0660. The only member of `nexus-ops-clients` is the `nexus` user that runs `nexus-web`. Another local user gets `EACCES`.
- The unit sets `User=nexus-ops` and `Group=nexus-ops-clients`, so the process runs with that group as its primary group without `nexus-ops` being a member in `/etc/group`. `SupplementaryGroups=systemd-journal` lets it read the journal and gives it nothing else.
- Each request is `POST /v1/request` with a JSON envelope `{ req, ts, nonce, sig }`. `sig` is the hex HMAC-SHA256, with the shared secret, of `v1`, the timestamp, the nonce and the canonical JSON of `req` (keys sorted), separated by newlines.
- The agent answers `auth-failure` (HTTP 401) unless the signature matches (constant-time comparison), `ts` is within 30 seconds of the agent's clock, and the nonce was not accepted in the previous 60 seconds. The nonce is recorded only after the signature checks out, so a forger cannot fill the cache; a full cache (10,000 entries) refuses requests, never accepts them.
- Only then is `req` validated. The validation is exact and case-sensitive: the object has exactly the keys of its operation, `unit` and `check` equal an entry of the lists, and `lines` is an integer from 1 to 500. Anything else is `invalid-request` (HTTP 400), and nothing runs.
- The request body is limited to 4,096 bytes. The agent starts `systemctl` and `journalctl` with `execFile` and an argument array, never through a shell. The only variable parts are an allowlisted unit name and an integer.
- Responses never contain a host name, address, path or system error text. A failure is the code `failed` and nothing else.

## The shared secret

`NEXUS_OPS_SECRET` (at least 32 characters) lives in `/etc/ytl-nexus/ops.env`, owner `root:root`, mode 0600. systemd reads the file as root (`EnvironmentFile=`) for `nexus-ops` and `nexus-web`, so no service user can read it from disk. It is not in Git, logs, chat or `NEXT_PUBLIC_` variables. `setup-ops` creates it with `openssl rand -hex 32` and never prints it. To rotate it, see [Operations and Status](../operations/ops-and-status.md#rotate-the-shared-secret).

## What gets audited

For every log view, health check and confirmed restart, `nexus-web` writes two events to `audit_events`: `ops.<operation>.request` (written before the agent is called) and `ops.<operation>` (the result: `success` or `failure`). The target is `unit:<name>` or `check:<name>`. A refusal at the web guard (a Viewer posting to the Server Function, for example) is one `refused` event. The agent itself writes one line per request to the journal (operation, target, `ok`, `failed`, `invalid-request` or `auth-failure`) and never a secret.

A restart result of `success` means the agent accepted the request and queued the restart. It does not wait for the unit (OPS-07), so `nexus-web` can restart itself. Run a health check a few seconds later to see the outcome.

## Log sanitizer

`redactLog` (`lib/ops/redact.ts`) runs in the agent, before text leaves it. It replaces with `[redacted]`: private-key blocks, credentials in URLs, authorization and cookie lines, bearer tokens, `name=value` pairs whose name suggests a secret (password, secret, token, key, session, auth, signature), JWTs, hex strings of 32 or more characters and tokens of 40 or more, email addresses, the shared secret itself, and IPv4 addresses inside the configured ranges. The ranges default to the private ranges and loopback; set `NEXUS_OPS_REDACT_RANGES` in `ops.env` to change them. IPv6 addresses are not masked. The sanitizer is deliberately over-eager: it may hide a harmless value, never a sensitive one. Output is also capped at 128 KB and 2,000 characters per line.

## Sandbox

`systemd-analyze security` on Core 01 (2026-11-11): `nexus-ops` 1.6 and `nexus-worker` 1.5, both OK. `nexus-ops` has `NoNewPrivileges`, `ProtectSystem=strict`, no writable path, no capabilities, `IPAddressDeny=any` with `IPAddressAllow=localhost`, and a system-call filter. `MemoryDenyWriteExecute` stays off because V8 needs writable and executable memory.

## Verification on the server

`infrastructure/scripts/server-run verify-ops` runs the acceptance checks against the real agent, socket and polkit. Result on 2026-11-11 against Nexus Core 01 (sn1lyvx1d0002, 10.26.64.164): **47 passed, 0 failed**.

| Check                                                                                                                                     | Result |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Socket `nexus-ops:nexus-ops-clients` mode 0660; group lists only `nexus`; user `apache` gets `EACCES`; user `nexus` is answered           | Passed |
| Restart of `sshd`, `mariadb`, `httpd`, `../sshd`, `nexus-web@1`, `nexus-*`, `nexus-web.service`, `NEXUS-WEB`, `nexus-ops` refused         | Passed |
| `logs` with 501 lines and an unknown operation refused                                                                                    | Passed |
| Bad signature, timestamp 60 s old, another secret, and a repeated nonce refused; a fresh nonce accepted                                   | Passed |
| Health checks `web`, `database`, `prometheus`, `ollama`, `mail` return `healthy`; the server address is masked in logs                    | Passed |
| Restart of `nexus-worker` through the agent: accepted, the unit restarted and is active again                                             | Passed |
| polkit (asked about the agent's own process, user `nexus-ops`): restart of the four allowlisted units allowed                             | Passed |
| polkit: restart of `sshd`, `mariadb`, `httpd`, `firewalld`, `nexus-ops`, `polkit` denied; `start`, `stop`, `reload` of `nexus-web` denied | Passed |
| A real `systemctl restart` of a non-allowlisted unit as `nexus-ops` is denied by polkit                                                   | Passed |

The unit tests run the real polkit rule file against a fake polkit object (`tests/unit/infrastructure/ops-config.test.ts`), the protocol as properties (`tests/unit/ops-protocol.test.ts`), the sanitizer (`tests/unit/ops-redact.test.ts`), the client against the real HTTP layer on a Unix socket (`tests/unit/ops-client.test.ts`) and the audit pairs (`tests/unit/ops-actions.test.ts`).

## Known limits

- Clock: the agent and `nexus-web` run on the same host, so the 30-second window assumes one clock. `chronyd` keeps it synchronised.
- A compromised `nexus-web` can ask the agent for the same three operations on the same four units. It cannot widen them, and it cannot reach polkit directly. This is the residual risk the design accepts.
- The agent does not rate-limit restarts. The web layer allows them to Operators and Administrators only, and every one is audited.
- Browser verification of the Operator panel with a real Operator account over HTTPS was not run (it needs an account with an authenticator). The panel is covered by unit and end-to-end tests in demo mode, and the whole path below it by `verify-ops`.
