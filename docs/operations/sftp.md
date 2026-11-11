# Nexus Transfer: SFTP and the file portal

> **Purpose:** how file transfer is installed, secured, managed and checked on Nexus Core 01.
> **Audience:** whoever runs the server or manages accounts in Nexus Control.
> **Spec:** [Nexus Transfer](../spec/16-nexus-transfer.md) (TRF-01 to TRF-12). Setup script: `infrastructure/scripts/setup-sftpgo`. Acceptance check: `infrastructure/scripts/verify-sftp`.

## What runs

| Part                    | Where                           | Notes                                                                                            |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------ |
| SFTPGo 2.7              | `sftpgo.service`, user `sftpgo` | Installed from the official YUM repository (`oss.sftpgo.com`). Runs unprivileged.                |
| SFTP                    | port **2022**                   | SSH for administration stays on 22. Password and public-key login.                               |
| File portal (WebClient) | `127.0.0.1:8090`                | Apache publishes it at `https://ytl-nexus.ytlcomms.my/files/` (`files.inc`).                     |
| WebAdmin and REST API   | `127.0.0.1:8091`                | **Never proxied.** Reach it through an SSH tunnel (below). Nexus calls the REST API here.        |
| Metrics                 | `127.0.0.1:10000/metrics`       | Prometheus job `sftpgo`, every 60 seconds.                                                       |
| FTP and WebDAV          | off                             | Their bindings are set to port 0. No listener exists.                                            |
| Accounts and quotas     | MariaDB database `nexus_sftpgo` | One single-database user, `nexus_sftpgo`.                                                        |
| Files                   | `/srv/nexus-transfer/<name>`    | The dedicated 20 GB volume (`nosuid,nodev,noexec`). One folder per account, made at first login. |

Configuration is the package default plus `infrastructure/sftpgo/overrides.json`, merged by `infrastructure/sftpgo/merge-config.py` into `/etc/sftpgo/sftpgo.json`. The package original is kept at `/etc/sftpgo/sftpgo.json.nexus-orig`; `setup-sftpgo` always merges from it, so running it again gives the same file. Change a setting in `overrides.json`, then run `infrastructure/scripts/server-run setup-sftpgo`.

## Security settings and why

- **Unprivileged service.** The unit runs as `sftpgo` with no capabilities, `ProtectSystem=strict` and write access only to `/srv/nexus-transfer` and `/var/lib/sftpgo` (`systemd-analyze security sftpgo` reads 3.0, OK). The sandbox is in `infrastructure/systemd/sftpgo-nexus.conf`.
- **Isolated homes.** SFTPGo treats an account's home as `/`. A path such as `../../etc/passwd` resolves inside the home. `verify-sftp` tests this over SFTP and the browser.
- **No chmod, chown or symlinks.** Accounts get these permissions only: list, download, upload, overwrite, delete, rename, create_dirs, chtimes, copy. A client that tries `chmod`, `chown` or `ln -s` gets an error.
- **Quota.** Every account has a size limit (10 MB to 20 GB, set in Control). An upload past the limit is refused and the files already stored stay. `track_quota` is 2, so usage is tracked for accounts that have a limit.
- **Defender.** 5 failed logins from one address within 10 minutes block that address for 30 minutes. A blocked address that keeps trying has its block lengthened by 50% of the base time for each further attempt. Per-protocol rate limits apply to SFTP (5 per second, burst 10) and to the portal (50 per second, burst 100).
- **Real client address.** Apache sets `X-Real-IP`; SFTPGo trusts it only from `127.0.0.1`, so the defender sees the visitor, not Apache.
- **Passwords.** Stored with argon2id. SFTPGo refuses a password with less than 50 bits of entropy (60 for administrators). Passwords made by Nexus are 24 random characters.
- **Keys.** Up to 10 public keys per account. Nexus accepts only plain OpenSSH lines of a known type (RSA keys of at least 2048 bits); options such as `command="..."` are refused. Users cannot change their own keys, API keys or shares in the portal; an Administrator manages keys in Control.
- **Host keys.** Ed25519 and RSA 3072 in `/var/lib/sftpgo/hostkeys`. The fingerprints (for first connection): `ssh-keyscan -p 2022 <host> | ssh-keygen -lf -`.
- **Cookies and headers.** The portal's session cookie is `HttpOnly`, `Secure` and `SameSite=Strict`. Apache sets a content security policy for `/files/` that allows the portal's own scripts only from the same origin.
- **Secrets.** `/etc/sftpgo/sftpgo.env` (root only, read by systemd): database password and the token signing passphrase. The REST API key is in `/etc/ytl-nexus/web.env` as `NEXUS_SFTPGO_API_KEY`. The Nexus server refuses to use the key against any address that is not loopback.

## Accounts

Accounts are never created automatically (requirement 12.19). An Administrator creates one for a Nexus user in **Control**, section **File transfer accounts**. The page needs a fresh Step_Up (password and authenticator code within 10 minutes).

| Action                     | What happens                                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| New account                | Choose the person, an SFTP name (3 to 32 characters: lowercase letters, digits, `-`, `_`) and a limit in MB. The first password is shown once. |
| Disable or enable          | A disabled account cannot sign in and is signed out at once.                                                                                   |
| Set limit                  | Changes the quota in MB.                                                                                                                       |
| Reset password             | A new password is shown once; the account's sessions end.                                                                                      |
| Add or remove a public key | Paste the whole `.pub` line. Removing a key ends the account's sessions.                                                                       |
| Delete                     | You must type the name. Removes the login. **The files stay** in `/srv/nexus-transfer/<name>` until someone removes the folder by hand.        |

Every action writes one audit event (`transfer.account.create`, `.set-enabled`, `.set-quota`, `.reset-password`, `.delete`, `transfer.key.add`, `.key.remove`) with the account name as target. Passwords never reach the audit trail. The link between a Nexus user and an SFTP account is the SFTPGo field `additional_info` (`nexus-user:<id>`); a Member sees the account that carries their own id, and nothing else (`/transfer`).

To remove the files of a deleted account (after checking nobody needs them):

```sh
ssh root@10.26.64.164 'ls -la /srv/nexus-transfer/<name> && rm -r /srv/nexus-transfer/<name>'
```

## Using it

Members open `/transfer` for their account, quota, keys and the guides for WinSCP, FileZilla, Cyberduck and the terminal:

```sh
sftp -P 2022 <name>@ytl-nexus.ytlcomms.my
sftp -P 2022 -i ~/.ssh/id_ed25519 <name>@ytl-nexus.ytlcomms.my
```

The browser portal is at `https://ytl-nexus.ytlcomms.my/files/`. It has its own sign-in (SFTP name and password); a Nexus password does not work there.

## WebAdmin through an SSH tunnel (break-glass)

The WebAdmin and REST API listen on loopback only. Open a tunnel from your Mac, then browse to it:

```sh
ssh -N -L 8091:127.0.0.1:8091 root@10.26.64.164
# then open http://127.0.0.1:8091/files/web/admin/login
```

The administrator is `nexus-admin`. Its first password was written to `/root/sftpgo-admin-password.txt` on the server. Read it once, store it in your password manager, then delete the file. If it is lost, reset it on the server with `sftpgo resetpwd --admin nexus-admin -c /etc/sftpgo` (see `sftpgo resetpwd --help`). The command needs the database password from `/etc/sftpgo/sftpgo.env` in its environment, so load that file first (`set -a; . /etc/sftpgo/sftpgo.env; set +a`). It has not been run on this server. The REST API key belongs to a second, limited administrator `nexus-api` (users, quotas, status and defender only); do not use that account interactively.

## Operations

- **Check everything:** `infrastructure/scripts/server-run verify-sftp`. It makes an account named `nxtest`, tests password and key login, a wrong password, upload and download, path escape over SFTP and the browser, chmod/chown/symlink, the quota, a disabled account and the defender, then deletes the account and lifts its own block. It expects **58 passed, 0 failed**. `smoke-test` also checks the listeners, `/files/` and the scrape.
- **Restart or read logs:** Operators use `/command/services` (SFTPGo is in the allowlist). On the server: `journalctl -u sftpgo -n 100`.
- **Lift a block** (an Administrator locked themselves out): through the tunnel, WebAdmin, Defender. Or on the server, with the key from `web.env`:

  ```sh
  id=$(printf '%s' '<ip>' | od -An -tx1 | tr -d ' \n')
  printf 'header = "X-SFTPGO-API-KEY: %s"\n' "$(grep -m1 ^NEXUS_SFTPGO_API_KEY= /etc/ytl-nexus/web.env | cut -d= -f2-)" |
    curl -sS -K - -X DELETE "http://127.0.0.1:8091/api/v2/defender/hosts/$id"
  ```

- **Quota looks wrong** (files changed outside SFTPGo): start a scan from WebAdmin, Users, or `POST /api/v2/quotas/users/<name>/scan`.
- **Rotate the API key:** delete `NEXUS_SFTPGO_API_KEY` from `web.env`, run `setup-sftpgo` (needs `/root/sftpgo-admin-password.txt`), then `infrastructure/scripts/deploy-remote` or `systemctl restart nexus-web`.
- **Back up:** the database `nexus_sftpgo`, `/etc/sftpgo`, `/var/lib/sftpgo/hostkeys` and `/srv/nexus-transfer`. Task 16 (Nexus Continuity) puts them in the daily backup. Losing the host keys makes every client warn that the server changed.
- **The package left a SQLite file** at `/var/lib/sftpgo/sftpgo.db` from its first start. It is unused (the provider is MariaDB). It is harmless; remove it by hand when convenient.

## Demo mode

`NEXUS_MODE=demo` shows three invented accounts (`lib/fixtures/transfer.ts`) labelled Demo data. Every control in Control is switched off, and the Server Functions refuse before any call.

## Known limits

- Fail2ban for SFTPGo is part of the hardening task (Task 21). The built-in defender is what protects port 2022 today.
- A Member cannot add their own key; they send the public half to an Administrator.
- Real SFTP login with a Nexus account has not been checked in a browser with an Administrator who has an authenticator; the unit tests, the demo end-to-end tests and `verify-sftp` cover the code and the server.
