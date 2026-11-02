# Rolling back YTL Nexus

> **Purpose:** how to return the site to the previous release, what happens automatically, and what a rollback does not undo.
> **Audience:** whoever is on call for Nexus Core 01. Deploying is in [`deploy.md`](deploy.md).

## Automatic rollback

`deploy.sh` rolls back by itself when the new release starts but `/api/health/ready` does not answer 200 within 60 seconds. It points `current` back at the previous release, restarts `nexus-web`, and exits 1. You do nothing except read why it failed:

```bash
ssh root@10.26.64.164 'journalctl -u nexus-web --since "10 minutes ago" --no-pager | tail -40'
```

A build or migration failure needs no rollback: the running release was never touched.

## Manual rollback

Use it when a release passed the health check but behaves wrongly.

```bash
ssh root@10.26.64.164 /opt/ytl-nexus/bin/rollback.sh
```

The script runs `verify-target`, takes the deploy lock, switches `current` to `previous` (and `previous` to the release you left), restarts `nexus-web` and waits for the health check. It prints `rolled back to <sha>; health check passed` on success.

Running it a second time swaps back, so it also works as "roll forward again".

If the health check fails after the switch, the script exits 1 and says so. Both releases are then suspect: look at the service log, and deploy a known good commit with `infrastructure/scripts/deploy-remote <sha>`.

## Check the result

```bash
ssh root@10.26.64.164 'readlink /opt/ytl-nexus/current /opt/ytl-nexus/previous; systemctl is-active nexus-web'
curl -s --cacert infrastructure/tls/nexus-internal-ca.crt --resolve ytl-nexus.internal:443:10.26.64.164 https://ytl-nexus.internal/api/health/ready
```

## What a rollback does not undo

- **Database migrations.** A rollback changes code only. Task 5 gives every migration a down step; run it by hand before rolling back across a migration, and only after checking what the migration did.
- **Files outside the release**, such as `/etc/ytl-nexus/*.env` and `/var/cache/ytl-nexus`.
- **Releases older than the newest three.** `deploy.sh` deletes them. Any commit can be deployed again with `deploy-remote <sha>`.

## Going back further than `previous`

```bash
infrastructure/scripts/deploy-remote <older-sha-or-tag>
```

It builds that commit again on the server (about 1 minute) and runs the same health-checked switch.

Related: [Deploy](deploy.md) · [Server baseline](server-baseline.md)
