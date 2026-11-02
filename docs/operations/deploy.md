# Deploying YTL Nexus

> **Purpose:** how a commit gets onto Nexus Core 01, what the scripts do, and how a failed deploy protects the running site.
> **Audience:** the developer deploying and the IT Infrastructure team operating the server. Undoing a deploy is in [`rollback.md`](rollback.md); the server itself is in [`server-baseline.md`](server-baseline.md).

## Deploy from the Mac

```bash
git status                      # commit first; only committed work is deployed
infrastructure/scripts/deploy-remote            # deploys HEAD
infrastructure/scripts/deploy-remote <sha|tag>  # deploys another commit
```

The command exits 0 only when the new release is live and healthy. Any other exit code means the site is still on the previous release (see "When a deploy fails").

`deploy-remote` does five things:

1. Runs `verify-target`, which checks the server's hostname, IP `10.26.64.164` and machine ID. A mismatch stops everything.
2. Copies `deploy.sh`, `rollback.sh`, `release-lib.sh` and `verify-target` to `/opt/ytl-nexus/bin/`.
3. Pushes the commit to the bare repository `/opt/ytl-nexus/repo.git` as the tag `deploy-<12-character sha>`. The GitHub repository is private, so the server holds no GitHub credentials and never clones from GitHub.
4. Runs `deploy.sh` on the server.
5. Shows the server's output, including the build log.

## What `deploy.sh` does on the server

| Step | Action                                                                                                                                        | If it fails                                                                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | `verify-target --local`, then take the lock `/opt/ytl-nexus/deploy.lock` (one deploy or rollback at a time)                                   | Nothing has changed                                                        |
| 2    | `git archive` the commit into `/opt/ytl-nexus/releases/<git-sha>`                                                                             | Nothing has changed                                                        |
| 3    | Build as the `nexus` user: `npm ci`, `npm run build`, copy `public/` and `.next/static` into `.next/standalone`, link the cache directory     | The half-built release is deleted. `current` is unchanged. Exit 1          |
| 4    | Migrations as `nexus`: `npm run migrate --if-present`, with `/etc/ytl-nexus/migrate.env` loaded when it exists (the script arrives in Task 5) | The half-built release is deleted. `current` is unchanged. Exit 1          |
| 5    | Point `current` at the new release in one step, then `systemctl restart nexus-web`                                                            |                                                                            |
| 6    | Poll `http://127.0.0.1:3000/api/health/ready` for up to 60 seconds                                                                            | `current` goes back to the old release, the service restarts on it. Exit 1 |
| 7    | On success, `previous` becomes the old release; keep the newest 3 releases plus `current` and `previous`, delete the rest                     |                                                                            |

A build or migration failure never restarts the service. The running site is not touched until step 5.

## Layout on the server

```
/opt/ytl-nexus/
  bin/                  deploy.sh, rollback.sh, release-lib.sh, verify-target
  repo.git/             bare repository that deploy-remote pushes to
  releases/<git-sha>/   one directory per release (source, node_modules, .next/standalone)
  current  -> releases/<sha>    what nexus-web runs
  previous -> releases/<sha>    what rollback.sh returns to
  releases.log          deployed releases, oldest first (used for pruning)
/etc/ytl-nexus/web.env  environment for the service and the build (root:nexus, 0640)
/var/cache/ytl-nexus/   the only directory the service may write to
```

The service starts `node server.js` from `current/.next/standalone` as the `nexus` user, on `127.0.0.1:3000`. Apache is the only public entry.

## Settings you can override

`deploy.sh` reads these environment variables. The defaults are the production values; the tests in `tests/unit/infrastructure/deploy.test.ts` replace them with stubs.

| Variable                                         | Default                                        | Meaning                                    |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------ |
| `NEXUS_ROOT`                                     | `/opt/ytl-nexus`                               | Base directory                             |
| `NEXUS_REPO`                                     | `$NEXUS_ROOT/repo.git`                         | Source repository                          |
| `NEXUS_RUN_AS`                                   | `nexus`                                        | User that builds and migrates; empty = you |
| `NEXUS_KEEP_RELEASES`                            | `3`                                            | Newest releases to keep                    |
| `NEXUS_HEALTH_TIMEOUT` / `NEXUS_HEALTH_INTERVAL` | `60` / `2` seconds                             | Health-check patience                      |
| `NEXUS_BUILD_CMD`, `NEXUS_MIGRATE_CMD`           | see `deploy.sh`                                | Build and migration commands               |
| `NEXUS_RESTART_CMD`, `NEXUS_HEALTH_CMD`          | `systemctl restart nexus-web`, `curl` to ready | Restart and health check                   |

## When a deploy fails

| What you see                                          | What happened                                   | What to do                                                                                                       |
| ----------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `ERROR: build failed; 'current' is unchanged`         | The build broke. The site never changed         | Fix the code, run `npm run check` locally, deploy again                                                          |
| `ERROR: migrations failed; 'current' is unchanged`    | A migration broke. The site never changed       | Fix the migration; check the database state before retrying (see `rollback.md`)                                  |
| `ERROR: health check failed ... rolled back to <sha>` | The new release started but did not get healthy | The old release is serving again. Read the new release's log: `journalctl -u nexus-web --since "10 minutes ago"` |
| `another deploy or rollback is already running`       | The lock directory exists                       | Wait. If no deploy is running, `rmdir /opt/ytl-nexus/deploy.lock`                                                |
| `verify-target failed`                                | The machine is not Core 01                      | Stop. Check the IP and the SSH target before doing anything else                                                 |

The rollback drill (a deliberately failing build and a deliberately failing health check) was run on 2026-11-02; results are in [`server-baseline.md`](server-baseline.md#verification-record).

## Proof that it works

```bash
infrastructure/scripts/smoke-test      # about 1 minute, 45 checks, exits non-zero on any failure
npm run test -- tests/unit/infrastructure   # the deploy and rollback logic in a temporary directory
```

Related: [Rollback](rollback.md) · [Server baseline](server-baseline.md) · [Configuration](configuration.md) · [Technology](../tech.md)
