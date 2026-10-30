# Nexus Continuity: backups and restore verification

> **Purpose:** requirements for automatic backups, verified restores and their visibility in Nexus.
> **Audience:** builders and reviewers of Task 16. Access: Operators and above see detail; Viewers see summary health.

## Summary

Root-owned systemd timers back up every database and configuration, verify restores weekly in scratch databases, and record results. Nexus shows backup age and the last verified restore. The web application never runs backups itself.

## Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                              |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CON-01 | `nexus-backup.timer` (root) dumps each database separately (`ytl_nexus`, `nexus_mail`, `nexus_roundcube`, `nexus_sftpgo`, `nexus_wordpress`) and archives `/etc/ytl-nexus`, service configuration, WordPress uploads, Roundcube configuration, the SFTPGo data snapshot and mail storage |
| CON-02 | Archives are compressed with SHA-256 checksums in `/var/backups/nexus`, rotated to 7 daily and 4 weekly                                                                                                                                                                                  |
| CON-03 | Each run writes a `backup_runs` row through the INSERT-only `nexus_ingest` user                                                                                                                                                                                                          |
| CON-04 | `nexus-restore-test.timer` restores weekly into scratch databases, compares row counts and checksums, records `restore_tests`, then drops the scratch databases                                                                                                                          |
| CON-05 | `/continuity` shows per component: last backup age, size, status, last verified restore and restore steps                                                                                                                                                                                |
| CON-06 | A stale backup (older than 26 hours) raises a finding in Status and Shield                                                                                                                                                                                                               |
| CON-07 | The off-box copy procedure (to the owner's Mac now, a team location later) is documented in `docs/operations/backup-restore.md`                                                                                                                                                          |

## Acceptance criteria

- A real restore drill on the server succeeds.
- A corrupted archive is detected.
- A stale backup produces an alert.
- Continuity shows today's verified restore in green.

## Related

[21 Shield](21-nexus-shield.md) · [12 Status](12-nexus-status-and-operations.md) · [14 Data](14-nexus-data.md)
