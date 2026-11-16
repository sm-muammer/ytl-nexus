# Nexus Backup & Restore Operations

> **Purpose:** System backup configuration, restore verification drills, and off-box copy procedures for Nexus Core 01.  
> **Audience:** Operators and Administrators.  
> **Requirement Reference:** CON-01 through CON-07.

---

## 1. Architecture Overview

Nexus backups are decoupled from the web application:

- **Root-owned systemd timers** trigger backup creation and restore testing independently.
- **The Next.js web application NEVER runs or triggers backups** directly.
- Completed runs and test drills are reported back to the platform database (`ytl_nexus`) via the INSERT-only database account `nexus_ingest`.
- Visual tracking is exposed in the **Nexus Continuity** console (`/continuity`).

---

## 2. Backup Coverage & Artifacts

Daily timer `nexus-backup.timer` triggers `nexus-backup` at 02:00 UTC. It backs up all critical system components into `/var/backups/nexus/<YYYYMMDD-HHMMSS>/`:

| Component Key              | Source / Path                                     | Backup Format            |
| -------------------------- | ------------------------------------------------- | ------------------------ |
| `ytl_nexus-database`       | MariaDB `ytl_nexus`                               | `ytl_nexus.sql.gz`       |
| `nexus_mail-database`      | MariaDB `nexus_mail`                              | `nexus_mail.sql.gz`      |
| `nexus_roundcube-database` | MariaDB `nexus_roundcube`                         | `nexus_roundcube.sql.gz` |
| `nexus_sftpgo-database`    | MariaDB `nexus_sftpgo`                            | `nexus_sftpgo.sql.gz`    |
| `nexus_wordpress-database` | MariaDB `nexus_wordpress`                         | `nexus_wordpress.sql.gz` |
| `config`                   | `/etc/ytl-nexus`, `/etc/roundcube`, systemd units | `config.tar.gz`          |
| `storage-mail`             | `/var/mail/vmail`                                 | `mail-storage.tar.gz`    |
| `storage-sftpgo`           | `/srv/nexus-transfer`, `/var/lib/sftpgo/hostkeys` | `sftpgo-data.tar.gz`     |
| `storage-wordpress`        | `/var/www/wordpress/wp-content/uploads`           | `wp-uploads.tar.gz`      |

Every backup bundle contains a signed `SHA256SUMS` file with digests for all created archives.

### Retention Policy

Old backups are rotated automatically by `nexus-backup`:

- Keeps the **7 most recent daily** backups.
- Keeps the **4 most recent weekly** backups.
- All older folders are pruned automatically.

---

## 3. Weekly Restore Verification Drills

Weekly timer `nexus-restore-test.timer` fires every Sunday at 03:00 UTC executing `nexus-restore-test`:

1. Validates all archives against `SHA256SUMS`.
2. Creates scratch databases (e.g. `scratch_test_<timestamp>_ytl_nexus`).
3. Restores database dumps into the scratch databases and asserts table counts.
4. **Always drops** scratch databases immediately after validation.
5. Extracts storage archives into temporary scratch directories, asserts readable file counts, and removes scratch directories.
6. Records results into `restore_tests` via `nexus_ingest`.

If any archive fails extraction or checksum comparison, a `failed` test record is logged and the component is marked unverified.

---

## 4. Off-Box Backup Copy Procedure

To protect against physical server failure or virtualization cluster stockouts, backups must be copied off-box.

### Syncing to Local Administrator Mac

Run from your Mac:

```bash
rsync -avz --progress -e ssh root@10.26.64.164:/var/backups/nexus/ ~/ytl-nexus-backups/
```

### Verifying Off-Site Checksums

```bash
cd ~/ytl-nexus-backups/<timestamp>
sha256sum -c SHA256SUMS
```

---

## 5. Manual Disaster Recovery Steps

If Nexus Core 01 must be recovered from scratch or rolled back:

### 1. Database Restoration

```bash
# Decompress and load SQL dump into MariaDB
zcat ytl_nexus.sql.gz | mariadb ytl_nexus
zcat nexus_mail.sql.gz | mariadb nexus_mail
zcat nexus_roundcube.sql.gz | mariadb nexus_roundcube
zcat nexus_sftpgo.sql.gz | mariadb nexus_sftpgo
zcat nexus_wordpress.sql.gz | mariadb nexus_wordpress
```

### 2. Configuration & Hostkeys

```bash
tar -C / -xzf config.tar.gz
chmod 0600 /etc/ytl-nexus/*.env
systemctl daemon-reload
```

### 3. File & Mail Storage

```bash
tar -C / -xzf mail-storage.tar.gz
chown -R vmail:vmail /var/mail/vmail

tar -C / -xzf sftpgo-data.tar.gz
chown -R sftpgo:sftpgo /srv/nexus-transfer /var/lib/sftpgo/hostkeys

tar -C /var/www/wordpress/wp-content -xzf wp-uploads.tar.gz
chown -R apache:apache /var/www/wordpress/wp-content/uploads
```

### 4. Restart Systemd Units

```bash
systemctl restart mariadb
systemctl restart nexus-web nexus-worker
systemctl restart dovecot postfix
systemctl restart sftpgo
systemctl restart httpd php-fpm
```
