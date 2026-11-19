# Nexus Control: hidden administration

> **Purpose:** requirements for the Administrator-only area that manages people, accounts, service actions and the audit trail.
> **Audience:** builders and reviewers of Tasks 6 (entry) and 19 (completion). Access: authenticated Administrators.

## Summary

Nexus Control lives at `/control/*` (with dedicated User Management at `/control/users`). It is unlinked, `noindex`, and returns 404 to everyone except authenticated Administrators.

## Requirements

| ID     | Requirement                                                                                                                                                                                                                                                                                                                   |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CTL-01 | Access rules as in [10 Identity and access](10-identity-and-access.md) (IAM-05, IAM-06)                                                                                                                                                                                                                                       |
| CTL-02 | **Users and roles:** create (with optional SFTP/mail auto-provisioning), edit name, change role, review and fulfill member/operator service requests (promotions, SFTP, SSH keys, mailboxes, quotas) and stage promotions, disable, revoke sessions, reset password, force 2FA re-enrolment, delete (with email confirmation) |
| CTL-03 | **SFTP accounts:** create, disable, delete, quotas, public keys, password reset (through the SFTPGo API)                                                                                                                                                                                                                      |
| CTL-04 | **Mail accounts:** create, disable, reset password, quota (through the restricted mail database user)                                                                                                                                                                                                                         |
| CTL-05 | **Service actions:** the operations agent allowlist ([12](12-nexus-status-and-operations.md))                                                                                                                                                                                                                                 |
| CTL-06 | **Configuration view:** non-secret settings only (mode, versions, enabled modules, bindings)                                                                                                                                                                                                                                  |
| CTL-07 | **Audit viewer:** filters by actor, action, target, result and date; CSV export with formula-injection escaping                                                                                                                                                                                                               |
| CTL-08 | Every Control mutation asks for confirmation and writes an audit event                                                                                                                                                                                                                                                        |
| CTL-09 | Destructive actions name the exact target in the confirmation (for example the account email)                                                                                                                                                                                                                                 |

## Security requirements

- IDOR checks on every account operation.
- No secret value is ever displayed; secrets can only be rotated.
- No heavy motion in Control.

## Acceptance criteria

- Full role-matrix e2e passes across all modules.
- An audit completeness test proves every mutation produces an event.
- An Administrator creates a Member, gives them an SFTP account and a mailbox, and the Member can sign in and use both.

## Related

[10 Identity and access](10-identity-and-access.md) · [16 Transfer](16-nexus-transfer.md) · [17 Mail](17-nexus-mail.md)
