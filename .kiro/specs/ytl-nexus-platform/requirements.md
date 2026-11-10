# Requirements Document

## Introduction

YTL Nexus is a unified internship platform for the YTL Communications IT Infrastructure team. It replaces earlier draft sites on a single Rocky Linux server with one Next.js 16.3.5 application plus host services (Apache, MariaDB, Prometheus, Ollama, SFTPGo, Postfix, Dovecot, Roundcube, WordPress). It runs as a controlled internal pilot, doubles as a portfolio showcase, and is handed over to the IT Infrastructure team (Logesh, Azlin, Sonu).

Scope, roles, security and design are fixed by `docs/product.md`, `docs/tech.md`, `docs/security.md`, `docs/design-language.md`, `docs/structure.md`, `docs/spec/implementation-plan.md` and the module specs 10 to 23 in `docs/spec/`. This document consolidates them into testable requirements. Module-level IDs (for example IAM-05, OPS-04) are cited for traceability.

## Glossary

- **Nexus_Platform**: The complete YTL Nexus system: the Nexus_Web application, host services and root timers.
- **Nexus_Web**: The Next.js application (`nexus-web` service) serving every Nexus page and API.
- **Nexus_Worker**: The `nexus-worker` service that runs scheduled checks, AI indexing and report ingestion.
- **Nexus_Ops_Agent**: The `nexus-ops` agent, an unprivileged service on a Unix socket that performs only allowlisted `restart`, `logs` and `health` operations.
- **Nexus_Core_01**: The Rocky Linux server (10.26.64.164, `nexus-core-01`) that hosts the platform.
- **Apache**: The Apache httpd instance that terminates TLS and is the only public web entry point.
- **Live_Mode**: Operation with `NEXUS_MODE=live`, using real services.
- **Demo_Mode**: Operation with `NEXUS_MODE=demo`, running the full UI on deterministic fixtures with no server calls.
- **Live_Demo_Label**: A visible **Live** or **Demo** marker (or "Demo data" / "Demo session" text) attached to displayed values.
- **Visitor**: A user who is not signed in.
- **Viewer / Member / Operator / Administrator**: Roles in ascending order of capability, as defined in the role matrix of `docs/product.md`.
- **Role_Guard**: The server-side `requireRole(minRole)` check applied in every protected page, layout, Route Handler and Server Function.
- **Step_Up**: Re-authentication with password plus TOTP within the last 10 minutes (`requireStepUp()`).
- **Audit_Event**: A row in `audit_events` recording actor, role, action, target, result, source IP and timestamp.
- **Nexus_Command**: Infrastructure dashboard with the particle field (`/command/*`).
- **Nexus_Atlas**: Service dependency map (`/command/atlas`).
- **Nexus_Status**: Health history, incidents and maintenance notices (`/status`).
- **Nexus_AI**: Local Ollama-based knowledge and operations assistant (`/ai`).
- **Nexus_Transfer**: SFTP service and browser file portal built on SFTPGo (`/transfer`, `/files/`).
- **Nexus_Mail**: Postfix, Dovecot and Roundcube webmail (`/mail`, `/webmail/`).
- **Nexus_Data**: MariaDB demonstration records (`/data`).
- **Nexus_Library**: Pages rendering runbooks, FAQs and notes from WordPress (`/library`).
- **Nexus_Studio**: Headless WordPress at `/studio`.
- **Nexus_Continuity**: Backups and restore verification (`/continuity`).
- **Nexus_Shield**: Read-only security posture view (`/shield`).
- **Nexus_Tour**: Guided, sanitized walkthrough (`/tour`).
- **Project_Story**: The internship case study (`/story`).
- **Nexus_Control**: Hidden Administrator area (`/control/*`).
- **Yes_Experience**: The Yes website redesign under `/yes/*`.
- **Loopback**: The addresses 127.0.0.1 and `::1`, or a Unix socket.
- **Destructive_Action**: Deleting old server content, formatting `sdb`, enabling firewalld or changing the hostname.

## Requirements

### Requirement 1: Platform foundation, demo mode and tooling

**User Story:** As a developer, I want a clean repository with one codebase that runs live or on fixtures, so that the platform can be built, tested and presented anywhere.

#### Acceptance Criteria

1. THE Nexus_Platform SHALL be a single Next.js 16.3.5 application written in TypeScript strict mode and running on Node.js 24 LTS.
2. THE Nexus_Platform SHALL reside in the repository `ytl-nexus`, with the directory layout defined in `docs/structure.md`.
3. WHEN a commit is made, THE pre-commit hook SHALL run gitleaks, a formatting check and a lint check.
4. IF gitleaks, the formatting check or the lint check reports one or more findings, THEN THE pre-commit hook SHALL exit with a non-zero status, reject the commit, and print the failing check name and each finding.
5. WHEN code is pushed, THE CI pipeline SHALL run secret scan, format check, lint, typecheck, unit tests, build and end-to-end smoke tests.
6. IF any CI stage fails, THEN THE CI pipeline SHALL mark the run as failed and identify the failing stage.
7. THE Nexus_Web SHALL provide a `live` implementation and a `demo` implementation for each of the eight server adapters: database, auth, WordPress, Prometheus, Ollama, SFTPGo, Nexus_Ops_Agent and mail, selected by the `NEXUS_MODE` value (DEMO-01).
8. IF `NEXUS_MODE` is unset or is neither `live` nor `demo`, THEN THE Nexus_Web SHALL refuse to start and report an error naming `NEXUS_MODE` and the accepted values.
9. WHILE Demo_Mode is active, THE Nexus_Web SHALL serve responses from the fixtures in `lib/fixtures`, and two identical requests SHALL return identical data values (DEMO-02).
10. WHILE Demo_Mode is active, THE Nexus_Web SHALL attach a Live_Demo_Label reading "Demo" or "Demo data" to every displayed value that comes from a fixture (DEMO-03).
11. WHILE Demo_Mode is active, THE Nexus_Web SHALL make 0 outbound network calls to live adapters (DEMO-05).
12. THE CI pipeline SHALL include an automated test that fails if any outbound call to a live adapter is attempted while Demo_Mode is active (DEMO-05).
13. WHEN `NEXUS_MODE=demo npm run build && npm start` runs with the network disabled, THE Nexus_Web SHALL build and start without error and SHALL render every route without a server error (DEMO-04).
14. WHILE Demo_Mode is active, THE Nexus_Web SHALL offer a session switcher with exactly four options (Viewer, Member, Operator and Administrator), and the active session SHALL be labelled "Demo session" (DEMO-06).
15. THE Nexus_Web SHALL NOT expose any secret value in a `NEXT_PUBLIC_` variable, in a log entry, in an error response or in the client-delivered bundle.
16. WHEN the owner moves or deletes a local file during cleanup, THE repository SHALL record each move or deletion in `docs/PROGRESS.md`, including the file path and the date, in the same commit as the change.

### Requirement 2: Brand assets and design system

**User Story:** As a designer, I want correct logos and a documented token system, so that every page follows the Adaptive Nexus design language.

#### Acceptance Criteria

1. WHEN the asset pipeline runs, THE asset pipeline SHALL convert each official YTL and Yes vector master into one SVG logo with a lowercase kebab-case filename (characters a-z, 0-9 and single hyphens only) and one sRGB PNG fallback.
2. WHEN the asset pipeline completes, THE asset pipeline SHALL write `assets/asset-manifest.md` with one entry for every converted file, and each entry SHALL record original filename, checksum, new filename, placement, variant and alt text.
3. IF a file in the asset directories has a banned filename or a filename that is not lowercase kebab-case, THEN THE CI pipeline SHALL fail and report the path of each offending file.
4. THE Nexus_Web SHALL render each logo at a height of at least 31 CSS px with its aspect ratio preserved.
5. THE Nexus_Web SHALL render each logo with clear space on all four sides equal to the height of the Nine Pillars symbol.
6. THE Nexus_Web SHALL render each logo without recolouring, rotation or stretching.
7. THE Nexus_Web SHALL define colour, type, spacing, radius, shadow, motion and z-layer tokens in Tailwind v4 `@theme`.
8. THE Nexus_Web SHALL reference colour values in components only through semantic tokens, with zero raw hex values in component source.
9. THE Nexus_Web SHALL load only open-licence fonts, through `next/font/local` or a font npm package.
10. WHEN the Nexus_Web is built on the server, THE build SHALL make zero font download requests.
11. WHERE a status colour (green, amber or red) is shown, THE Nexus_Web SHALL pair it with a non-colour indicator (icon or text label).
12. THE Nexus_Web SHALL use green, amber and red only to indicate status.
13. WHEN a Viewer, Member, Operator or Administrator requests `/design`, THE Nexus_Web SHALL display logos on light and dark backgrounds, clear-space overlays, token swatches and a type specimen.
14. IF a Visitor requests `/design`, THEN THE Role_Guard SHALL deny access and THE Nexus_Web SHALL not display any `/design` content.
15. THE project SHALL document asset sourcing rules in `docs/design/asset-sourcing.md`, including the exclusion of stock images with unclear licences and the exclusion of the Soho fonts.

### Requirement 3: App shell, navigation and motion system

**User Story:** As a user, I want consistent, accessible navigation across public and workspace areas, so that I can reach every module on any device.

#### Acceptance Criteria

1. THE Nexus_Web SHALL render the public editorial layout on public routes and the dense dark workspace layout on workspace routes.
2. THE Nexus_Web SHALL render on every page exactly one skip link that is the first focusable element and moves focus to the main landmark when activated, the `header`, `nav`, `main` and `footer` landmarks, and exactly one `h1`.
3. THE Nexus_Web SHALL provide global navigation containing a link to every module listed in `docs/product.md`, and contextual sub-navigation on every module page that has child routes.
4. WHEN the viewport width is below 768 px, THE Nexus_Web SHALL replace the global navigation with a mobile navigation control that opens and closes by keyboard and touch, and that returns focus to the control on close.
5. THE Nexus_Web SHALL render in the footer only links that resolve to an existing route or a valid external URL, with zero links to `#` or empty targets.
6. WHEN a page renders, THE Nexus_Web SHALL show only the menu items whose minimum role is at or below the signed-in role, and SHALL show Visitor menu items when no user is signed in.
7. THE Nexus_Web SHALL display on every page a Live_Demo_Label and an environment badge stating the current mode (Live_Mode or Demo_Mode).
8. THE Nexus_Web SHALL provide a page, either a stub stating the module is not yet available or a full page, for every route listed in `docs/product.md`, and no listed route SHALL return a not-found response.
9. THE Nexus_Web SHALL include a `noindex` robots directive on every workspace route and every `/control` route.
10. THE Nexus_Web SHALL wrap the application in `MotionConfig reducedMotion="user"`.
11. WHILE `prefers-reduced-motion: reduce` is set, THE Nexus_Web SHALL, on every page, render zero animated particles, no parallax and no transform animation larger than 8 px of translation or 5% scale, SHALL keep opacity transitions, and SHALL show a static particle frame where a particle field is present.
12. THE Nexus_Web SHALL scale particle quality down when device pixel ratio is above 2, when device memory is below 4 GB, or when the average frame time over 60 frames exceeds 20 ms.
13. WHILE the browser tab is hidden, THE Nexus_Web SHALL pause particle rendering, and WHEN the tab becomes visible, THE Nexus_Web SHALL resume rendering within 500 ms.
14. THE Nexus_Web SHALL use no particle, parallax or transform animation on forms, tables, Nexus_Control pages or the mail inbox.
15. THE Nexus_Web SHALL meet WCAG 2.2 AA text contrast of at least 4.5:1 for normal text and at least 3:1 for large text (18 pt, or 14 pt bold, and above) and UI component boundaries.
16. THE Nexus_Web SHALL show a visible focus indicator with at least 3:1 contrast against adjacent colors on every focusable element, and SHALL give every icon-only button an accessible name.
17. THE Nexus_Web SHALL size every touch target at no less than 44×44 px on viewports below 768 px.
18. WHEN any route is tested at viewport widths of 390, 1440 and 3840 px, THE axe scan SHALL report zero serious and zero critical violations, and the page SHALL have no horizontal scrolling (document scroll width not greater than viewport width).

### Requirement 4: Server preparation and deployment

**User Story:** As an infrastructure engineer, I want a backed-up, cleaned and hardened server with repeatable deploy and rollback, so that the platform runs safely on Nexus_Core_01.

#### Acceptance Criteria

1. WHEN a Destructive_Action is about to run, THE operator SHALL first verify that the target hostname, IP 10.26.64.164 and machine ID match the recorded values for Nexus_Core_01.
2. IF the hostname, IP or machine ID differs from the recorded values, THEN THE operator SHALL stop and run no Destructive_Action.
3. WHEN old server content is to be removed, THE operator SHALL first create the preflight backup containing a MariaDB dump of all databases, `/var/www`, service configuration, mail storage, Podman inspect output and crontabs.
4. WHEN the preflight backup is created, THE operator SHALL copy it off the server, verify the checksum of every copied file, and confirm the archive opens and lists its contents.
5. IF checksum verification fails or the archive does not open, THEN THE operator SHALL stop, perform no removal, and report the failure to the owner.
6. WHEN the verified backup exists, THE operator SHALL present one itemized removal list to the owner and SHALL remove only the items on that list, and only after explicit owner approval of that list.
7. IF the owner does not approve the removal list, THEN THE operator SHALL perform no removal.
8. WHEN removal completes, THE set of OS user accounts and the `sssd` configuration SHALL be identical to their state before removal.
9. IF `realm list` shows the host is joined to a directory, THEN THE operator SHALL add hostname aliases only and SHALL NOT rename the host.
10. WHEN firewalld is to be enabled, THE operator SHALL add the ssh service first, schedule an automatic firewalld stop 5 minutes later, and verify SSH login from a new connection.
11. WHEN the new-connection SSH login succeeds within the 5 minutes, THE operator SHALL cancel the scheduled firewalld stop.
12. THE firewall SHALL accept inbound connections on only ports 22, 80, 443, 2022, 587 and 993, and SHALL reject all other inbound ports.
13. THE Nexus_Platform SHALL bind MariaDB, Ollama, Prometheus, node_exporter, Nexus_Web and the SFTPGo administration interface to Loopback only, so that none is reachable from another host.
14. WHEN `sdb` is to be mounted, THE operator SHALL first verify that the disk holds no partitions or signatures, and SHALL then mount it at `/srv/nexus-transfer` with `nosuid,nodev,noexec`.
15. IF `sdb` holds a partition or signature, THEN THE operator SHALL NOT mount or format it and SHALL report the finding to the owner.
16. THE Nexus_Core_01 SHALL run `chronyd` enabled at boot, and `chronyd` SHALL report a synchronised state.
17. THE Apache SHALL terminate TLS with an internal CA certificate whose SANs include `ytl-nexus.ytlcomms.my`, `ytl-nexus.internal`, `sn1lyvx1d0002.ytlcomms.my` and `10.26.64.164`.
18. THE Apache SHALL redirect every port 80 request to HTTPS and SHALL disable directory listing.
19. THE Apache SHALL send HSTS, CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `frame-ancestors` headers on every HTTPS response.
20. THE Apache SHALL proxy non-excluded paths to 127.0.0.1:3000 with `ProxyPreserveHost On` and `X-Forwarded-Proto https`, and SHALL disable buffering on SSE routes.
21. THE `nexus-web` unit SHALL run as the `nexus` user with `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp`, `ReadWritePaths` limited to paths the service writes, and graceful `SIGTERM` drain.
22. THE `nexus-web` unit SHALL load environment files from `/etc/ytl-nexus/*.env`, each owned `root:nexus` with mode 0640.
23. WHEN `deploy.sh` runs a tagged commit, THE script SHALL create `/opt/ytl-nexus/releases/<git-sha>`, run `npm ci && npm run build` on the server, run migrations, swap the `current` symlink, restart, and health-check.
24. IF the build or migrations fail, THEN THE deploy script SHALL leave the `current` symlink unchanged and exit with a failure status.
25. IF the post-deploy health check fails, THEN THE deploy script SHALL restore the `current` symlink to the previous release, restart, and exit with a failure status.
26. THE Nexus_Web SHALL expose `/api/health/live` and `/api/health/ready`.
27. THE project SHALL record `lscpu` AVX flags and outbound internet availability in `docs/PROGRESS.md`.
28. THE project SHALL document deploy, rollback, server baseline and CA installation in `docs/operations/` and `docs/handover/`.

### Requirement 5: Platform database

**User Story:** As a developer, I want a versioned, least-privilege MariaDB schema with seed data, so that all modules share a safe data layer and the supervisor's database request is met.

#### Acceptance Criteria

1. THE Nexus_Platform SHALL provide database `ytl_nexus` with users `nexus_app` (DML only, on application tables), `nexus_migrate` (DDL) and `nexus_ingest` (INSERT only, on scan and backup tables, with no SELECT, UPDATE or DELETE privilege) (DB-01).
2. THE Nexus_Platform SHALL provide separate databases `nexus_mail`, `nexus_roundcube`, `nexus_sftpgo` and `nexus_wordpress`, each with its own user whose privileges are limited to that one database (DB-06).
3. THE data layer SHALL use Kysely with `mysql2` and a typed schema (DB-03).
4. THE data layer SHALL provide every SQL migration with both an up step and a down step (DB-03).
5. THE schema SHALL include the tables `audit_events`, `services`, `service_dependencies`, `service_checks`, `incidents`, `incident_updates`, `backup_runs`, `restore_tests`, `shield_findings`, `data_assets`, `data_sites`, `data_tickets`, `ai_chunks` and `ai_conversations` (DB-04).
6. WHEN migrations run up, then down, then up again on an empty database, THE migration tool SHALL complete each run without error and SHALL leave the schema after the second up identical to the schema after the first up.
7. WHEN a seed script runs twice on an empty migrated database, THE seed script SHALL produce identical row contents after each run (DB-05).
8. THE seed scripts SHALL insert only generic infrastructure assets, sites and maintenance tickets, and SHALL NOT insert confidential data, passwords, private keys or tokens (DB-05).
9. THE data layer SHALL execute every query as a parameterized query, with no user-supplied value concatenated into SQL text.
10. IF input fails Zod validation, THEN THE data layer SHALL reject the input with a validation error before any database statement runs, and SHALL leave stored data unchanged.
11. WHEN the database is reachable, THE `/api/health/ready` endpoint SHALL report the database as healthy within 2 seconds.
12. IF the database is unreachable, THEN THE `/api/health/ready` endpoint SHALL report the database as unhealthy within 2 seconds.
13. WHERE Logesh confirms that exact Oracle MySQL 8 is required, THE operator SHALL run it in an isolated Podman container loaded with the same dataset as `ytl_nexus` (DB-07).
14. THE project SHALL document the Oracle MySQL 8 procedure in `docs/operations/database.md` whether or not Oracle MySQL 8 is enabled (DB-07).

### Requirement 6: Identity, roles and audit

**User Story:** As an administrator, I want central role-based sign-in with auditing, so that every action is authorized on the server and traceable.

#### Acceptance Criteria

1. THE Nexus_Web SHALL authenticate users with Better Auth on MariaDB using email and password, configured with the admin plugin, TOTP two-factor and rate limiting, and with `nextCookies()` as the last plugin in the plugin list (IAM-01).
2. THE Nexus_Web SHALL assign each account exactly one role from viewer, member, operator and admin (IAM-01).
3. THE Nexus_Web SHALL enforce the role matrix of `docs/product.md` on the server by calling the Role_Guard in every protected page, layout, Route Handler and Server Function (IAM-04).
4. IF a Role_Guard check fails because the session is missing or the role is below the required minimum, THEN THE Nexus_Web SHALL refuse the request without executing the handler, make no data change, and record an Audit_Event with result refused (IAM-04).
5. THE Nexus_Web SHALL validate input with a Zod schema in every Route Handler and Server Function before use (IAM-04).
6. IF Zod validation of input fails, THEN THE Nexus_Web SHALL reject the request with an error indicating invalid input, make no data change, and record an Audit_Event with result refused (IAM-04).
7. WHEN a request has no session cookie, THE Nexus_Web proxy SHALL redirect it to the sign-in page.
8. THE Nexus_Web proxy SHALL NOT be the sole authorization check for any protected resource.
9. WHEN an Operator or Administrator signs in without TOTP enrolled, THE Nexus_Web SHALL require TOTP enrolment before granting access to any protected page (IAM-03).
10. WHEN a request targets `/control/*`, THE Nexus_Web SHALL require Step_Up, meaning password plus TOTP verified within the last 10 minutes (IAM-05).
11. IF a non-Administrator requests `/control/*`, THEN THE Nexus_Web SHALL return 404 with the same response body as for a non-existent path (so the area's existence is not revealed), and record an Audit_Event with result refused (IAM-06).
12. THE Nexus_Web SHALL disable Administrator impersonation, so that no endpoint or UI action lets an Administrator obtain a session as another user (IAM-07).
13. WHEN an Administrator resets a user's password, THE Nexus_Web SHALL complete the reset without sending any email (IAM-08).
14. THE Nexus_Platform SHALL provide a first-admin CLI script that creates the initial Administrator when run on Nexus_Core_01 (IAM-08).
15. THE Nexus_Web SHALL set every session cookie with the `Secure`, `HttpOnly` and `SameSite=Lax` attributes (IAM-09).
16. THE Nexus_Web SHALL expire a session after 30 minutes of inactivity or 12 hours after sign-in, whichever occurs first (IAM-09).
17. WHEN an Administrator revokes a session, THE Nexus_Web SHALL reject the next request that uses that session and require sign-in again (IAM-09).
18. IF 5 sign-in attempts fail within 15 minutes for one account or one source IP, THEN THE Nexus_Web SHALL reject further sign-in attempts for that account or IP for 15 minutes, indicate the lockout in the error response, and record an Audit_Event.
19. WHEN an authentication event occurs, successful or refused, THE Nexus_Web SHALL write an Audit_Event recording actor, role, action, target, result, source IP and timestamp (IAM-10).
20. WHEN a modifying action occurs, successful or refused, THE Nexus_Web SHALL write an Audit_Event recording actor, role, action, target, result, source IP and timestamp (IAM-10).
21. THE Nexus_Web SHALL access data only through a `server-only` data layer that returns minimal DTOs.
22. THE Nexus_Web SHALL NOT pass raw database rows, tokens or internal error details to Client Components.
23. THE Nexus_Web account model SHALL allow corporate SSO to replace local accounts without changes to module code (IAM-11).
24. THE Nexus_Platform SHALL store WordPress Editor, mail and SFTP credentials separately from Nexus credentials, so that a Nexus credential does not authenticate to those services and the reverse (IAM-12).
25. WHILE Demo_Mode is active, THE Nexus_Web SHALL NOT open any connection to the auth database (IAM demo rule).
26. THE test suite SHALL cover every page, Route Handler and Server Function for each of the roles viewer, member, operator and admin, plus the Visitor case.
27. THE test suite SHALL include direct POST requests with no session and with a role below the required minimum, and each SHALL be refused without data change.
28. THE test suite SHALL include IDOR tests that use another user's identifiers, and each SHALL be refused without exposing or changing that user's data.

### Requirement 7: Nexus Library and Nexus Studio content

**User Story:** As an editor, I want to manage runbooks, FAQs and notices in WordPress and see them in Nexus, so that documentation stays current without code changes.

#### Acceptance Criteria

1. THE Nexus_Studio SHALL run a fresh WordPress installation at `/studio`, installed with a WP-CLI phar whose checksum was verified before use, using database `nexus_wordpress` and its own PHP-FPM pool and system user (LIB-01).
2. THE Apache SHALL serve only the `wp-admin`, `wp-login.php` and `wp-json` paths for WordPress (LIB-02).
3. WHEN a request targets a WordPress frontend path, THE Apache SHALL redirect it to `/` (LIB-02).
4. IF a request to `wp-admin` or `wp-login.php` comes from a source IP outside the allowed internal source IPs, THEN THE Nexus_Studio SHALL deny the request and serve no WordPress content (LIB-03).
5. THE Nexus_Studio SHALL require the Two Factor plugin for every account, disable XML-RPC and disable file editing (LIB-03).
6. THE `nexus-content` plugin SHALL define exactly the post types `runbook`, `faq`, `announcement`, `story_chapter`, `tour_step`, `business_unit`, `mail_help` and `service_note`, each REST-enabled and each exposing the fields `audience`, `business_unit`, `related_service` and `source_url`.
7. IF content that makes a company claim is saved for publication without a `source_url`, THEN THE Nexus_Studio SHALL refuse to publish it, show an error indicating `source_url` is required, and keep the existing content unchanged.
8. THE Nexus_Web SHALL read WordPress only through a `server-only` client that authenticates with an Application Password and caches responses using fetch tags and ISR (LIB-04).
9. WHEN content is published, updated or deleted, THE Nexus_Studio SHALL send an HMAC-signed POST to `/api/revalidate` (LIB-05).
10. WHEN THE Nexus_Web receives a correctly signed, non-replayed revalidation request, THE Nexus_Web SHALL revalidate the matching tags within 5 seconds (LIB-05).
11. IF a revalidation request has an invalid signature or repeats a request already accepted, THEN THE Nexus_Web SHALL reject it with an error response and leave all cached tags unchanged.
12. WHEN an editor requests a draft preview, THE Nexus_Web SHALL show the draft only if the request carries a signed token issued within the last 10 minutes, and SHALL otherwise deny the request without exposing draft content (LIB-06).
13. THE Nexus_Library SHALL show only public items to Visitors, and SHALL show public and internal items to Viewer and above, in both pages and APIs (LIB-07).
14. THE Nexus_Web SHALL serve WordPress media through `next/image` with `images.remotePatterns` restricted to the WordPress uploads path, and SHALL refuse to load images from any other remote path (LIB-08).
15. THE Nexus_Web SHALL sanitize WordPress rich text against an explicit allowlist of elements, attributes and URL schemes, removing everything not on the allowlist, and SHALL render no raw untrusted HTML.
16. THE Nexus_Studio SHALL contain initial published content of at least one platform overview, one runbook and one FAQ (LIB-09).
17. WHILE Demo_Mode is active, THE Nexus_Library SHALL render fixture content without calling WordPress and SHALL hide editing links.

### Requirement 8: Nexus Command

**User Story:** As a Viewer, I want live telemetry from Nexus Core 01 with an interactive particle field, so that I can see platform health at a glance.

#### Acceptance Criteria

1. THE Prometheus SHALL listen only on 127.0.0.1:9090, retain data for 15 days, and scrape node_exporter on 127.0.0.1:9100 with the systemd collector enabled (CMD-01).
2. THE Nexus_Web SHALL query Prometheus only through fixed PromQL held in an allowlist covering CPU, load, memory, swap, disk usage, disk IO, network, uptime and systemd unit states (CMD-02).
3. WHEN a caller requests metrics, THE Nexus_Web SHALL accept only allowlisted query IDs and SHALL NOT accept PromQL text (CMD-02).
4. IF a requested query ID is not in the allowlist, THEN THE Nexus_Web SHALL reject the request with an error indicating an unknown query, SHALL NOT send any query to Prometheus, and SHALL record an Audit_Event with result "rejected".
5. THE Nexus_Web SHALL run exactly one in-process poller that polls Prometheus at a fixed 5-second interval and, after a failed poll, retries with backoff doubling from 5 seconds up to a 60-second maximum (CMD-03).
6. WHEN the poller obtains new data, THE Nexus_Web SHALL fan it out to all connected browsers over SSE at `/api/stream/metrics` (CMD-03).
7. THE SSE route SHALL require the Viewer role or above through Role_Guard.
8. IF a request to the SSE route has no valid session or a role below Viewer, THEN THE Nexus_Web SHALL reject it and SHALL NOT open a stream.
9. IF a session already holds 3 open SSE connections, THEN THE Nexus_Web SHALL reject a further connection from that session with an error indicating the connection limit.
10. THE Nexus_Command SHALL provide the pages `/command`, `/command/core-01`, `/command/metrics` and `/command/services`.
11. THE `/command/metrics` page SHALL offer time ranges of exactly 1 h, 6 h, 24 h and 7 d.
12. THE Nexus_Command SHALL show a Live_Demo_Label on every displayed metric value (CMD-04).
13. THE particle field SHALL render exactly one cluster per tracked service (CMD-05).
14. THE particle field SHALL render each cluster's colour and motion according to that service's health state, and SHALL move particles within 100 px of the pointer in response to it (CMD-05).
15. WHERE the client device cannot sustain 30 frames per second, THE particle field SHALL step down to a lower quality tier with fewer particles (CMD-05).
16. WHILE the user's system setting prefers reduced motion, THE particle field SHALL render a single static frame with no animation and no pointer response (CMD-05).
17. WHILE the browser tab is hidden, THE particle field SHALL pause animation and SHALL resume when the tab becomes visible (CMD-05).
18. WHEN no update has arrived for 3 consecutive polling intervals (15 seconds), THE Nexus_Command SHALL mark the affected data as stale with a visible stale indicator and SHALL NOT display it as healthy (CMD-06).
19. WHEN the SSE connection drops, THE client SHALL reconnect automatically, retrying with backoff from 1 second up to 30 seconds, without a page reload.
20. THE range charts SHALL each provide a legend, a tooltip on hover and keyboard focus, colours that meet a 3:1 contrast ratio against the background, and a data table alternative holding the same values (CMD-07).
21. THE Nexus_Web SHALL NOT show any hostname, IP address or internal path to a Visitor.
22. WHILE Demo_Mode is active, THE Nexus_Command SHALL drive the same UI and SSE message shape from deterministic fixtures, with a Live_Demo_Label reading Demo on every value and with no calls to Prometheus.

### Requirement 9: Operations agent and Nexus Status

**User Story:** As an Operator, I want safe, audited service actions and a health history, so that I can run the platform without shell access from the browser.

#### Acceptance Criteria

1. THE Nexus_Ops_Agent SHALL run as the unprivileged `nexus-ops` user and listen on a Unix socket in `/run/nexus-ops/` owned by group `nexus-ops-clients`, whose only member is the `nexus-web` service user (OPS-01).
2. THE Nexus_Ops_Agent SHALL execute only requests that carry a valid HMAC signature, a timestamp within ±30 s of the agent's clock and a nonce not previously accepted within the last 60 s (OPS-02).
3. IF a request has an invalid signature, a timestamp outside ±30 s or a nonce already accepted within the last 60 s, THEN THE Nexus_Ops_Agent SHALL execute no operation and SHALL return an error response indicating an authentication failure (OPS-02).
4. THE Nexus_Ops_Agent SHALL accept exactly three operations: `restart(unit)`, `logs(unit, lines)` with `lines` an integer from 1 to 500, and `health(check)` (OPS-03).
5. THE Nexus_Ops_Agent SHALL accept only the units `nexus-web`, `nexus-worker`, `sftpgo` and `prometheus`, matched by exact, case-sensitive name against an allowlist defined in code and configuration (OPS-04).
6. IF a request names an unknown operation, a unit outside the allowlist, a unit name containing `../`, `@`, glob characters or any suffix, or `lines` outside 1 to 500, THEN THE Nexus_Ops_Agent SHALL execute no operation and SHALL return an error response indicating an invalid request (OPS-03, OPS-04).
7. THE polkit rule SHALL allow only user `nexus-ops` to perform verb `restart` on the allowlisted units (OPS-05).
8. IF a restart of a unit outside the allowlist is attempted, THEN polkit SHALL deny it (OPS-05).
9. WHEN the Nexus_Ops_Agent returns log output, THE Nexus_Ops_Agent SHALL first replace secrets, tokens, email addresses and configured IP ranges with a mask placeholder, so that none of these values appears in the response (OPS-06).
10. WHEN the Nexus_Ops_Agent accepts a `restart` request, THE Nexus_Ops_Agent SHALL return an acknowledgment within 2 s without waiting for the restart to complete, including when the unit is `nexus-web` (OPS-07).
11. WHEN an Operator opens the log viewer, runs a health check, or confirms a restart in its confirmation dialog, THE Nexus_Web SHALL write one Audit_Event for the request and one for its result, success or failure (OPS-08).
12. THE Nexus_Platform SHALL provide no browser shell, arbitrary command execution, root access or firewall changes through Nexus.
13. THE Nexus_Worker SHALL run each predefined service check every 60 s and store each result in `service_checks` (STA-01).
14. THE Nexus_Worker SHALL compute uptime over the last 24 h, 7 d and 30 d from the stored `service_checks` results (STA-02).
15. THE Nexus_Status SHALL show a Visitor only service names and their states, and no history, incident or check detail (STA-03).
16. THE Nexus_Status SHALL show a Viewer, Member, Operator or Administrator the full check history, incidents and incident updates (STA-04).
17. WHEN an Operator or Administrator opens, updates or resolves an incident, THE Nexus_Web SHALL write an Audit_Event recording the incident and the action taken (STA-05).
18. THE Nexus_Status SHALL show each WordPress `announcement` item as a maintenance notice (STA-06).
19. WHILE Demo_Mode is active, THE Nexus_Status SHALL show fixture history and incidents labelled with a Live_Demo_Label, and operation controls SHALL be disabled with a "Demo session" explanation.

### Requirement 10: Nexus Atlas

**User Story:** As a Viewer, I want an interactive dependency map, so that I can see how services relate and jump to their metrics, runbooks and incidents.

#### Acceptance Criteria

1. THE Nexus_Atlas SHALL build every node from a `services` record and every edge from a `service_dependencies` record, with no hard-coded node or edge markup (ATL-01).
2. WHEN the Nexus_Atlas renders a node, THE Nexus_Atlas SHALL colour the node by its latest health state (healthy, degraded or down) (ATL-02).
3. IF a node has no health result from the last 5 minutes or has no health result at all, THEN THE Nexus_Atlas SHALL render the node with a style distinct from every health colour and a text label of "Stale" or "Unknown" respectively (ATL-02).
4. WHEN a user selects a node, THE Nexus_Atlas SHALL show, within 500 ms, a panel containing the node's health, its metrics from the last 24 hours, its upstream and downstream dependencies, a Nexus_Library runbook link, its 5 most recent incidents, the actions the user's role permits through the Nexus_Ops_Agent, and its audit history (ATL-03).
5. IF the user's role is below the minimum role for an action, THEN THE Nexus_Atlas SHALL hide or disable that action, and Role_Guard SHALL reject a direct request for it.
6. WHEN the user selects "Explain with Nexus AI", THE Nexus_Atlas SHALL send Nexus_AI a summary built and sanitized on the server, and SHALL NOT include raw log lines in it (ATL-04).
7. IF the "Explain with Nexus AI" request fails or times out after 30 seconds, THEN THE Nexus_Atlas SHALL show an error indication and keep the node panel open.
8. THE Nexus_Atlas SHALL allow every node, every panel control and the view switch to be reached and operated with the keyboard alone (ATL-05).
9. THE Nexus_Atlas SHALL provide a list view that shows every node with its health and dependencies and opens the same node panel on selection (ATL-05).
10. WHEN the Nexus_Atlas page loads, THE Nexus_Atlas SHALL display the list view before the graph library has loaded, and SHALL load the graph library afterwards (ATL-06).
11. IF the graph library fails to load, THEN THE Nexus_Atlas SHALL keep the list view usable and show an error indication.
12. WHILE Demo_Mode is active, THE Nexus_Atlas SHALL use fixture inventory and health, disable all actions, and show a "Demo session" explanation.

### Requirement 11: Nexus Data

**User Story:** As an Operator, I want searchable demonstration records with audited editing, so that the MariaDB deployment is visible and safe to modify.

#### Acceptance Criteria

1. WHEN a Viewer or a user of a higher role opens `/data`, THE Nexus_Data SHALL display paginated tables over `data_assets`, `data_sites` and `data_tickets` with a text search and column filters, showing 25 rows per page (DAT-01).
2. IF a Visitor requests `/data`, THEN THE Nexus_Data SHALL deny access through the Role_Guard and display no record data (DAT-01).
3. WHEN an Operator submits a create, update or delete of a record, THE Nexus_Data SHALL validate the input with Zod through a Server Function before any database write (DAT-02).
4. WHEN a create, update or delete succeeds, THE Nexus_Data SHALL write one Audit_Event recording actor, role, action, target, result, source IP and timestamp (DAT-02).
5. IF a user below the Operator role submits a create, update or delete, THEN THE Nexus_Data SHALL reject it through the Role_Guard, leave the database unchanged and write an Audit_Event with a denied result (DAT-02).
6. IF submitted input fails Zod validation, including input containing SQL fragments, markup or values over the field's maximum length, THEN THE Nexus_Data SHALL reject it before it reaches the database, leave the stored record unchanged, show an error indicating which fields are invalid, and write an Audit_Event with a rejected result.
7. WHEN a user exports CSV, THE Nexus_Data SHALL export all rows of the current filtered view, not only the current page (DAT-03).
8. WHEN THE Nexus_Data writes a CSV cell whose first character is `=`, `+`, `-` or `@`, THE Nexus_Data SHALL neutralize the cell so that spreadsheet software does not evaluate it as a formula (DAT-03).
9. THE Nexus_Data SHALL provide a read-only schema view listing the tables, columns and relationships of `data_assets`, `data_sites` and `data_tickets`, with no edit controls (DAT-04).
10. THE Nexus_Data SHALL display on `/data` an explanation of how the supervisor's request to install a MySQL database and input data is met by the MariaDB deployment and its demonstration records (DAT-05).
11. WHILE Demo_Mode is active, THE Nexus_Data SHALL read from in-memory fixtures, make no database calls, and carry a Live_Demo_Label.
12. WHILE Demo_Mode is active, THE Nexus_Data SHALL disable create, update and delete controls and display a "Demo session" explanation of why writes are disabled.

### Requirement 12: Nexus Transfer

**User Story:** As a Member, I want SFTP and a browser file portal with my own isolated account, so that I can exchange files securely.

#### Acceptance Criteria

1. THE Nexus_Transfer SHALL run SFTPGo, installed from the official YUM repository, as the unprivileged `sftpgo` user with the MariaDB data provider database `nexus_sftpgo` (TRF-01).
2. THE Nexus_Transfer SHALL serve SFTP on port 2022 while SSH remains on port 22 (TRF-02).
3. THE Nexus_Transfer SHALL keep FTP and WebDAV disabled, with no listener for either protocol (TRF-02).
4. THE Nexus_Transfer SHALL accept password authentication and public-key authentication for each user, with up to 10 registered public keys per user (TRF-03).
5. THE Nexus_Transfer SHALL confine each user's home to a directory under `/srv/nexus-transfer` and SHALL deny the `chmod` and `chown` permissions to every user (TRF-04).
6. IF a user attempts a path-traversal to a location outside the user's home over SFTP or WebClient, THEN THE Nexus_Transfer SHALL refuse the operation, return a permission-denied error to the client and leave all files outside the home unchanged.
7. THE Nexus_Transfer SHALL enforce a configured storage quota for each user (TRF-05).
8. IF an upload would make a user's stored data exceed that user's quota, THEN THE Nexus_Transfer SHALL reject the upload with an error indicating the quota is exceeded and keep the data already stored (TRF-05).
9. THE Nexus_Transfer SHALL enable the defender and per-protocol rate limits (TRF-05).
10. IF a client IP address produces 5 failed authentications within 10 minutes, THEN THE defender SHALL block that address for 30 minutes (TRF-05).
11. THE Apache SHALL publish the SFTPGo WebClient, bound to 127.0.0.1:8090, at `/files/` (TRF-06).
12. THE SFTPGo WebAdmin and REST API SHALL bind only to 127.0.0.1:8091 and THE Apache SHALL NOT proxy them (TRF-07).
13. WHEN an Administrator needs the WebAdmin or REST API, THE Administrator SHALL reach 127.0.0.1:8091 through an SSH tunnel (TRF-07).
14. THE Nexus_Web SHALL call SFTPGo only from server-side code, using an API key read from the environment file, and SHALL NOT send that key to any browser (TRF-08).
15. WHEN a signed-in Member opens `/transfer`, THE Nexus_Web SHALL show connection guides for WinSCP, FileZilla, Cyberduck and `sftp -P 2022`, the Member's quota, the Member's registered keys, and a link to `/files/` (TRF-09).
16. WHEN an Administrator creates, disables or deletes an account, sets a quota, adds or removes a key, or resets a password in Nexus_Control, THE Nexus_Web SHALL write one Audit_Event for that action (TRF-10).
17. THE Nexus_Web SHALL show a Member only that Member's own account data.
18. IF a request carries an account identifier that does not belong to the signed-in session, THEN THE Nexus_Web SHALL refuse the request and return no data of the other account.
19. THE Nexus_Platform SHALL NOT grant SFTP accounts automatically to existing Linux users.
20. THE Prometheus SHALL scrape SFTPGo metrics every 60 seconds (TRF-11).
21. THE Nexus_Transfer SHALL NOT include SFTPGo UI code or theme in the Nexus codebase (TRF-12).
22. WHILE Demo_Mode is active, THE Nexus_Transfer SHALL show a fixture account, quota and keys with a Live_Demo_Label and with all management controls disabled.

### Requirement 13: Nexus Mail

**User Story:** As a Member, I want secure internal webmail with a Gmail-inspired interface, so that I can send and receive mail between Nexus mailboxes.

#### Acceptance Criteria

1. THE Nexus_Mail SHALL deliver mail for virtual domain `ytl-nexus.internal` using virtual users stored in `nexus_mail`, and SHALL NOT use OS accounts for any mailbox (MAIL-01).
2. WHERE `doveadm pw -l` lists ARGON2ID, THE Nexus_Mail SHALL hash mailbox passwords with ARGON2ID (MAIL-02).
3. IF `doveadm pw -l` does not list ARGON2ID, THEN THE Nexus_Mail SHALL hash mailbox passwords with SHA512-CRYPT (MAIL-02).
4. THE Nexus_Mail SHALL deliver mail through Dovecot LMTP and serve IMAPS on port 993 (MAIL-03).
5. THE Nexus_Mail SHALL serve submission on port 587 and SHALL require STARTTLS and SASL authentication through Dovecot before accepting a message (MAIL-03).
6. THE Postfix `mynetworks` SHALL contain only Loopback addresses (MAIL-04).
7. THE Nexus_Platform SHALL NOT expose port 25 through the firewall, so a connection attempt to port 25 from a non-Loopback host fails to connect (MAIL-04).
8. IF a message is addressed to a recipient outside `ytl-nexus.internal`, THEN THE Postfix SHALL permanently reject it, return a message stating that external recipients are not accepted, and queue no copy of it.
9. WHEN an open-relay test from an external host submits a message for an external recipient, THE Postfix SHALL refuse to relay it and SHALL queue no copy of it.
10. THE Nexus_Mail SHALL present certificates issued by the internal CA on ports 587 and 993, and a client that trusts the internal CA SHALL complete the TLS handshake on each port with no verification error (MAIL-05).
11. THE Nexus_Mail SHALL run Roundcube, a current stable release whose tarball integrity was verified before install, at `/webmail/`, with its own PHP-FPM pool and database `nexus_roundcube` (MAIL-06).
12. WHEN Roundcube setup completes, THE Nexus_Mail SHALL have removed the Roundcube installer, so that a request for the installer path returns not-found, and SHALL set session cookies as Secure, HttpOnly and SameSite (MAIL-06).
13. IF 5 failed Roundcube logins occur from one source IP within 15 minutes, THEN THE Nexus_Mail SHALL reject further login attempts from that IP for 15 minutes (MAIL-06).
14. THE Roundcube skin `roundcube/skins/nexus` SHALL extend Elastic with Nexus tokens and provide a folder rail with a Compose button, a search bar, a message list, a user-toggleable reading pane, a compose drawer, keyboard shortcuts, dark mode, and a visible focus indicator with at least 3:1 contrast on every interactive element, and SHALL contain no Gmail branding or copied Gmail styling (MAIL-07).
15. WHILE the viewport is narrower than 768 px, THE Roundcube skin SHALL show the folder list, message list and message view as three sequential screens, one at a time (MAIL-07).
16. THE Nexus_Mail SHALL support read, reply, reply-all, forward, drafts, archive, trash, attachments, search, filters, and flagged and unread states (MAIL-08).
17. WHEN a user with role Member or above opens `/mail`, THE `/mail` page SHALL show service status, client settings, `mail_help` content and a link to `/webmail/` (MAIL-09).
18. IF a Visitor or a Viewer requests `/mail`, THEN THE Role_Guard SHALL deny access and THE `/mail` page SHALL NOT render any mail content (MAIL-09).
19. WHEN an Administrator creates, disables or resets a mailbox, or sets a quota, in Nexus_Control, THE Nexus_Web SHALL perform it through a server-only database user limited to the virtual-user tables and SHALL write an Audit_Event (MAIL-10).
20. IF a mailbox operation in Nexus_Control fails, THEN THE Nexus_Web SHALL leave the mailbox unchanged, show the Administrator an error indicating the failure, and write an Audit_Event with a failure result (MAIL-10).
21. WHILE Demo_Mode is active, THE `/mail` page SHALL show fixture status with a Live_Demo_Label, and THE Nexus_Tour SHALL show webmail screenshots instead of the live webmail.

### Requirement 14: Nexus AI

**User Story:** As a Member, I want a local assistant that answers from approved documentation with citations, so that I get grounded help without data leaving the server.

#### Acceptance Criteria

1. THE Ollama service SHALL accept connections on 127.0.0.1:11434 only and SHALL run version 0.6 or newer (AI-01).
2. THE project SHALL benchmark `gemma3:4b-it-qat`, `gemma3:1b-it-qat` and `tinyllama` on Nexus_Core_01 and SHALL record tokens per second, time to first token in milliseconds and peak RAM in MB for each model in `docs/operations/ai.md` (AI-02).
3. THE Nexus_Worker SHALL chunk and embed WordPress content and `docs/operations` runbooks into `ai_chunks`, storing audience and source metadata for every chunk (AI-03).
4. WHEN a chat request is received, THE Nexus_AI SHALL remove every chunk whose audience is above the caller's role before ranking, so that no such chunk appears in the prompt, context or response (AI-04).
5. THE `/ai` page SHALL stream responses over SSE at `/api/ai/chat` and SHALL provide a stop button during streaming, a conversation list, a delete control for each conversation, cited sources that each link to a Nexus_Library page, and an error message that keeps earlier messages visible when a request or stream fails (AI-05).
6. WHEN the user activates the stop button, THE Nexus_AI SHALL abort generation within 2 seconds and release its concurrent-generation slot (AI-05).
7. WHEN a user requests "Explain" from Nexus_Atlas or a Nexus_Status incident, THE Nexus_AI SHALL build the summary on the server only from allowlisted metrics or sanitized logs and SHALL pass nothing else from the request to the model (AI-06).
8. THE Nexus_AI SHALL enforce a maximum prompt size of 4,000 characters, a maximum response of 1,024 tokens, a rate limit of 20 requests per user per minute and a global cap of 2 concurrent generations (AI-07).
9. THE Nexus_AI `yes-public` scope SHALL use public Yes content only and SHALL limit each source IP address to 10 requests per minute (AI-08).
10. THE Nexus_AI SHALL give the model no tools, shell access, autonomous actions or service controls.
11. THE Nexus_AI SHALL pass retrieved text to the model as data, and every system prompt SHALL state that instructions inside retrieved content are ignored.
12. THE Nexus_AI SHALL exclude passwords, private keys, tokens and unsanitized logs from prompts and context.
13. THE `/ai` page SHALL describe Nexus_AI as a local assistant built for this project and SHALL NOT describe it as a YTL AI Labs product (AI-09).
14. WHILE Demo_Mode is active, THE Nexus_AI SHALL return scripted streamed answers, with canned answers for the `yes-public` scope, and fixture citations labelled Demo (AI-08).
15. THE Nexus_AI SHALL read the selected model name from configuration, so that changing the model requires no code change (AI-02).
16. WHEN the revalidation webhook is received, THE Nexus_Worker SHALL re-index the changed content into `ai_chunks` within 60 seconds (AI-03).
17. IF a request exceeds the prompt size, rate limit or concurrent-generation cap, THEN THE Nexus_AI SHALL start no generation and SHALL return an error indicating which limit was exceeded (AI-07).

### Requirement 15: Yes Experience

**User Story:** As a visitor, I want a polished and honest Yes website redesign inside Nexus, so that I can browse plans, coverage and support on any device.

#### Acceptance Criteria

1. THE Yes_Experience SHALL provide the routes `/yes`, `/yes/plans`, `/yes/coverage` and `/yes/support` inside the Nexus shell, each rendering a page without an error (YES-01).
2. THE Yes_Experience SHALL show a link back to Nexus on every `/yes/*` page, and WHEN the link is selected, THE Yes_Experience SHALL navigate to the Nexus home page (YES-01).
3. THE Yes_Experience SHALL keep the cherry-blossom art direction and use only the official Yes logomarks and the exact Yes colour values from the supplied Yes brand assets on every `/yes/*` page (YES-02).
4. WHILE the user's operating-system reduced-motion preference is enabled, THE Yes_Experience SHALL render the petals without motion (YES-02).
5. WHEN the viewport width is 390 px, THE Yes_Experience SHALL provide a navigation control that opens and closes the menu on tap and reaches all four `/yes/*` pages (YES-03).
6. WHEN a user selects "Get Started" or "Select Plan", THE Yes_Experience SHALL open either an official yes.my page or a flow visibly labelled "Concept design" (YES-04).
7. IF a user submits the coverage or support form with an empty or invalid required field, THEN THE Yes_Experience SHALL reject the submission, show an error beside each affected field, keep the entered values, and show no confirmation (YES-05).
8. WHEN a user submits the coverage or support form with valid input, THE Yes_Experience SHALL show a confirmation that states whether the data was sent or only recorded as a concept, and SHALL NOT state that a submission succeeded when nothing was transmitted (YES-05).
9. WHEN a user sends a chatbot message and the reply is displayed, THE Yes_Experience chatbot SHALL keep the user message and the reply in the conversation in chronological order (YES-06).
10. THE Yes_Experience chatbot SHALL fit a 390 px wide viewport without horizontal scrolling and SHALL send every request with the `yes-public` Nexus_AI scope (YES-06).
11. THE Yes_Experience footer and social links SHALL point only to yes.my pages or official Yes social-media accounts (YES-07).
12. THE Yes_Experience SHALL present each price, coverage claim and promotion either with official yes.my wording and a visible source note, or with the label "Concept design – not live pricing" (YES-08).
13. WHEN the four `/yes/*` pages are tested at viewport widths of 390 px and 3840 px, THE axe scan SHALL report zero serious or critical violations.

### Requirement 16: Nexus Continuity and Nexus Shield

**User Story:** As an Operator, I want verified backups and a read-only security posture view, so that I can trust recovery and see risks without automatic changes.

#### Acceptance Criteria

1. WHEN `nexus-backup.timer` fires once per day, THE backup job SHALL run as root and create five separate dumps, one each for `ytl_nexus`, `nexus_mail`, `nexus_roundcube`, `nexus_sftpgo` and `nexus_wordpress` (CON-01).
2. WHEN `nexus-backup.timer` fires, THE backup job SHALL archive `/etc/ytl-nexus`, service configuration, WordPress uploads, Roundcube configuration, the SFTPGo data snapshot and mail storage (CON-01).
3. WHEN a backup run produces an archive, THE backup job SHALL compress it and write one SHA-256 checksum for it in `/var/backups/nexus` (CON-02).
4. WHEN a backup run completes, THE backup job SHALL keep the 7 most recent daily and 4 most recent weekly backups and delete older ones (CON-02).
5. WHEN a backup run completes, whether it succeeded or failed, THE backup job SHALL write one `backup_runs` row containing the status, per-component size and completion time through the INSERT-only `nexus_ingest` user (CON-03).
6. WHEN `nexus-restore-test.timer` fires once per week, THE restore test SHALL restore the latest dumps into scratch databases, compare row counts and checksums with the recorded source values, and write one `restore_tests` row with a pass or fail result per component (CON-04).
7. WHEN a restore test ends, whether it passed or failed, THE restore test SHALL drop all scratch databases it created (CON-04).
8. IF an archive fails its SHA-256 check or cannot be extracted, THEN THE restore test SHALL record a failed `restore_tests` row naming the archive and SHALL NOT mark that component as verified (CON-04).
9. WHEN an Operator or Administrator opens `/continuity`, THE Nexus_Platform SHALL show for each component the last backup age, size, status, last verified restore and restore steps (CON-05).
10. WHEN a Viewer opens `/continuity`, THE Nexus_Platform SHALL show only a summary health status per component and SHALL NOT show sizes or restore steps (CON-05).
11. IF the last successful backup is older than 26 hours, THEN THE Nexus_Platform SHALL raise a finding in Nexus_Status and Nexus_Shield (CON-06).
12. THE project SHALL document the off-box copy procedure in `docs/operations/backup-restore.md` (CON-07).
13. THE Nexus_Web SHALL NOT run, start or schedule backups.
14. WHEN `nexus-shield-scan.timer` fires once per day, THE scanner SHALL run as root and check TLS expiry, listening ports against the allowlist, firewalld, pending security updates, failed SSH and SFTP logins over the last 24 hours, SSH settings, SELinux, disk usage, time sync, backup freshness and fail2ban (SHD-01 to SHD-11).
15. WHEN a scan completes, THE scanner SHALL write the results as a JSON report (SHD-20).
16. WHEN a new scan report is available, THE Nexus_Worker SHALL ingest it into `shield_findings`, with each finding having a severity of info, low, medium or high, sanitized evidence containing no passwords, keys or tokens, and remediation guidance (SHD-21).
17. WHEN an Operator or Administrator opens `/shield`, THE Nexus_Shield SHALL display the findings read-only (SHD-22).
18. IF a Visitor, Viewer or Member requests `/shield`, THEN THE Role_Guard SHALL deny access and return no finding data (SHD-22).
19. THE Nexus_Shield SHALL perform no automatic remediation and SHALL expose no web path that triggers the scanner (SHD-22).
20. IF root SSH login is enabled, password SSH login is enabled or SELinux is disabled, THEN THE Nexus_Shield SHALL report a finding with remediation guidance for each condition and SHALL NOT change the setting (SHD-23).

### Requirement 17: Nexus Tour, Project Story and Nexus Control completion

**User Story:** As the project owner, I want a guided showcase and a complete administration area, so that the platform can be presented and operated by the team.

#### Acceptance Criteria

1. WHEN a user opens `/tour`, THE Nexus_Tour SHALL step through every module using Demo_Mode fixtures only and make no calls to live services (TOUR-01).
2. THE Nexus_Tour SHALL take the content of each step from WordPress `tour_step` content (TOUR-01).
3. WHEN the Nexus_Tour moves from one step to another, THE Nexus_Tour SHALL play a signal-ribbon transition (TOUR-02).
4. WHILE the reduced-motion preference is on, THE Nexus_Tour SHALL replace signal-ribbon transitions with fades (TOUR-02).
5. WHERE presenter mode is on, THE Nexus_Tour SHALL show large type and hide navigation chrome (TOUR-03).
6. WHERE presenter mode is on, WHEN the user presses the right arrow, left arrow, space or Escape key, THE Nexus_Tour SHALL go to the next step, go to the previous step, go to the next step, or exit presenter mode, respectively (TOUR-03).
7. WHEN a user opens `/story`, THE Project_Story SHALL show one chapter each for the starting point (old drafts described, not reused), architecture decisions, challenges, security lessons, skills gained and team thanks, from `story_chapter` content (STORY-01, STORY-02).
8. THE Project_Story SHALL state that YTL Nexus is an internship project and not an official YTL commercial product (STORY-03).
9. THE Nexus_Control SHALL be unlinked from public navigation and SHALL mark every `/control/*` page `noindex` (CTL-01).
10. IF a request to `/control/*` comes from a user who is not an Administrator with a Step_Up completed within the last 10 minutes, THEN THE Role_Guard SHALL deny the request, show no Control content and write an Audit_Event with result denied (CTL-01).
11. WHEN an Administrator uses Nexus_Control, THE Nexus_Control SHALL allow creating users, changing roles, disabling users, revoking sessions, resetting passwords and forcing 2FA re-enrolment (CTL-02).
12. WHEN an Administrator manages SFTP accounts, THE Nexus_Control SHALL perform the change through the SFTPGo API (CTL-03).
13. WHEN an Administrator manages mailboxes, THE Nexus_Control SHALL perform the change through the restricted mail database user (CTL-04).
14. THE Nexus_Control SHALL expose only the Nexus_Ops_Agent allowlist actions `restart`, `logs` and `health` (CTL-05).
15. THE Nexus_Control SHALL provide a configuration view that lists non-secret settings only (CTL-06).
16. WHEN an Administrator opens the audit viewer, THE Nexus_Control SHALL allow filtering Audit_Events by actor, action, target, result and date range (CTL-07).
17. WHEN an Administrator exports Audit_Events as CSV, THE Nexus_Control SHALL prefix with a single quote any cell that begins with `=`, `+`, `-` or `@` (CTL-07).
18. WHEN an Administrator starts a Control mutation, THE Nexus_Control SHALL show a confirmation that names the exact target and SHALL apply the mutation only after the Administrator confirms (CTL-08).
19. WHEN a Control mutation completes or fails, THE Nexus_Control SHALL write an Audit_Event recording actor, action, target and result (CTL-09).
20. THE Nexus_Control SHALL display no secret value and SHALL permit rotating a secret without revealing the old or new value.
21. THE Nexus_Web SHALL provide contextual links between Nexus_Atlas, Nexus_Status, Nexus_Library, Nexus_AI, Nexus_Continuity, Nexus_Shield and Nexus_Control.
22. WHEN a user presses Cmd+K or Ctrl+K, THE Nexus_Web SHALL open a command palette that navigates to pages only and runs no actions.
23. WHEN an Administrator has created a Member, an SFTP account and a mailbox, THE Member SHALL be able to sign in to Nexus_Web and use both the SFTP account and the mailbox.
24. THE test suite SHALL include an end-to-end run covering every module for each of Visitor, Viewer, Member, Operator and Administrator, asserting access is allowed or denied per the role matrix.
25. THE test suite SHALL include an audit completeness test that performs every mutation and asserts each produces exactly one Audit_Event.

### Requirement 18: Quality, security hardening and handover

**User Story:** As the IT Infrastructure team, I want a verified, documented and hardened release, so that we can run the platform without the original author.

#### Acceptance Criteria

1. IF any Nexus_Web route measured by Lighthouse on a mid-range laptop profile (4x CPU slowdown, 10 Mbps network) exceeds 170 KB gzip first-load JavaScript, LCP of 2.5 s, CLS of 0.1 or more, or INP of 200 ms, THEN THE CI pipeline SHALL fail the build.
2. WHEN a release is prepared, THE project SHALL save a Lighthouse report for every route in `docs/design/`.
3. WHEN CI runs, THE project SHALL capture Nexus_Web visual regression snapshots at widths 390, 768, 1440, 2560 and 3840 px, and SHALL fail the build IF more than 0.1% of pixels differ from the approved baseline.
4. THE Nexus_Web SHALL send a Content-Security-Policy header on every HTML response.
5. IF a client exceeds 60 requests per minute to a public Nexus_Web handler, THEN THE Nexus_Web SHALL reject further requests from that client until the window resets, with a rate-limit error that indicates when to retry.
6. WHILE Nexus_Core_01 is running, THE fail2ban jails for sshd, SFTPGo and Postfix SHALL be active, and the owner's IP SHALL be on each jail's ignore list.
7. WHEN a release is prepared, THE project SHALL run gitleaks over the full git history and SHALL block the release IF any finding is unresolved.
8. WHEN a release is prepared, THE project SHALL run `npm audit` and a dependency review, and SHALL block the release IF any high or critical vulnerability is unresolved.
9. WHEN a release is prepared, THE project SHALL run `systemd-analyze security` on every Nexus unit and SHALL record any unit scoring above 5.0 together with a written justification.
10. WHEN a release is prepared, THE project SHALL run an external port scan of Nexus_Core_01 and SHALL block the release IF the set of open ports differs from the firewall allowlist.
11. THE security review SHALL verify that every Nexus_Web handler calls Role_Guard, that no `NEXT_PUBLIC_` variable holds a secret, and that no secret appears in logs.
12. THE security review SHALL verify that every mutation writes an Audit_Event.
13. THE security review SHALL verify that MariaDB, Ollama, Prometheus, node_exporter and the SFTPGo admin binding listen on Loopback only.
14. THE security end-to-end suite SHALL cover auth bypass attempts, CSRF and origin checks on Server Functions, and IDOR checks on Nexus_Transfer and Nexus_Mail administration, and SHALL fail IF any attempt succeeds.
15. WHEN a release is prepared, THE project SHALL update `docs/security/threat-model.md` with residual risks including SELinux disabled, root SSH, internal CA, single server and a CPU without AVX.
16. THE handover documentation SHALL include owners and roles, an account inventory without secrets, a credential rotation checklist, a DNS request template, a CA install guide, a roadmap and a demo rehearsal script.
17. THE credential rotation checklist SHALL cover the Better Auth secret, database users, SFTPGo API key, WordPress Application Password, ops HMAC secret, webhook secret and CA.
18. WHEN a teammate follows only the handover documentation, THE teammate SHALL complete a deploy, a rollback and a restore on a test run without help from the original author.
19. WHEN the release is ready, THE project SHALL grant the team GitHub access and SHALL create a git bundle of `yes-website-redesign`.
20. IF the owner has not confirmed in writing, THEN THE project SHALL NOT delete the `yes-website-redesign` directory.
21. WHEN all release checks pass, THE project SHALL tag `v1.0.0` and deploy it.
22. IF a secret may have leaked, THEN THE team SHALL revoke or rotate it first, then remove it from the repository and logs, and then scan the full git history with gitleaks.
