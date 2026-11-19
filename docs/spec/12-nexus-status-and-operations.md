# Nexus Status and controlled operations

> **Purpose:** requirements for health history, incidents, and the only path by which Nexus can act on the server.
> **Audience:** builders and reviewers of Task 9. This is a security-critical spec.

## Summary

Nexus Status records service health over time and tracks incidents. Controlled operations let Operators run predefined health checks, read bounded logs and restart Nexus-owned services through the `nexus-ops` agent. Nothing else can change the server from the browser.

## Nexus Status requirements

| ID     | Requirement                                                                                                                                                                                 |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STA-01 | `nexus-worker` runs predefined service checks every 60 s and stores results in `service_checks`                                                                                             |
| STA-02 | Uptime per service is computed for 24 h, 7 d and 30 d                                                                                                                                       |
| STA-03 | `/status` shows Visitors a sanitized summary (service names and states only, no hosts, IPs or errors)                                                                                       |
| STA-04 | Viewers and above see full history, incidents, incident ticket numbers and incident updates                                                                                                 |
| STA-05 | Operators and Administrators can open, update and resolve incidents; every change is audited                                                                                                |
| STA-06 | WordPress `announcement` items appear as maintenance notices                                                                                                                                |
| STA-07 | Every incident receives an auto-generated ticket number (`INC-YYYY-NNNN`), trackable at `/status/incidents/<ticket>` by Viewers and above (including resolved incidents older than 30 days) |

## Operations agent requirements

| ID     | Requirement                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OPS-01 | `nexus-ops` is a small TypeScript service running as the unprivileged `nexus-ops` user, listening on a Unix socket in `/run/nexus-ops/` owned by group `nexus-ops-clients`. Only the `nexus-web` service user belongs to that group |
| OPS-02 | Requests are HMAC-signed with a shared secret and carry a timestamp (±30 s) and a single-use nonce                                                                                                                                  |
| OPS-03 | The request schema accepts exactly three operations: `restart(unit)`, `logs(unit, lines ≤ 500)` and `health(check)`                                                                                                                 |
| OPS-04 | The unit allowlist is fixed: `nexus-web`, `nexus-worker`, `sftpgo`, `prometheus`. It lives in code and configuration; requests cannot extend it                                                                                     |
| OPS-05 | A polkit JavaScript rule allows only user `nexus-ops`, verb `restart`, on the allowlisted units                                                                                                                                     |
| OPS-06 | Log output is sanitized (secrets, tokens, email addresses and configured IP ranges masked) before it leaves the agent                                                                                                               |
| OPS-07 | Restarts run asynchronously so `nexus-web` can restart itself and report the result afterwards                                                                                                                                      |
| OPS-08 | Operator UI: log viewer, health-check runner, restart with a confirmation dialog. Every request and result is audited                                                                                                               |

## Security requirements

- No browser shell, no arbitrary commands, no root through Nexus, no firewall changes through Nexus.
- The agent rejects unknown operations, unknown units, unit-name tricks (`../`, `@`, globbing, other suffixes) and replayed or expired requests.

## Demo mode

Status uses fixture history and incidents. Operations controls are visible but disabled with a "Demo session" explanation.

## Acceptance criteria

- Allowlist rejection tests (`sshd`, `mariadb`, path tricks, unit-name injection) pass.
- Bad signatures, replayed nonces and expired timestamps are rejected.
- Sanitizer fixtures pass.
- On the server, polkit denies a restart of a non-allowlisted unit.
- An Operator restarts `nexus-worker`; a disallowed unit is refused; both appear in the audit.

## Related

[11 Command](11-nexus-command.md) · [13 Atlas](13-nexus-atlas.md) · [Technology decision 3](../tech.md#4-key-design-decisions)
