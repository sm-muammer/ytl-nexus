# ADR 0001: Modular Next.js platform with host services on one server

- **Status:** accepted
- **Date:** 2026-10-30
- **Deciders:** Muammer (owner), approved plan

## Context

The team's Rocky Linux test server hosted several unrelated, buggy draft sites. YTL Nexus must unify a dashboard, local AI, SFTP, mail, a database demonstration, editable content and the Yes redesign within about two weeks, and remain maintainable by the IT Infrastructure team afterwards. The owner asked to build everything new; only `yes-website-redesign` may be reused.

## Decision

- Build one new Next.js 16.3.5 application (`nexus-web`) for every Nexus page and API.
- Run WordPress headless as the content store, with Next.js rendering all pages.
- Use maintained, purpose-built services on the same host for the rest: SFTPGo, Roundcube with Postfix and Dovecot, Prometheus with node_exporter, Ollama, MariaDB.
- Use Apache as the single public entry point with path routing on one hostname.
- Replace all earlier server content after a verified backup.

## Alternatives considered

| Option                                  | Why not                                                                                                            |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Podman-managed service stack            | Stronger packaging, but more volume, network and upgrade complexity than the team can absorb in the time available |
| WordPress-first platform                | Splits the experience and makes the dashboard and motion work harder                                               |
| Building SFTP or webmail inside Next.js | Large, security-sensitive surface; maintained services already do this well                                        |
| Reusing the old drafts or old webmail   | Owner rejected reuse; the old webmail had architectural security flaws                                             |

## Consequences

- One deploy pipeline for Nexus code; host services are configured from `infrastructure/` and documented runbooks.
- The server is a single point of failure; backups and restore drills (Nexus Continuity) are mandatory.
- Each host service needs its own least-privilege user, database and runbook.
