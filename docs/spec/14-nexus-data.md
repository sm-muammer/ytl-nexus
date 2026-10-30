# Nexus Data and the platform database

> **Purpose:** requirements for the `ytl_nexus` database and the Nexus Data demonstration that satisfies the supervisor's database request.
> **Audience:** builders and reviewers of Tasks 5 (schema) and 11 (module). Access: Viewer reads; Operator writes.

## Summary

The supervisor asked to "install a MySQL database and input some data". MariaDB 10.5 (MySQL-compatible) hosts a dedicated `ytl_nexus` database with versioned migrations and realistic generic seed data. Nexus Data presents that data in searchable tables with audited editing.

## Database requirements

| ID    | Requirement                                                                                                                                                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-01 | Database `ytl_nexus` with least-privilege users: `nexus_app` (DML on application tables), `nexus_migrate` (DDL), `nexus_ingest` (INSERT on scan and backup tables only)                                                                                                                                 |
| DB-02 | MariaDB listens on 127.0.0.1 only                                                                                                                                                                                                                                                                       |
| DB-03 | Kysely with `mysql2`, a typed schema and SQL migrations with up and down                                                                                                                                                                                                                                |
| DB-04 | Tables: `audit_events`; `services`, `service_dependencies`; `service_checks`, `incidents`, `incident_updates`; `backup_runs`, `restore_tests`; `shield_findings`; `data_assets`, `data_sites`, `data_tickets`; `ai_chunks`; `ai_conversations`. Better Auth tables are added by its migration in Task 6 |
| DB-05 | Deterministic seed scripts with generic infrastructure assets, sites and maintenance tickets. No confidential data. No passwords, private keys or tokens in sample data                                                                                                                                 |
| DB-06 | Other databases on the same server: `nexus_mail`, `nexus_roundcube`, `nexus_sftpgo`, `nexus_wordpress`, each with its own user                                                                                                                                                                          |
| DB-07 | Oracle MySQL 8 runs in an isolated Podman container with the same dataset **only if** Logesh confirms exact Oracle MySQL is required. The procedure is documented either way                                                                                                                            |

## Nexus Data requirements

| ID     | Requirement                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| DAT-01 | `/data` shows searchable, filterable, paginated tables over `data_assets`, `data_sites` and `data_tickets` |
| DAT-02 | Operators create, update and delete records through validated Server Functions; every change is audited    |
| DAT-03 | CSV export of the current filtered view                                                                    |
| DAT-04 | A read-only schema view (tables, columns, relationships)                                                   |
| DAT-05 | A short explanation on the page of how the supervisor's request is met                                     |

## Security requirements

- Parameterized queries only (Kysely). Hostile input is rejected by Zod before reaching the database.
- CSV export escapes formula-leading characters (`=`, `+`, `-`, `@`) to prevent spreadsheet injection.

## Demo mode

In-memory fixtures with the same shape; writes are disabled with a "Demo session" explanation.

## Acceptance criteria

- Migrate up, down and up again succeeds; seed integrity and constraint tests pass.
- CRUD integration, hostile-input and SQL-injection tests pass; role gating is enforced.
- Adding a record shows it in the table and in the audit trail.
- `/api/health/ready` reports the database as healthy.

## Related

[Technology](../tech.md) · [20 Continuity](20-nexus-continuity.md)
