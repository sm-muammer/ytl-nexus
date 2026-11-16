# Nexus Mail: internal mail and webmail

> **Purpose:** how the internal mail system and Roundcube webmail are installed, secured, managed and checked on Nexus Core 01.
> **Audience:** whoever runs the server or manages mailboxes in Nexus Control.
> **Spec:** [Nexus Mail](../spec/17-nexus-mail.md) (MAIL-01 to MAIL-10). Setup script: `infrastructure/scripts/setup-mail`. Acceptance check: `infrastructure/scripts/verify-mail`.

## What runs

| Part             | Where                               | Notes                                                                                                         |
| ---------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Postfix 3.5      | `postfix.service`                   | MTA for virtual domain `ytl-nexus.internal`. Submission on 587 (STARTTLS + SASL). External relay is rejected. |
| Dovecot 2.3      | `dovecot.service`                   | IMAPS on port **993** (plain 143 off). LMTP socket and SASL auth socket in Postfix private spool.             |
| Roundcube 1.7.6  | `/var/www/webmail`                  | Current stable release (verified tarball) published at `https://ytl-nexus.ytlcomms.my/webmail/`.              |
| PHP-FPM pool     | `/run/php-fpm/webmail.sock`         | Dedicated unprivileged pool `webmail` (user `webmail`), restricted `open_basedir` and session save path.      |
| Mail database    | MariaDB database `nexus_mail`       | Virtual users, quotas, and SHA512-CRYPT password hashes (`{SHA512-CRYPT}$6$...`).                             |
| Webmail database | MariaDB database `nexus_roundcube`  | Roundcube session, contact and preferences storage.                                                           |
| Mail store       | `/var/mail/vmail/%d/%n/Maildir`     | Maildirs owned by system user `vmail` (`0750`). Mail delivery handled via Dovecot LMTP.                       |
| Child skin       | `roundcube/skins/nexus`             | Extends Elastic with Nexus design tokens, system UI typography, Gmail-inspired folder rail and dark mode.     |
| Shortcuts plugin | `roundcube/plugins/nexus_shortcuts` | Keyboard shortcuts (`c` compose, `/` search, `g`+`i` inbox, `r` reply, `a` reply-all, `f` forward, `?` help). |
| Metrics & Probes | `/etc/ytl-nexus/ops-probes.conf`    | `NEXUS_PROBE_IMAPS` (`127.0.0.1:993`) and `NEXUS_PROBE_SUBMISSION` (`127.0.0.1:587`).                         |

Configuration is managed idempotently by `infrastructure/scripts/setup-mail`. Re-running `setup-mail` keeps existing passwords, database records, and certificates.

## Security settings and why

- **Virtual users, never OS accounts (MAIL-01).** Mail users exist only in the MariaDB `nexus_mail.virtual_users` table. System mail is stored under `/var/mail/vmail` owned by the unprivileged system user `vmail` (`uid` 978, `first_valid_uid = 500`).
- **Cryptographic password hashing (MAIL-02).** Password hashes use glibc-compatible SHA512-CRYPT (`$6$...`) with standard salt lengths, stored with prefix `{SHA512-CRYPT}`. Plaintext passwords never touch database tables or audit trails.
- **TLS from the internal CA (MAIL-05).** Dovecot IMAPS (port 993) and Postfix Submission (port 587) present the certificate `/etc/pki/nexus-ca/server.crt` signed by `/etc/pki/nexus-ca/ca.crt`. Plain IMAP on port 143 is completely disabled (`port = 0`).
- **Loopback-only relay & external protection (MAIL-04).** Postfix `mynetworks = 127.0.0.0/8 [::1]/128`. Port 25 is not opened in firewalld. Relaying to non-local domains is rejected for both unauthenticated and authenticated clients with 5xx/4xx error codes.
- **Roundcube security & rate limiting (MAIL-06).**
  - The installer directory and script (`installer/`, `public_html/installer.php`) are removed immediately after installation.
  - Apache denies web access to `config/`, `temp/`, `logs/`, and `SQL/`.
  - Login rate limiting is enforced (`login_rate_limit = 5`, `login_rate_limit_time = 300`). 5 failed logins within 5 minutes trigger a block. Invalid logins return `HTTP 401 Unauthorized`.
  - Session secrets use a 24-character cryptographic `des_key` preserved across configuration runs.
  - CSP enforces same-origin script execution, style embedding, and frame ancestry protections (`X-Frame-Options: SAMEORIGIN`).
- **Least-privilege database access (MAIL-10).**
  - `nexus_mail_lookup`: `SELECT` privilege only on `virtual_domains` and `virtual_users` (used by Postfix and Dovecot daemons).
  - `nexus_mail_app`: `SELECT, INSERT, UPDATE, DELETE` privilege on `virtual_domains` and `virtual_users` (used exclusively by Next.js Server Functions).
  - Neither account has `DROP`, `ALTER`, or administrative grants.

## Mailbox administration in Nexus Control

Administrators manage mailboxes under **Control** (`/control`), section **Mail accounts** (`data-control-mail`). Actions require an active session with fresh **Step_Up** verification (password and authenticator code within the last 10 minutes).

| Action         | Behavior                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create mailbox | Requires local part (3-64 chars, lowercase, digits, `.`, `-`, `_`) and quota (10 to 2048 MB). A 24-character temporary password is shown once.                                                |
| Disable/Enable | Disabling sets `enabled = 0`. Dovecot and Postfix reject logins and inbound deliveries immediately.                                                                                           |
| Set quota      | Adjusts the mailbox limit in MB (persisted in bytes in `virtual_users.quota_bytes`).                                                                                                          |
| Reset password | Generates a fresh temporary password shown once to the administrator.                                                                                                                         |
| Delete mailbox | Requires typing the exact local part to confirm. Deletes the database record. Mailstore files stay in `/var/mail/vmail/ytl-nexus.internal/<local_part>` until cleaned up by an administrator. |

Every action is audited in `audit_events` under `mail.account.create`, `mail.account.set-enabled`, `mail.account.set-quota`, `mail.account.reset-password`, and `mail.account.delete`.

## Using it

- **Nexus Mail Overview (`/mail`):** Members and above can view the service status, own mailbox quota and usage, client configuration settings (IMAPS 993, Submission 587, STARTTLS), and help documentation (`mail_help` items from Nexus Library), with a direct link to `/webmail/`.
- **Nexus Webmail (`/webmail/`):** Full-featured Gmail-inspired webmail experience powered by the custom child skin `roundcube/skins/nexus` and keyboard shortcuts (`roundcube/plugins/nexus_shortcuts`).

### Standard email client settings

```text
Incoming Server (IMAP):  ytl-nexus.internal (or 10.26.64.164)
Port:                    993
Security:                SSL/TLS
Username:                <local_part>@ytl-nexus.internal

Outgoing Server (SMTP):  ytl-nexus.internal (or 10.26.64.164)
Port:                    587
Security:                STARTTLS
Authentication:          Required (same as incoming username and password)
```

## Operations

- **Acceptance suite:** run `infrastructure/scripts/server-run verify-mail`. Tests IMAPS 993 TLS certificate, IMAP login, invalid login refusal, port 143 closure, Submission 587 STARTTLS and SASL auth, end-to-end LMTP mail delivery between test mailboxes, Maildir file delivery, open relay denial, external recipient denial, port 25 firewall closure, Roundcube HTTP 200, skin and plugin assets, forbidden path blocks, and login rate limiting. Expects **25 passed, 0 failed**.
- **Service management:**
  ```sh
  ssh root@10.26.64.164 'systemctl status dovecot postfix php-fpm'
  ssh root@10.26.64.164 'journalctl -u dovecot -u postfix -n 50 --no-pager'
  ```
- **Test passwords:** stored on the server at `/root/mail-test-passwords.txt` (`mode 0600 root only`) for `nexus-test-a@ytl-nexus.internal` and `nexus-test-b@ytl-nexus.internal`.
