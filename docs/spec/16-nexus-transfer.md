# Nexus Transfer: secure SFTP and file portal

> **Purpose:** requirements for SFTP with password and key login, the browser file portal, and account management.
> **Audience:** builders and reviewers of Task 12. This is a security-critical spec. Access: Members see their own account; Administrators manage accounts in Control.

## Summary

SFTPGo provides SFTP on port 2022 and a browser WebClient at `/files/`. Nexus shows connection guides and account status at `/transfer`, and Administrators manage accounts, keys and quotas from Control through the SFTPGo REST API.

## Requirements

| ID     | Requirement                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TRF-01 | SFTPGo from the official YUM repository, running as the unprivileged `sftpgo` user, with MariaDB data provider `nexus_sftpgo`                                |
| TRF-02 | SFTP on port 2022. SSH stays on 22. FTP and WebDAV are disabled                                                                                              |
| TRF-03 | Password and multiple public-key authentication per user                                                                                                     |
| TRF-04 | Per-user isolated home directories under `/srv/nexus-transfer` (dedicated `sdb` volume, mounted `nosuid,nodev,noexec`). Users cannot `chmod` or `chown`      |
| TRF-05 | Per-user quotas; built-in defender and per-protocol rate limits enabled                                                                                      |
| TRF-06 | HTTP binding 127.0.0.1:8090 serves only the WebClient, published by Apache at `/files/`                                                                      |
| TRF-07 | HTTP binding 127.0.0.1:8091 serves WebAdmin and the REST API. It is never proxied; Administrators reach WebAdmin through an SSH tunnel as break-glass access |
| TRF-08 | Nexus uses a server-only SFTPGo API client with an API key from the environment file                                                                         |
| TRF-09 | `/transfer` shows connection guides (WinSCP, FileZilla, Cyberduck, terminal `sftp -P 2022`), the Member's quota and registered keys, and a link to `/files/` |
| TRF-10 | Control lets Administrators create, disable and delete accounts, set quotas, add and remove public keys and reset passwords. Every action is audited         |
| TRF-11 | SFTPGo metrics are scraped by Prometheus                                                                                                                     |
| TRF-12 | SFTPGo UI code and theme are never copied into Nexus (proprietary theme licence)                                                                             |

## Security requirements

- Path traversal outside a user's home is impossible over SFTP and WebClient.
- Members see only their own account data; account IDs in requests are checked against the session (no IDOR).
- Existing Linux users do not automatically receive SFTP accounts.

## Demo mode

Fixture account, quota and keys; management controls disabled.

## Acceptance criteria

- Integration tests with a test user over password and key auth pass.
- Path-escape attempts fail; quota is enforced; defender locks out repeated failures.
- Control actions appear in the audit.
- `sftp -P 2022` with a key works, a browser upload works, and the quota updates in Nexus.

## Related

[23 Control](23-nexus-control.md) · [10 Identity and access](10-identity-and-access.md)
