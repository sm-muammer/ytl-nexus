# Nexus Mail: secure webmail

> **Purpose:** requirements for the internal mail system and the Gmail-inspired webmail experience.
> **Audience:** builders and reviewers of Task 13. This is a security-critical spec. Access: Members and above see the `/mail` entry page; mailbox access uses separate mail credentials.

## Summary

A fresh Postfix and Dovecot configuration with virtual users stored in MariaDB delivers internal mail for the domain `ytl-nexus.internal`. Roundcube at `/webmail/` provides the webmail UI with a custom Nexus skin. The old custom PHP webmail is discarded entirely.

## Requirements

| ID      | Requirement                                                                                                                                                                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| MAIL-01 | Virtual domain `ytl-nexus.internal`. Virtual users in database `nexus_mail`, not OS accounts                                                                                                                                                                                                                           |
| MAIL-02 | Password hashes: ARGON2ID if `doveadm pw -l` lists it, otherwise SHA512-CRYPT                                                                                                                                                                                                                                          |
| MAIL-03 | Delivery through Dovecot LMTP. IMAPS on 993. Submission on 587 with STARTTLS and SASL through Dovecot                                                                                                                                                                                                                  |
| MAIL-04 | Postfix `mynetworks` is loopback only. External recipients are rejected with a clear message. Port 25 is not exposed by the firewall                                                                                                                                                                                   |
| MAIL-05 | TLS certificates come from the internal CA                                                                                                                                                                                                                                                                             |
| MAIL-06 | Roundcube current stable (verified tarball) at `/webmail/` with its own PHP-FPM pool and database `nexus_roundcube`. The installer is removed after setup. Secure session settings and login rate limiting                                                                                                             |
| MAIL-07 | Skin `roundcube/skins/nexus` extends Elastic with Nexus tokens and a Gmail-inspired layout: folder rail with Compose, search bar, message list, optional reading pane, compose drawer, keyboard shortcuts, dark mode, accessible focus states. Mobile flow: folder, list, message. No Gmail branding or copied styling |
| MAIL-08 | Supported actions: read, reply, reply-all, forward, drafts, archive, trash, attachments, search and filters, flagged and unread states                                                                                                                                                                                 |
| MAIL-09 | `/mail` entry page in Nexus: service status, client settings, help (`mail_help` content), link to `/webmail/`                                                                                                                                                                                                          |
| MAIL-10 | Control lets Administrators create, disable and reset mailboxes and set quotas through a server-only database user limited to the virtual-user tables. Every action is audited                                                                                                                                         |

## Out of scope

External internet delivery (MX, SPF, DKIM, DMARC) is a roadmap item.

## Demo mode

The `/mail` entry page shows fixture status. Webmail itself is not part of demo mode; the Tour shows screenshots instead.

## Acceptance criteria

- Mail sent between two test mailboxes arrives.
- An open-relay test from the Mac fails; an external recipient is rejected.
- TLS verifies on 587 and 993.
- Roundcube login is rate limited.
- Mail flows between two Nexus mailboxes in the new interface.

## Related

[23 Control](23-nexus-control.md) · [Design language, Nexus Mail](../design-language.md#9-nexus-mail-layout)
