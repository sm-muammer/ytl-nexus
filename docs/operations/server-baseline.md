# Nexus Core 01 server baseline

> **Purpose:** the state Nexus Core 01 was left in by Task 4: what is installed, what is open, what was removed and where the backup is, so anyone can check the server against it.
> **Audience:** the IT Infrastructure team and later sessions. Deploying is in [`deploy.md`](deploy.md); the technology choices are in [`../tech.md`](../tech.md).

## Identity

| Item              | Value                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hostname          | `sn1lyvx1d0002.ytlcomms.my` (unchanged; the owner declined the rename to `ytl-nexus.ytlcomms.my` on 2026-11-02)                                  |
| IP address        | `10.26.64.164` on `ens3`                                                                                                                         |
| Machine ID        | Stored only as a SHA-256 hash in `infrastructure/scripts/verify-target`                                                                          |
| OS                | Rocky Linux 9.8, kernel 5.14, QEMU/KVM guest                                                                                                     |
| Directory join    | None. `realm` and `sssd` are not installed; `/etc/sssd` is empty                                                                                 |
| Time              | `chronyd` enabled, synchronised (stratum 3, leap status Normal)                                                                                  |
| CPU               | 8 vCPU, Westmere-class. **No AVX or AVX2** in `/proc/cpuinfo`; Task 14 must benchmark Ollama on this CPU                                         |
| Outbound internet | Yes. `https://registry.npmjs.org/` and `https://dl.rockylinux.org/` both answered 200 on 2026-11-02, so `npm ci`, `dnf` and model downloads work |
| SELinux           | Disabled (pilot decision, documented risk in [`../tech.md`](../tech.md))                                                                         |
| SSH               | Root login and password login unchanged (lockout risk); Shield reports them in Task 17                                                           |

## Installed and running

| Component     | Version / stream                    | Listens on                         | Notes                                                                                                                                                                      |
| ------------- | ----------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apache        | 2.4.62                              | `:80`, `:443`                      | `/etc/httpd/conf.d/00-ytl-nexus.conf` (source: `infrastructure/apache/ytl-nexus.conf`). `welcome.conf` is commented out; the original is `welcome.conf.nexus-bak.disabled` |
| nexus-web     | Next.js 16.3.5, Node 24.22.1        | `127.0.0.1:3000`                   | Runs as `nexus`. Sandbox exposure 1.7 OK (`systemd-analyze security nexus-web`)                                                                                            |
| Node.js       | AppStream module `nodejs:24`        | none                               | [ADR 0002](../architecture/decisions/0002-node-24-lts.md)                                                                                                                  |
| PHP           | AppStream module `php:8.3` (8.3.36) | none (PHP-FPM installed, disabled) | Decision D-009. Extensions: gd, intl, mbstring, mysqlnd, xml, zip, opcache. **`sodium` is not available** (see below). FPM is configured with WordPress in Task 7          |
| MariaDB       | 10.5.29                             | `127.0.0.1:3306`                   | `/etc/my.cnf.d/99-nexus.cnf` sets `bind-address=127.0.0.1` and `skip-name-resolve`. Only the system databases remain                                                       |
| Ollama        | tinyllama                           | `127.0.0.1:11434`                  | Unchanged                                                                                                                                                                  |
| node_exporter | existing install                    | `127.0.0.1:9100`                   | The unit gained `--web.listen-address=127.0.0.1:9100`; the original is `node_exporter.service.nexus-bak`. Task 8 added a systemd unit filter (backup `*.nexus-bak-task8`)  |
| Prometheus    | 3.16.0, official release            | `127.0.0.1:9090`                   | Own user and sandboxed unit; 15 days of data in `/var/lib/prometheus`; installed by `setup-monitoring` (Task 8). See [Monitoring](monitoring.md)                           |
| Postfix       | 3.5.25, package defaults            | `127.0.0.1:25`                     | Local delivery only until Task 13                                                                                                                                          |
| Dovecot       | 2.3.16, package defaults            | stopped and disabled               | Task 13 configures and enables it                                                                                                                                          |
| chronyd       | 4.8                                 | none                               |                                                                                                                                                                            |
| firewalld     | 1.3.4                               | n/a                                | See the next section                                                                                                                                                       |

**PHP `sodium`.** The AppStream 8.3 stream ships no `php-sodium` package, and the only one in EPEL is built for PHP 8.0 and cannot be installed. WordPress 6.x falls back to its bundled `sodium_compat`, which is slower but works. If a later task needs the native extension, add the Remi `remi-8.3` stream and record the change as a new decision.

## Firewall

`firewalld` is enabled at boot, zone `public`, default target (reject). Allowed inbound:

| Port | Service                          | Listening today   |
| ---- | -------------------------------- | ----------------- |
| 22   | SSH (`ssh` service, added first) | Yes               |
| 80   | HTTP (redirects to HTTPS)        | Yes               |
| 443  | HTTPS                            | Yes               |
| 2022 | SFTP (SFTPGo)                    | No, until Task 12 |
| 587  | Mail submission (Postfix)        | No, until Task 13 |
| 993  | IMAPS (Dovecot)                  | No, until Task 13 |

Enabling followed requirements 4.10 and 4.11: ssh added first, an automatic `systemctl stop firewalld` scheduled for 5 minutes later (`nexus-firewall-safety.timer`), a **new** SSH connection tested, then the timer cancelled. Re-run with `infrastructure/scripts/firewall-enable`.

## Storage

`/dev/sdb` (20 GB) had no partitions, signatures or mounts (`lsblk -f`, `wipefs -n`, `blkid -p` all empty). It was formatted xfs with the label `nexus-xfer` (XFS labels are limited to 12 characters) and mounted at `/srv/nexus-transfer` through `/etc/fstab` by UUID with `defaults,nosuid,nodev,noexec,nofail`. The previous `fstab` is `/etc/fstab.nexus-bak`.

## TLS

An internal certificate authority lives in `/etc/pki/nexus-ca/` (key in `private/`, mode 0700, never copied off the server). The CA is limited by name constraints to the three host names and the IP below, so clients that honour them will not trust it for anything else. The server certificate carries the SANs `ytl-nexus.ytlcomms.my`, `ytl-nexus.internal`, `sn1lyvx1d0002.ytlcomms.my` and `10.26.64.164`, and expires **2027-12-04**; renew by deleting `server.crt` and `server.key` and running `infrastructure/scripts/server-run setup-tls` then `setup-apache`. The public CA certificate is committed as `infrastructure/tls/nexus-internal-ca.crt`. Installing it on a client is in [`../handover/ca-install.md`](../handover/ca-install.md).

Apache sends HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `X-Frame-Options` and CSP `frame-ancestors` on every HTTPS response, and `Options -Indexes` applies everywhere. The CSP allows inline scripts and styles because Next.js needs them until Task 21 adds nonces. Apache also sets `X-Real-IP` to the connecting address on every proxied request, replacing any value a client sent; the audit trail and the sign-in lockout read it ([Authentication](../security/auth.md#source-address)).

## What was removed (gate 3, approved 2026-11-02)

The owner approved the whole list below, and the script confirmed afterwards that OS accounts and `sssd` files were identical to the backup.

- Old web content in `/var/www/html` (`index.html`, `ai.html`, `api/`, `webmail Claude.zip`), the old `webmail/` app, `/usr/local/sbin/webmail-useradmin` and `/etc/sudoers.d/webmail-useradmin`.
- Old WordPress (`/var/www/html/wp`, its Apache config), database `wordpress_db` and user `wp_user`.
- vsftpd (package, `/etc/vsftpd`, `/srv/ftp`), the `ftpadmin` vhost on `:8443`, its socket and service units, helper and certificate.
- The `superman` container and the nginx image.
- Postfix `main.cf` and two Dovecot files reset to package defaults; two `.save` files deleted; Dovecot disabled.
- `Maildir` directories in 11 home folders (141 files).

Kept on purpose: all OS accounts (including the `ftpvirt` service account, which has uid 984), home directories, `/var/spool/mail` files, `sssd` files, Ollama, MariaDB system databases.

## Backup

| Where                                                                 | What                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------ |
| Owner's Mac: `~/ytl-nexus-backups/nexus-preflight-backup-2026-11-02/` | The off-server copy, mode 0700. Outside the repository |
| Server: `/root/nexus-preflight-backup-2026-11-02/`                    | Original, with the file `OFFSITE-VERIFIED`             |

Contents (31 files, 98 MB, SHA-256 checksums in `SHA256SUMS`, all matched after the copy): `mariadb-all-databases.sql`, `var-www.tar.gz`, `etc-services.tar.gz` (Apache, Postfix, Dovecot, vsftpd, PHP, MariaDB, sudoers, systemd units, ftpadmin certificate), `usr-local-sbin.tar.gz`, `mail-spool.tar.gz`, `maildirs.tar.gz`, `crontabs.tar.gz`, `podman-inspect-superman.json` and `state-before/` (package list, listening ports, accounts). **The dump and the certificate key archive contain password hashes and a private key: keep the directory private.**

To look inside: `tar -tzf var-www.tar.gz | head`. To restore one item, extract it from the archive to a temporary directory and copy it back by hand.

## Scripts

All live in `infrastructure/scripts/`; the ones that change the server call `verify-target --local` first. `server-run <script>` verifies the target, uploads the scripts to `/root/nexus-ops` and runs one.

| Script                                                                                                        | Purpose                                                                        |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `verify-target`                                                                                               | Gate 1: hostname, IP and machine-ID check                                      |
| `preflight-backup`, `preflight-backup-remote`                                                                 | Gate 2: create, copy off and verify the backup                                 |
| `remove-old-content`                                                                                          | Gate 3: itemized removal (`--list`, then `--approved <backup-dir>`)            |
| `setup-time-identity`, `setup-runtimes`, `setup-tls`, `setup-apache`, `setup-nexus-service`, `setup-firewall` | Idempotent setup steps                                                         |
| `setup-auth`                                                                                                  | Task 6: adds the `BETTER_AUTH_*` settings to `web.env` (keeps existing values) |
| `firewall-enable`, `deploy-remote`, `smoke-test`                                                              | Run from the Mac                                                               |
| `deploy.sh`, `rollback.sh`, `release-lib.sh`                                                                  | Run on the server; see [`deploy.md`](deploy.md)                                |

## Verification record

Run on 2026-11-02 against the live server.

| Check                                                                         | Result                                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `infrastructure/scripts/smoke-test`                                           | 45 passed, 0 failed: HTTPS 200 on all four names, HTTP 301 (a forged `Host` header is sent to the canonical name), headers on `/`, `/api/health/live` and a 404, no listing on four paths, health endpoints, firewall rules equal the allowlist, no unexpected open port among 41 probed, 3000/3306/9100/11434 on loopback only, SSH works |
| Rollback drill A: a commit whose build fails                                  | `deploy-remote` exited 1 with `build failed; 'current' is unchanged`. `current` stayed on the old release, the service was not restarted, the half-built release was deleted                                                                                                                                                               |
| Rollback drill B: a commit that builds but answers 503 on `/api/health/ready` | Exited 1 after 60 seconds; `current` restored to the old release; HTTPS still answered 200                                                                                                                                                                                                                                                 |
| Manual `rollback.sh`, twice                                                   | Switched to `previous` and back, each time with a passing health check                                                                                                                                                                                                                                                                     |
| SSH after enabling firewalld                                                  | A new connection worked before the safety net was cancelled, and again in the smoke test                                                                                                                                                                                                                                                   |

**What the first drill found.** The first run of drill A did not fail the build: `deploy.sh` tests the build with `if`, which switches `set -e` off inside it, so a failing `npm run build` was ignored when the next line succeeded. The health check caught it and rolled back, which is why the drill was worth running. The fix (`set -eo pipefail` forced inside the command) has two regression tests.

**Known limit of the smoke test.** A sweep of all ports from outside is impractical: the kernel rate-limits the firewall's rejection replies, so closed ports read as timeouts and a sweep of 1,000 ports takes tens of minutes. The test compares the firewall's own rule list with the allowlist and probes 41 common service ports instead.

Related: [Deploy](deploy.md) · [Rollback](rollback.md) · [Security](../security.md) · [Technology](../tech.md)
