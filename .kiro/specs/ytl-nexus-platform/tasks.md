# Implementation Plan: YTL Nexus Platform

## Overview

Implementation language: TypeScript (strict) on Node.js 24 for the application, services and tests; POSIX shell for scripts under `infrastructure/`. The order mirrors `docs/spec/implementation-plan.md`. Within each module, test sub-tasks come first so a failing test exists before the code it checks. Tests are written with Vitest, fast-check (property tests), Testing Library and Playwright with axe.

Server-side tasks 4.x run against Nexus_Core_01 only. Each destructive step (backup, removal, firewall, hostname, disk) carries three gates from Requirement 4: verify the target (hostname, IP 10.26.64.164, machine ID), a verified off-server backup, and explicit owner approval. If a gate fails, stop and report.

## Tasks

- [ ] 1. Foundation, tooling and demo mode (plan Task 1)
  - [ ] 1.1 Scaffold the repository, tooling and CI
    - Next.js 16.3.5, TypeScript strict, Tailwind v4, ESLint flat config, Prettier, Vitest, fast-check, Playwright with axe, directory layout from `docs/structure.md`
    - Husky pre-commit running gitleaks, format check and lint; non-zero exit prints the failing check and findings
    - GitHub Actions stages: secret scan, format, lint, typecheck, unit, build, e2e smoke; failing stage is named
    - Record every file move or deletion in `docs/PROGRESS.md` with path and date, in the same commit
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.16_

  - [ ]* 1.2 Write property tests for mode selection and demo determinism
    - **Property 1: Mode selection accepts only live or demo**
    - **Property 2: Demo mode is deterministic and makes no outbound calls**
    - **Validates: Requirements 1.7, 1.8, 1.9, 1.11, 1.12**

  - [ ] 1.3 Implement `readMode`, the eight adapter interfaces and live/demo implementations
    - `lib/server` adapters (database, auth, WordPress, Prometheus, Ollama, SFTPGo, ops agent, mail) with `import "server-only"`; fixtures in `lib/fixtures`
    - Demo session switcher with exactly four roles, labelled "Demo session"; Live/Demo label component
    - Error serializer that returns no secret or internal detail; no secrets in `NEXT_PUBLIC_` variables
    - _Requirements: 1.7, 1.8, 1.9, 1.10, 1.14, 1.15_

  - [ ] 1.4 Add the outbound-call guard test and offline demo build check
    - CI test that fails on any live-adapter call in Demo_Mode
    - Script that builds and starts `NEXUS_MODE=demo` with the network disabled and requests every route
    - _Requirements: 1.11, 1.12, 1.13_

- [x] 2. Brand assets and design tokens (plan Task 2)
  - [x] 2.1 Build the asset conversion pipeline and filename check
    - `scripts/assets/convert`: one kebab-case SVG and one sRGB PNG per master; write `assets/asset-manifest.md`
    - CI check that fails and lists any banned or non-kebab-case asset filename
    - Write `docs/design/asset-sourcing.md` (no unclear-licence stock images, no Soho fonts)
    - _Requirements: 2.1, 2.2, 2.3, 2.15_

  - [x] 2.2 Define Tailwind v4 `@theme` tokens and fonts
    - Colour, type, spacing, radius, shadow, motion and z-layer tokens; fonts through `next/font/local`, no build-time font download
    - Lint rule that forbids raw hex values in component source; status colours paired with icon or text
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [x]* 2.3 Write Playwright tests for logo rendering
    - Logo height at least 31 CSS px, aspect ratio preserved, clear space on four sides
    - _Requirements: 2.4, 2.5, 2.6_

  - [x] 2.4 Build the `/design` reference page
    - Logos on light and dark, clear-space overlays, swatches, type specimen; `requireRole("viewer")`
    - _Requirements: 2.4, 2.5, 2.6, 2.13, 2.14_

- [x] 3. App shell, route stubs and motion system (plan Task 3)
  - [x]* 3.1 Write e2e and axe tests for the shell
    - Skip link first and moves focus, landmarks, one `h1`, no `#` footer links, focus order, 44 px targets, no horizontal scroll, axe zero serious/critical at 390, 1440 and 3840 px
    - _Requirements: 3.2, 3.4, 3.5, 3.15, 3.16, 3.17, 3.18_

  - [x]* 3.2 Write unit tests for the quality tier and visibility logic
    - Tier drops for DPR above 2, memory below 4 GB, frame average above 20 ms over 60 frames; pause on hidden, resume within 500 ms
    - _Requirements: 3.12, 3.13_

  - [x] 3.3 Implement public and workspace layouts and navigation
    - Skip link, landmarks, global nav with every module, contextual sub-nav, accessible mobile menu with focus return, footer, role-aware menu, Live/Demo and environment badges
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.4 Create a page for every product route and robots directives
    - Stub or full page per route in `docs/product.md`; `noindex` on workspace and `/control` routes
    - _Requirements: 3.8, 3.9_

  - [x] 3.5 Implement the motion system
    - `MotionConfig reducedMotion="user"`, fade/rise/stagger primitives, signal-ribbon route transition, quality-tier hook, visibility pause, static particle frame under reduced motion, no particle or parallax on forms, tables, Control or inbox
    - _Requirements: 3.10, 3.11, 3.12, 3.13, 3.14_

- [ ] 4. Server preparation, backup, removal, hardening and first deployment (plan Task 4)
  - [ ] 4.1 Write the verify-target script (gate 1)
    - `infrastructure/scripts/verify-target`: compare hostname, IP 10.26.64.164 and machine ID with recorded values; exit non-zero on mismatch; every destructive script calls it first
    - _Requirements: 4.1, 4.2_

  - [ ] 4.2 Create and verify the preflight backup (gate 2)
    - Run verify-target; MariaDB dump of all databases, `/var/www`, service config, mail storage, Podman inspect output and crontabs into a dated directory with checksums
    - Copy off the server, verify every checksum, confirm the archive opens and lists; on failure stop and report, with no removal
    - _Requirements: 4.3, 4.4, 4.5_

  - [ ] 4.3 Remove old server content after owner approval (gate 3)
    - Run verify-target and require the verified backup from 4.2; present one itemized removal list (old web content, `ftpadmin` vhost, old webmail and sudoers helper, old WordPress and DB, vsftpd, `superman` container, custom Postfix/Dovecot config and mailboxes)
    - Remove only listed items after explicit owner approval; with no approval, remove nothing
    - Verify OS user accounts and `sssd` configuration are unchanged
    - _Requirements: 4.1, 4.3, 4.6, 4.7, 4.8_

  - [ ] 4.4 Configure time sync and host identity
    - Enable `chronyd` and confirm synchronised state
    - Run `realm list`; if joined to a directory, add hostname aliases only; otherwise set the hostname only after verify-target, verified backup and owner approval
    - _Requirements: 4.1, 4.9, 4.16_

  - [ ] 4.5 Install runtimes, bind MariaDB and mount `sdb`
    - Node.js 24, PHP 8.3 with FPM and required extensions; bind MariaDB to Loopback
    - Check `sdb` with `lsblk -f` and `wipefs -n`; if any partition or signature exists, do not format or mount and report; otherwise, after the three gates, format xfs and mount at `/srv/nexus-transfer` with `nosuid,nodev,noexec`
    - _Requirements: 4.1, 4.13, 4.14, 4.15_

  - [ ] 4.6 Enable firewalld with the safety net
    - After the three gates: add the ssh service first, schedule `systemctl stop firewalld` in 5 minutes, add ports 80, 443, 2022, 587, 993, verify SSH from a new connection, then cancel the scheduled stop
    - _Requirements: 4.1, 4.10, 4.11, 4.12_

  - [ ] 4.7 Configure TLS and Apache
    - Internal CA and server certificate with SANs `ytl-nexus.ytlcomms.my`, `ytl-nexus.internal`, `sn1lyvx1d0002.ytlcomms.my`, `10.26.64.164`
    - Vhost: HTTP to HTTPS redirect, `Options -Indexes`, security headers, proxy to 127.0.0.1:3000 with `ProxyPreserveHost On`, `X-Forwarded-Proto https`, buffering off on SSE routes
    - _Requirements: 4.17, 4.18, 4.19, 4.20_

  - [ ] 4.8 Create the `nexus` user and `nexus-web` unit
    - Sandboxed unit (`NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, limited `ReadWritePaths`, SIGTERM drain); `/etc/ytl-nexus/*.env` owned `root:nexus` mode 0640; Nexus_Web bound to Loopback
    - _Requirements: 4.13, 4.21, 4.22_

  - [ ] 4.9 Implement `deploy.sh`, `rollback.sh` and health endpoints
    - Release directory per git SHA, `npm ci && npm run build`, migrations, symlink swap, restart, health check
    - Build or migration failure leaves `current` unchanged; failed health check restores the previous release; both exit non-zero
    - `/api/health/live` and `/api/health/ready` (database check with 2 s timeout, see 5.5)
    - _Requirements: 4.23, 4.24, 4.25, 4.26, 5.11, 5.12_

  - [ ] 4.10 Record server facts and write operations docs
    - `lscpu` AVX flags and outbound internet availability in `docs/PROGRESS.md`
    - `docs/operations/deploy.md`, `rollback.md`, `server-baseline.md`, `docs/handover/ca-install.md`
    - _Requirements: 4.27, 4.28_

  - [ ]* 4.11 Write smoke tests and run the rollback drill
    - curl checks (HTTPS 200, HTTP 301, headers, no listing), port scan against the allowlist, Loopback-only bind checks, broken-build rollback drill, SSH after firewalld
    - _Requirements: 4.12, 4.13, 4.18, 4.19, 4.24, 4.25_

- [ ] 5. Platform database (plan Task 5)
  - [ ]* 5.1 Write property tests for migrations and seeds
    - **Property 8: Migration up, down, up is idempotent**
    - **Property 9: Seed determinism**
    - **Validates: Requirements 5.4, 5.6, 5.7, 5.8**

  - [ ]* 5.2 Write the property test for input validation before writes
    - **Property 6: Invalid input is rejected before any write**
    - **Validates: Requirements 5.10, 6.5, 6.6**

  - [ ] 5.3 Implement Kysely data layer, migrations and grants
    - Typed schema with `mysql2`, up and down for every migration, all `ytl_nexus` tables, users `nexus_app`, `nexus_migrate`, `nexus_ingest` (INSERT only); local test database harness
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

  - [ ] 5.4 Implement deterministic seed scripts
    - Generic assets, sites and tickets only; no passwords, keys or tokens
    - _Requirements: 5.7, 5.8_

  - [ ] 5.5 Add Zod validation, parameterized queries and the ready check
    - Validate before any statement; parameterized queries only; `/api/health/ready` reports database state within 2 s whether healthy or not
    - _Requirements: 5.9, 5.10, 5.11, 5.12_

  - [ ] 5.6 Create the module databases and document Oracle MySQL
    - On the server: `nexus_mail`, `nexus_roundcube`, `nexus_sftpgo`, `nexus_wordpress`, each with a single-database user; run `ytl_nexus` migrations and seed
    - `docs/operations/database.md` with the optional Oracle MySQL 8 Podman procedure
    - _Requirements: 5.1, 5.2, 5.13, 5.14_

- [ ] 6. Identity, roles and audit (plan Task 6)
  - [ ]* 6.1 Write property tests for authorization and ownership
    - **Property 3: Role-matrix authorization**
    - **Property 4: Resource ownership prevents IDOR**
    - **Validates: Requirements 3.6, 6.3, 6.4, 6.11, 6.26, 6.27, 6.28**

  - [ ]* 6.2 Write the property test for session validity and lockout
    - **Property 7: Session validity and sign-in lockout**
    - **Validates: Requirements 6.16, 6.17, 6.18**

  - [ ]* 6.3 Write the property test for audit completeness
    - **Property 5: Every mutation writes exactly one audit event**
    - **Validates: Requirements 6.19, 6.20**

  - [ ] 6.4 Configure Better Auth
    - Email/password, admin plugin, TOTP, rate limiting, `nextCookies()` last; four roles; `Secure`, `HttpOnly`, `SameSite=Lax`; 30 min idle and 12 h absolute expiry; session revocation; 5 failures in 15 min lock for 15 min
    - _Requirements: 6.1, 6.2, 6.15, 6.16, 6.17, 6.18_

  - [ ] 6.5 Implement the policy table, guards and audit writer
    - `lib/server/policy.ts` with `ROLE_RANK`; `requireRole`, `requireStepUp` (10 min); Zod on every handler; refused requests audited with no data change; `server-only` data layer with minimal DTOs
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.10, 6.19, 6.20, 6.21, 6.22_

  - [ ] 6.6 Add the proxy redirect, sign-in page and TOTP enrolment
    - Cookie-presence redirect only (never the sole check); enforced enrolment for Operator and Administrator
    - _Requirements: 6.7, 6.8, 6.9_

  - [ ] 6.7 Build the `/control` shell and administrator safeguards
    - Non-admins get the unknown-path 404 and an audit event; Step_Up required; impersonation disabled; admin password reset with no email; first-admin CLI; session revocation action
    - _Requirements: 6.10, 6.11, 6.12, 6.13, 6.14, 6.17_

  - [ ] 6.8 Implement the demo auth adapter and credential separation
    - Fixture session with no auth-database connection; account model replaceable by SSO; WordPress, mail and SFTP credentials stored separately
    - _Requirements: 6.23, 6.24, 6.25_

  - [ ]* 6.9 Write role-matrix e2e tests
    - Every page, Route Handler and Server Function for Visitor and four roles; direct POSTs without session and below minimum role; IDOR attempts
    - _Requirements: 6.26, 6.27, 6.28_

- [ ] 7. Checkpoint - Identity
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Nexus Library and Nexus Studio (plan Task 7)
  - [ ]* 8.1 Write property tests for revalidation, audience filtering and rich text
    - **Property 11: HMAC envelope authentication and replay rejection** (revalidation endpoint)
    - **Property 13: Audience filtering in Library and AI retrieval** (Library part)
    - **Property 14: Outbound text sanitizers remove secrets and unsafe markup** (`sanitizeRichText`)
    - **Validates: Requirements 7.10, 7.11, 7.13, 7.15**

  - [ ] 8.2 Install and lock down WordPress at `/studio`
    - WP-CLI phar with verified checksum, database `nexus_wordpress`, own PHP-FPM pool and user; Apache serves only `wp-admin`, `wp-login.php`, `wp-json`, redirects frontend to `/`; admin paths limited to allowed IPs; Two Factor plugin, XML-RPC and file editing off
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ] 8.3 Build the `nexus-content` plugin
    - Eight REST-enabled post types with fields `audience`, `business_unit`, `related_service`, `source_url`; block publishing company claims without `source_url`; HMAC-signed POST to `/api/revalidate` on publish, update and delete
    - _Requirements: 7.6, 7.7, 7.9_

  - [ ] 8.4 Implement the WordPress client, revalidation and preview
    - `server-only` client with Application Password, fetch tags and ISR; `/api/revalidate` with signature and replay checks, revalidating within 5 s; draft preview only with a signed token under 10 minutes old
    - _Requirements: 7.8, 7.10, 7.11, 7.12_

  - [ ] 8.5 Implement audience filter, sanitizer and image restrictions
    - Visitor sees public only; Viewer and above see public and internal, in pages and APIs; allowlist `sanitizeRichText`; `images.remotePatterns` limited to the uploads path
    - _Requirements: 7.13, 7.14, 7.15_

  - [ ] 8.6 Build Library, Story and FAQ pages with seed content
    - `/library` pages, demo fixtures with editing links hidden, initial overview, runbook and FAQ published; `docs/operations/wordpress.md`
    - _Requirements: 7.13, 7.16, 7.17_

  - [ ]* 8.7 Write contract tests against mocked WordPress JSON
    - _Requirements: 7.8, 7.13, 7.15_

- [ ] 9. Monitoring and Nexus Command (plan Task 8)
  - [ ]* 9.1 Write property tests for the query allowlist and poller
    - **Property 15: Metrics query allowlist**
    - **Property 16: Poller backoff, staleness and stream cap**
    - **Validates: Requirements 8.2, 8.3, 8.4, 8.5, 8.9, 8.18**

  - [ ] 9.2 Install Prometheus and rebind node_exporter
    - Official release with verified checksum, own user and unit, 127.0.0.1:9090, 15-day retention, scrape 127.0.0.1:9100 with the systemd collector; `docs/operations/monitoring.md`
    - _Requirements: 8.1_

  - [ ] 9.3 Implement the PromQL allowlist adapter
    - Fixed queries by ID only; unknown ID rejected, nothing sent, audit result "rejected"
    - _Requirements: 8.2, 8.3, 8.4_

  - [ ] 9.4 Implement the poller and SSE stream
    - One in-process poller at 5 s with backoff to 60 s; `/api/metrics/stream` behind `requireRole("viewer")`; 3 streams per session; client reconnect backoff 1 s to 30 s; stale after 15 s
    - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 8.18, 8.19_

  - [ ] 9.5 Build Command pages and charts
    - `/command`, `/command/core-01`, `/command/metrics` (1 h, 6 h, 24 h, 7 d), `/command/services`; Live/Demo labels; charts with legend, focusable tooltip, 3:1 contrast and data-table alternative; no hostnames or IPs for Visitors
    - _Requirements: 8.10, 8.11, 8.12, 8.20, 8.21_

  - [ ] 9.6 Build the particle field
    - One cluster per tracked service, health-driven colour and motion, pointer response within 100 px, tier step-down below 30 fps, static frame under reduced motion, pause when hidden
    - _Requirements: 8.13, 8.14, 8.15, 8.16, 8.17_

  - [ ] 9.7 Add demo fixtures for metrics
    - Same `MetricsFrame` and SSE shape, deterministic, no Prometheus calls
    - _Requirements: 8.22_

  - [ ]* 9.8 Write e2e tests for SSE and reduced motion
    - Reconnect, role rejection, stale indicator, static frame
    - _Requirements: 8.8, 8.16, 8.18, 8.19_

- [ ] 10. Operations agent, controlled actions and Nexus Status (plan Task 9)
  - [ ]* 10.1 Write property tests for the ops agent and log redaction
    - **Property 10: Ops agent request validation (allowlist)**
    - **Property 11: HMAC envelope authentication and replay rejection** (ops agent)
    - **Property 14: Outbound text sanitizers remove secrets and unsafe markup** (`redactLog`)
    - **Validates: Requirements 9.2, 9.3, 9.4, 9.5, 9.6, 9.9**

  - [ ]* 10.2 Write the property test for health derivation and uptime
    - **Property 17: Service health derivation and uptime**
    - **Validates: Requirements 9.14**

  - [ ] 10.3 Implement the ops agent
    - `services/ops-agent` on a Unix socket in `/run/nexus-ops/`, group `nexus-ops-clients`; HMAC, timestamp ±30 s, nonce 60 s; operations `restart`, `logs` (1 to 500), `health`; four-unit exact allowlist; restart acknowledged within 2 s
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.10_

  - [ ] 10.4 Add polkit rule, log sanitizer and systemd unit
    - Polkit allows only `nexus-ops` to restart the four units; masks secrets, tokens, emails and configured IP ranges in logs; no shell, arbitrary command or firewall path
    - _Requirements: 9.7, 9.8, 9.9, 9.12_

  - [ ] 10.5 Implement the worker and health derivation
    - `services/worker` runs checks every 60 s into `service_checks`; `nodeHealth` and uptime for 24 h, 7 d, 30 d
    - _Requirements: 9.13, 9.14_

  - [ ] 10.6 Build the Operator UI for logs, health and restart
    - Confirm dialog for restart; one audit event for the request and one for the result
    - _Requirements: 9.11, 9.12_

  - [ ] 10.7 Build `/status`
    - Visitor: names and states; Viewer and above: history, incidents, updates; Operator and Administrator manage incidents (audited); `announcement` notices; demo controls disabled with a "Demo session" explanation
    - _Requirements: 9.14, 9.15, 9.16, 9.17, 9.18, 9.19_

  - [ ]* 10.8 Verify polkit denial and allowlist rejection on the server
    - `sshd`, `mariadb`, path tricks and unit-name injection refused; `docs/security/ops-agent.md`
    - _Requirements: 9.6, 9.8_

- [ ] 11. Checkpoint - Operations agent and Status
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Nexus Atlas (plan Task 10)
  - [ ]* 12.1 Write the property test for the Atlas graph
    - **Property 17: Service health derivation and uptime** (one node per service, one edge per dependency)
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [ ] 12.2 Build the graph model and list view
    - Nodes and edges from `services` and `service_dependencies`; list view rendered first; demo fixtures with actions disabled
    - _Requirements: 10.1, 10.2, 10.3, 10.12_

  - [ ] 12.3 Build the lazy graph and node panel
    - Lazy-loaded graph library with list fallback and error message; panel opens within 500 ms with health, 24 h metrics, dependencies, runbook link, 5 latest incidents, role-permitted actions, audit history; fully keyboard operable
    - _Requirements: 10.3, 10.10_

  - [ ]* 12.4 Write keyboard e2e and role-gating tests for Atlas
    - _Requirements: 10.3, 10.10_

- [ ] 13. Nexus Data (plan Task 11)
  - [ ]* 13.1 Write property tests for pagination and CSV export
    - **Property 18: Pagination partitions the result set**
    - **Property 12: CSV export neutralizes formulas and preserves content**
    - **Validates: Requirements 11.1, 11.7, 11.8**

  - [ ] 13.2 Implement search, filter and paginated queries
    - 25 rows per page over `data_assets`, `data_sites`, `data_tickets`
    - _Requirements: 11.1_

  - [ ] 13.3 Implement audited create, update and delete
    - Operator and above; Zod validation before writes; one audit event per attempt
    - _Requirements: 11.2, 11.4, 11.5, 11.6_

  - [ ] 13.4 Implement CSV export
    - Formula neutralization, all rows of the filtered view
    - _Requirements: 11.7, 11.8_

  - [ ] 13.5 Add schema view, supervisor-request explanation and demo mode
    - Read-only ER view; demo writes disabled with a "Demo session" explanation
    - _Requirements: 11.11, 11.12_

  - [ ]* 13.6 Write hostile-input and role-gating tests
    - SQL fragments and markup in every field
    - _Requirements: 11.2, 11.6_

- [ ] 14. Nexus Transfer (plan Task 12)
  - [ ]* 14.1 Write ownership tests for Transfer
    - **Property 4: Resource ownership prevents IDOR** (Transfer account)
    - **Validates: Requirements 12.17, 12.18**

  - [ ] 14.2 Install and configure SFTPGo
    - YUM install as `sftpgo`, provider `nexus_sftpgo`, SFTP on 2022, FTP/WebDAV off, max 10 keys per user, homes under `/srv/nexus-transfer`, `chmod`/`chown` denied, quotas, defender 5 failures in 10 min blocks 30 min; WebClient 127.0.0.1:8090 at `/files/`; admin 127.0.0.1:8091 not proxied; Prometheus scrape every 60 s; `docs/operations/sftp.md`
    - Run after verify-target; no Destructive_Action beyond new configuration
    - _Requirements: 4.13, 12.16_

  - [ ] 14.3 Implement the server-only SFTPGo client and Control account management
    - API key server-side; create, disable, delete accounts, quotas, keys, password reset; every action audited
    - _Requirements: 12.16, 12.17_

  - [ ] 14.4 Build `/transfer`
    - Account derived from the session; mismatched identifiers refused; client guides; fixture account in demo with controls disabled
    - _Requirements: 12.17, 12.18, 12.22_

  - [ ]* 14.5 Write integration tests
    - Password and key login, path escape, quota, defender lockout
    - _Requirements: 12.16, 12.17_

- [ ] 15. Nexus Mail (plan Task 13)
  - [ ] 15.1 Configure Postfix and Dovecot
    - Virtual domain `ytl-nexus.internal` in `nexus_mail`, ARGON2ID (or SHA512-CRYPT), LMTP, IMAPS 993, submission 587 with STARTTLS and SASL, `mynetworks` Loopback only, port 25 not exposed, external recipients permanently rejected with no queued copy
    - _Requirements: 4.12, 13.18_

  - [ ] 15.2 Install Roundcube
    - Verified tarball at `/webmail`, installer removed, own FPM pool, `nexus_roundcube`, secure cookies, 5 failures in 15 min lock the IP for 15 min
    - _Requirements: 13.18_

  - [ ] 15.3 Build the `nexus` Roundcube skin
    - Child of Elastic with Nexus tokens, three panes, Compose in the folder rail, dark mode, mobile flow, accessible focus; no particle or transform animation on the inbox
    - _Requirements: 3.14, 3.16_

  - [ ] 15.4 Implement Control mailbox administration
    - Create, disable, reset password, quota via a DB user restricted to virtual-user tables; failures leave the mailbox unchanged; every attempt audited
    - _Requirements: 13.19, 13.20_

  - [ ] 15.5 Build `/mail`
    - Requires member; status, client settings, `mail_help`, `/webmail/` link; demo fixture status
    - _Requirements: 13.18, 13.21_

  - [ ]* 15.6 Write mail tests
    - Send and receive between two mailboxes, open-relay test fails, external recipient rejected, TLS on 587 and 993, login rate limit, admin IDOR refused
    - _Requirements: 13.18, 13.19, 13.20_

- [ ] 16. Checkpoint - Mail
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Nexus AI (plan Task 14)
  - [ ]* 17.1 Write property tests for limits, retrieval audience and prompts
    - **Property 19: AI and public-handler rate and size limits**
    - **Property 13: Audience filtering in Library and AI retrieval** (retrieval)
    - **Property 14: Outbound text sanitizers remove secrets and unsafe markup** (`buildPrompt`)
    - **Validates: Requirements 14.4, 14.8, 14.9, 14.11, 14.12, 14.17**

  - [ ] 17.2 Benchmark models and document the choice
    - Update Ollama if needed and keep it on Loopback; measure `gemma3:4b-it-qat`, `gemma3:1b-it-qat`, `tinyllama` and an embedding model; record in `docs/operations/ai.md`
    - _Requirements: 4.13, 4.27_

  - [ ] 17.3 Implement worker indexing
    - Index WordPress content by audience and runbooks into `ai_chunks`; re-index on revalidation
    - _Requirements: 14.4_

  - [ ] 17.4 Implement retrieval, prompt builder and chat API
    - Audience filter before ranking; retrieved text framed as data; SSE streaming; 4,000-character prompt, 20 requests/min per user, 10/min per IP for `yes-public`, 2 concurrent generations; conversations owned by the caller
    - _Requirements: 14.4, 14.8, 14.9, 14.11, 14.12, 14.17_

  - [ ] 17.5 Build `/ai`
    - Streaming chat, stop button, conversation list and delete, citations linking to Library, clear error states
    - _Requirements: 14.4, 14.17_

  - [ ] 17.6 Add "Explain with Nexus AI"
    - Sanitized summaries; 30 s timeout; panel stays open on failure; in Atlas node panel and Status incidents
    - _Requirements: 10.3, 14.11_

  - [ ] 17.7 Add the `yes-public` scope and demo scripted answers
    - _Requirements: 14.9, 14.17_

- [ ] 18. Yes Experience (plan Task 15)
  - [ ] 18.1 Port the Yes pages into `app/(yes)/yes/*` and `modules/yes`
    - `/yes`, `/yes/plans`, `/yes/coverage`, `/yes/support`; official logomarks and exact Yes colours; petals respect reduced motion; working mobile navigation
    - _Requirements: 3.11, 15.7_

  - [ ] 18.2 Implement validated coverage and support forms
    - Zod, per-field errors, input preserved, honest confirmation
    - _Requirements: 15.7_

  - [ ] 18.3 Fix and connect the chatbot
    - Scope `yes-public`, chronological messages persist after reply, responsive width
    - _Requirements: 14.9, 15.7_

  - [ ] 18.4 Replace claims and links
    - Official yes.my wording with source, or the label "Concept design – not live pricing"; links only to yes.my or official social accounts
    - _Requirements: 15.7_

  - [ ]* 18.5 Write e2e tests
    - Four pages, mobile nav regression, chatbot regression, axe at 390 and 3840 px
    - _Requirements: 15.13_

- [ ] 19. Nexus Continuity (plan Task 16)
  - [ ] 19.1 Implement the backup script and daily timer
    - Five DB dumps, `/etc/ytl-nexus`, service config, WordPress uploads, Roundcube config, SFTPGo snapshot, mail storage; compression, SHA-256, retention 7 daily and 4 weekly; one `backup_runs` row via `nexus_ingest`
    - _Requirements: 5.1, 16.16_

  - [ ] 19.2 Implement the weekly restore test
    - Restore to scratch databases, compare counts and checksums, write `restore_tests`
    - _Requirements: 16.16_

  - [ ] 19.3 Build `/continuity`
    - Viewer summary, Operator detail, no trigger endpoints; stale backup raises a finding in Status and Shield
    - _Requirements: 16.18_

  - [ ]* 19.4 Run a restore drill and corrupt-archive test
    - `docs/operations/backup-restore.md`
    - _Requirements: 16.16_

- [ ] 20. Nexus Shield (plan Task 17)
  - [ ]* 20.1 Write parser and sanitizer tests
    - **Property 14: Outbound text sanitizers remove secrets and unsafe markup** (`sanitizeEvidence`)
    - Fixture-driven parser and severity tests per check
    - **Validates: Requirements 16.16**

  - [ ] 20.2 Implement the root scan timer
    - TLS expiry, ports against allowlist, firewalld, updates, failed logins, SSH flags, SELinux, disk, time sync, backup freshness, fail2ban; JSON output; no remediation
    - _Requirements: 16.20_

  - [ ] 20.3 Ingest scan results
    - Worker writes `shield_findings` with severity, sanitized evidence, guidance
    - _Requirements: 16.16, 16.20_

  - [ ] 20.4 Build `/shield`
    - Operator and above, read-only; findings for root SSH, password SSH and SELinux disabled with guidance
    - _Requirements: 16.18, 16.20_

- [ ] 21. Nexus Tour, Project Story and demo mode (plan Task 18)
  - [ ] 21.1 Build `/tour` and presenter mode
    - `tour_step` content with Demo_Mode fixtures only; signal-ribbon transition (fade under reduced motion); ArrowRight/Space next, ArrowLeft previous, Escape exits; webmail screenshots instead of live webmail
    - _Requirements: 1.11, 13.21_

  - [ ] 21.2 Build `/story`
    - Case study chapters from `story_chapter` content
    - _Requirements: 7.6_

  - [ ] 21.3 Complete demo fixtures and docs
    - Every route renders offline with "Demo data" labels; `docs/operations/demo-mode.md`
    - _Requirements: 1.9, 1.10, 1.13, 1.14_

  - [ ]* 21.4 Write Tour and presenter e2e tests
    - No outbound live calls during the tour
    - _Requirements: 1.11, 1.12_

- [ ] 22. Nexus Control completion and cross-module links (plan Task 19)
  - [ ]* 22.1 Write the audit completeness and role-matrix e2e tests
    - Every mutation produces exactly one event; CSV formula neutralization for the audit export
    - _Requirements: 17.10, 17.17, 17.25_

  - [ ] 22.2 Complete user and role administration
    - Create, change role, disable, revoke sessions, reset password, force 2FA re-enrolment
    - _Requirements: 6.13, 17.19, 17.24_

  - [ ] 22.3 Add SFTP, mail, service-action and configuration screens
    - Non-secret configuration view only
    - _Requirements: 17.19, 17.24_

  - [ ] 22.4 Build the audit viewer with filters and CSV export
    - _Requirements: 17.17, 17.19_

  - [ ] 22.5 Add related links and the command palette
    - `Cmd/Ctrl+K` navigates to pages only; contextual links across Atlas, Status, Library, AI, Continuity, Shield, Control
    - _Requirements: 17.10_

- [ ] 23. Quality, motion and 4K pass (plan Task 20)
  - [ ] 23.1 Add performance budgets and CI gates
    - Lighthouse and bundle budgets, zero serious axe violations, font subsetting, image `sizes` and AVIF
    - _Requirements: 3.18, 18.4_

  - [ ] 23.2 Run the accessibility, motion and responsive audit
    - Contrast in dark and light, reduced-motion audit, 390, 768, 1440, 2560 and 3840 px, particle tier tuning
    - _Requirements: 3.11, 3.15, 3.16, 3.17, 3.18_

  - [ ] 23.3 Add visual regression and a light load test
    - Snapshots at high DPI, SSE and page load check, Lighthouse report in `docs/design/`
    - _Requirements: 3.18, 8.9_

- [ ] 24. Security hardening and final review (plan Task 21)
  - [ ] 24.1 Enforce CSP and rate limits
    - CSP on every HTML response; 60 requests/min per client on public handlers with retry time
    - _Requirements: 18.4, 18.5_

  - [ ] 24.2 Write the security review script
    - Detect handlers lacking `requireRole`, secrets in `NEXT_PUBLIC_`, mutations lacking audit calls
    - _Requirements: 1.15, 6.3, 6.20_

  - [ ] 24.3 Verify server hardening
    - gitleaks over full history, `npm audit`, `systemd-analyze security` per Nexus unit, Loopback-only checks, external port scan against the firewall allowlist, fail2ban jails (sshd, SFTPGo, Postfix) with the owner IP ignored
    - _Requirements: 4.12, 4.13, 18.4_

  - [ ]* 24.4 Write the security e2e suite
    - Auth bypass, CSRF/origin on Server Functions, IDOR on Transfer and Mail administration
    - _Requirements: 6.27, 6.28, 18.14_

  - [ ] 24.5 Update the threat model and run a code review
    - `docs/security/threat-model.md` with residual risks
    - _Requirements: 18.4_

- [ ] 25. Checkpoint - Before handover
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 26. Documentation, handover and v1.0.0 release (plan Task 22)
  - [ ] 26.1 Write handover documents
    - Owners and roles (Logesh, Azlin, Sonu), account inventory without secrets, rotation checklist (Better Auth secret, DB users, SFTPGo key, WordPress Application Password, ops HMAC, webhook secret, CA), DNS template, CA guide, known risks, roadmap, rehearsal script
    - _Requirements: 4.28, 18.4_

  - [ ] 26.2 Publish service runbooks into WordPress Library
    - Content available to Nexus AI indexing
    - _Requirements: 7.16, 14.4_

  - [ ] 26.3 Bundle and remove the local Yes project after written owner confirmation
    - `git bundle create` to `~/ytl-nexus-backups/`, verify, then delete only after explicit written owner confirmation
    - _Requirements: 1.16_

  - [ ]* 26.4 Run a docs-only drill
    - Deploy, roll back and restore using only the documents
    - _Requirements: 4.23, 4.25, 4.28_

  - [ ] 26.5 Tag `v1.0.0` and deploy
    - Run `deploy.sh` on the tagged commit after all checks pass; record in `docs/PROGRESS.md`
    - _Requirements: 4.23, 4.26_

## Notes

- Tasks marked with `*` are optional test sub-tasks and can be skipped for a faster MVP.
- Property tests use fast-check and run at least 100 iterations; each cites its design property number.
- Test sub-tasks precede the implementation they check, so each property test is written to fail first.
- Server tasks 4.x and the server parts of later tasks must pass verify-target before any change.
- This workflow only produces planning artifacts. Begin execution by opening this file and choosing "Start task" on a task.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    {
      "id": 1,
      "tasks": [
        "1.2",
        "2.1",
        "3.1",
        "3.2",
        "4.1",
        "5.1",
        "5.2",
        "6.1",
        "6.2",
        "6.3"
      ]
    },
    { "id": 2, "tasks": ["1.3", "2.2", "4.2", "5.3"] },
    { "id": 3, "tasks": ["1.4", "2.3", "3.3", "4.3", "5.4", "5.5", "6.4"] },
    { "id": 4, "tasks": ["2.4", "3.4", "3.5", "4.4", "6.5", "6.8"] },
    { "id": 5, "tasks": ["4.5", "6.6", "6.7"] },
    {
      "id": 6,
      "tasks": [
        "4.6",
        "5.6",
        "6.9",
        "8.1",
        "9.1",
        "10.1",
        "10.2",
        "12.1",
        "13.1",
        "14.1",
        "17.1",
        "20.1"
      ]
    },
    { "id": 7, "tasks": ["4.7", "8.4", "8.5", "9.2", "9.3", "10.3", "13.2"] },
    { "id": 8, "tasks": ["4.8", "8.2", "9.4", "10.5", "13.3", "14.2", "15.1"] },
    {
      "id": 9,
      "tasks": [
        "4.9",
        "8.3",
        "9.5",
        "10.4",
        "10.6",
        "12.2",
        "13.4",
        "14.3",
        "15.2",
        "17.2"
      ]
    },
    {
      "id": 10,
      "tasks": [
        "4.10",
        "4.11",
        "8.6",
        "9.6",
        "10.7",
        "10.8",
        "12.3",
        "13.5",
        "14.4",
        "15.3",
        "15.4",
        "17.3"
      ]
    },
    {
      "id": 11,
      "tasks": [
        "8.7",
        "9.7",
        "9.8",
        "12.4",
        "13.6",
        "14.5",
        "15.5",
        "17.4",
        "18.1",
        "19.1",
        "20.2"
      ]
    },
    { "id": 12, "tasks": ["15.6", "17.5", "18.2", "19.2", "20.3"] },
    { "id": 13, "tasks": ["17.6", "17.7", "19.3", "20.4", "22.1"] },
    {
      "id": 14,
      "tasks": ["18.3", "18.4", "19.4", "21.1", "21.2", "22.2", "22.3"]
    },
    { "id": 15, "tasks": ["18.5", "21.3", "22.4"] },
    { "id": 16, "tasks": ["21.4", "22.5", "23.1"] },
    { "id": 17, "tasks": ["23.2", "24.1", "24.2"] },
    { "id": 18, "tasks": ["23.3", "24.3", "24.4"] },
    { "id": 19, "tasks": ["24.5", "26.1", "26.2"] },
    { "id": 20, "tasks": ["26.3", "26.4"] },
    { "id": 21, "tasks": ["26.5"] }
  ]
}
```
