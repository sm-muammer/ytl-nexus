# Nexus Shield: read-only security posture

> **Purpose:** requirements for the security posture checks and how findings are shown.
> **Audience:** builders and reviewers of Task 17. Access: Operators and above at `/shield`.

## Summary

A root-owned timer inspects the server and writes findings. Nexus shows them by severity with remediation guidance. Shield reports; it never changes anything.

## Checks

| ID     | Check                                                                                                | Example finding                      |
| ------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| SHD-01 | TLS certificate expiry (web and mail)                                                                | Certificate expires in under 30 days |
| SHD-02 | Listening ports against the allowlist (22, 80, 443, 2022, 587, 993 public; everything else loopback) | Unexpected public listener           |
| SHD-03 | firewalld active with the expected zone                                                              | Firewall inactive                    |
| SHD-04 | Pending security updates                                                                             | Security updates waiting             |
| SHD-05 | Failed SSH and SFTP logins in the last 24 h                                                          | Spike in failures                    |
| SHD-06 | SSH configuration: `PermitRootLogin`, `PasswordAuthentication`                                       | Root login permitted                 |
| SHD-07 | SELinux state                                                                                        | SELinux disabled (known risk)        |
| SHD-08 | Disk usage per mount                                                                                 | Above 85 %                           |
| SHD-09 | Time synchronisation                                                                                 | Clock not synchronised               |
| SHD-10 | Backup freshness                                                                                     | Last backup older than 26 h          |
| SHD-11 | fail2ban jails active                                                                                | Jail missing                         |

## Requirements

| ID     | Requirement                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| SHD-20 | `nexus-shield-scan.timer` runs as root and writes a JSON report; `nexus-worker` ingests it into `shield_findings` |
| SHD-21 | Each finding has severity (info, low, medium, high), sanitized evidence and remediation guidance                  |
| SHD-22 | No automatic remediation and no web path to the scanner                                                           |
| SHD-23 | Root SSH login and password SSH are reported but not changed by the project (lockout risk)                        |

## Acceptance criteria

- Fixture-driven parser tests pass for every check; severity mapping is tested.
- The findings list shows the known SELinux and root-SSH risks with guidance.

## Related

[20 Continuity](20-nexus-continuity.md) · [Technology decision 11](../tech.md#4-key-design-decisions)
