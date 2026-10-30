# YTL Nexus implementation plan

> **Purpose:** the ordered task list for building YTL Nexus, with guidance, tests and demo criteria for each task.
> **Audience:** the agent or developer running a task, and the project owner tracking progress.
> **Status:** approved by the owner on 2026-10-30. Progress is tracked in [`../PROGRESS.md`](../PROGRESS.md), not in this file.

Requirements live in [`../product.md`](../product.md) and the module specs. Technology lives in [`../tech.md`](../tech.md), repository placement in [`../structure.md`](../structure.md), design rules in [`../design-language.md`](../design-language.md), and security controls in [`../security.md`](../security.md). This file covers **how and when**.

## 0. How to run a task

- Run **one task per chat session**. At session start read `AGENTS.md`, `docs/PROGRESS.md`, this task's section, and every spec it links.
- At session end: update `docs/PROGRESS.md` (completed work, decisions, open issues, next task, recommended model and effort), commit with a conventional commit message, push, then tell the owner to start a **new chat** for the next task. Long sessions resend the whole history and burn credits.
- The owner is a beginner. End every task with a short plain-language **"What you need to do"** list and a one-paragraph explanation of what was built.
- Model guidance for the owner (the agent cannot switch models itself; state the recommendation at the end of each task):
  - Default: **Claude Sonnet 5.5 (1.3x)**, effort Low–Medium. Effort **High** for Tasks 4, 6, 9, 12, 13 and 21.
  - **Claude Haiku 5.5 (0.06x, experimental preview):** documentation drafts, seed data, copy, repetitive tests, asset manifest.
  - **GPT 5.6 Sol (4.4x):** only once, for the final security review in Task 21.
  - Avoid Opus (2–2.2x), Kimi K3, and cheap experimental models for auth, mail, SFTP, polkit, firewall or deployment work.
  - If a cheap model fails a task twice, move to Sonnet 5.5 once instead of retrying.
- Ask the owner before hard-to-reverse actions (deletes, wipes, formatting disks, enabling the firewall, changing the hostname). The owner pre-authorized removing old server content, but still show one itemized list plus the verified hostname and IP, and proceed only after the backup is verified.
- Server access: `ssh root@10.26.64.164 '<command>'` using `~/.ssh/id_ed25519`. Non-interactive commands only; use systemd for long-running services. Ignore the cosmetic "post-quantum key exchange" SSH warning.
- Before writing Next.js code, read the relevant guide in `node_modules/next/dist/docs/` and heed deprecation notices.
- Use available skills when suitable: `tdd`, `design-taste-frontend`, `frontend-design`, `ui-ux-pro-max`, `impeccable`, `vercel-react-best-practices`, `web-design-guidelines`, `webapp-testing`, `diagnosing-bugs`, `code-review`, `pdf`, `doc-coauthoring`, `writing-for-agents`. Ask before installing third-party skills.
- Every task follows TDD where code is involved, ends with a working demoable increment, is committed and pushed, and updates `docs/PROGRESS.md`.

## 1. Task list

| #   | Task                                                          | Specs                                                                       | Model and effort                       |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| 1   | Workspace, repository, specs and tooling baseline             | [product](../product.md)                                                    | Sonnet 5.5, Medium                     |
| 2   | Brand asset pipeline and design tokens                        | [design](../design-language.md)                                             | Sonnet 5.5; Haiku 5.5 for the manifest |
| 3   | App shell, route groups, adapters and motion system           | [design](../design-language.md), [22](22-nexus-tour-story-and-demo-mode.md) | Sonnet 5.5, Medium                     |
| 4   | Server preparation, backup, wipe, hardening, first deployment | [technology](../tech.md)                                                    | Sonnet 5.5, **High**                   |
| 5   | Database schema, migrations and seed data                     | [14](14-nexus-data.md)                                                      | Sonnet 5.5; Haiku 5.5 for seed data    |
| 6   | Authentication, roles, audit and Control entry                | [10](10-identity-and-access.md)                                             | Sonnet 5.5, **High**                   |
| 7   | Headless WordPress, Nexus Studio and Nexus Library            | [15](15-nexus-library-and-studio.md)                                        | Sonnet 5.5, Medium                     |
| 8   | Monitoring pipeline and Nexus Command                         | [11](11-nexus-command.md)                                                   | Sonnet 5.5, Medium                     |
| 9   | Operations agent, controlled actions and Nexus Status         | [12](12-nexus-status-and-operations.md)                                     | Sonnet 5.5, **High**                   |
| 10  | Nexus Atlas                                                   | [13](13-nexus-atlas.md)                                                     | Sonnet 5.5, Medium                     |
| 11  | Nexus Data                                                    | [14](14-nexus-data.md)                                                      | Haiku 5.5; Sonnet 5.5 review           |
| 12  | Nexus Transfer (SFTPGo)                                       | [16](16-nexus-transfer.md)                                                  | Sonnet 5.5, **High**                   |
| 13  | Nexus Mail                                                    | [17](17-nexus-mail.md)                                                      | Sonnet 5.5, **High**                   |
| 14  | Nexus AI                                                      | [18](18-nexus-ai.md)                                                        | Sonnet 5.5, Medium                     |
| 15  | Yes Experience                                                | [19](19-yes-experience.md)                                                  | Sonnet 5.5, Medium                     |
| 16  | Nexus Continuity                                              | [20](20-nexus-continuity.md)                                                | Haiku 5.5; Sonnet 5.5 review           |
| 17  | Nexus Shield                                                  | [21](21-nexus-shield.md)                                                    | Sonnet 5.5, Low–Medium                 |
| 18  | Nexus Tour, Project Story and demo mode                       | [22](22-nexus-tour-story-and-demo-mode.md)                                  | Sonnet 5.5; Haiku 5.5 for copy         |
| 19  | Nexus Control completion and cross-module links               | [23](23-nexus-control.md)                                                   | Sonnet 5.5, Medium                     |
| 20  | Quality, motion and 4K pass                                   | [design](../design-language.md)                                             | Sonnet 5.5, Medium                     |
| 21  | Security hardening and final review                           | [10](10-identity-and-access.md), [technology](../tech.md)                   | Sonnet 5.5 High; GPT 5.6 Sol once      |
| 22  | Documentation, handover and v1.0.0 release                    | [product](../product.md)                                                    | Haiku 5.5 draft; Sonnet 5.5 review     |

Checkpoints: Day 7 integrated demo; Day 10 all modules integrated; Days 11–14 hardening, polish, docs and handover.

## 2. Tasks

### Task 1: Workspace, repository, specs and tooling baseline

- **Objective:** a clean `ytl-nexus` repository with the written spec, agent rules and a passing CI baseline.
- **Guidance:**
  - Check the Mac toolchain: `node -v` (Next.js needs ≥20.9; the project targets Node 24, see ADR 0002), `npm -v`, `git`, `gh auth status`, Homebrew, and whether Podman, Docker or MariaDB is available for local integration tests.
  - Clean the workspace: move inspiration Markdown captures and SVG/font references to `reference/inspiration/`; delete the Shopify CDN mirror and minified bundles; move brand extras to `reference/brand-extras/`; move logo masters and the guideline into `assets/source/` with original filenames and SHA-256 checksums; log each deletion in `docs/PROGRESS.md`.
  - `git init` at the workspace root. `.gitignore` covers `reference/`, `yes-website-redesign/`, `.next`, `node_modules`, `.env*`, key material and backups.
  - Scaffold a new Next.js 16.3.5 app (npm, TypeScript strict, Tailwind v4, ESLint flat config, Prettier). Add Vitest and Testing Library, Playwright and `@axe-core/playwright`, and a gitleaks pre-commit hook.
  - GitHub Actions: secret scan, format check, lint, typecheck, unit tests, build, end-to-end smoke tests.
  - Write `docs/product.md` and the module specs, `AGENTS.md`, `.kiro/steering/ytl-nexus.md` and `docs/PROGRESS.md`.
  - Create the private GitHub repository `sm-muammer/ytl-nexus` and push.
- **Tests:** lint, typecheck and unit tests pass locally and in CI; gitleaks is clean.
- **Demo:** `npm run dev` shows a branded placeholder; the repository is on GitHub with green CI.
- **You do:** confirm the GitHub account and ask Logesh whether exact Oracle MySQL is required or MariaDB is fine. The workspace was renamed to `ytl-nexus` after Task 1.

### Task 2: Brand asset pipeline and design tokens

- **Objective:** sharp, correctly named logos and a documented token system.
- **Guidance:**
  - Use the `pdf` skill. Convert the vector PDF masters to SVG (`pdftocairo -svg` from Homebrew `poppler`, or Inkscape; ask before installing). Crop to the approved protection boundary, keep clear space and aspect ratio, strip metadata, set a correct `viewBox`, and verify the Yes gradient survives.
  - Names: `ytl-communications-{primary|left|centered}-{main-colour|black-wordmark|reverse-white-wordmark|black-monochrome|reverse-white-monochrome}.svg`, `yes-logomark-{gradient|pink|black|white}.svg`, and PNG fallbacks `-w{width}.png` at 1x and 2x of documented display sizes, sRGB.
  - Write `assets/asset-manifest.md`: original filename and path, checksum, new filename, brand, module, purpose, placement, variant, dimensions, format, approval note, alt text, replacement steps.
  - Extract the exact Yes pink and gradient stops from the SVG.
  - Define tokens in Tailwind v4 `@theme`: colour roles, type scale, spacing, radii, shadows, motion durations and easings, z-layers. Choose open-licence fonts loaded with `next/font/local` (or a font npm package) so server builds do not need to download fonts.
  - Build a `/design` reference page with logos on light and dark, clear-space overlays, token swatches and a type specimen.
  - Write `docs/design/asset-sourcing.md`: official YTL and Yes press/media kit via YTL Corporate Communications, official Yes product imagery, your own 2x+ screenshots, self-made renders; never stock images with unclear licences.
- **Tests:** a script fails CI on banned or non-kebab-case filenames; a Playwright check verifies the rendered logo height is at least 31 CSS px and the aspect ratio is preserved.
- **Demo:** `/design` page with crisp logos at 3840 px width.
- **You do:** request the Yes/YTL media kit and any official photos you want from Logesh or Corporate Communications.

### Task 3: App shell, route groups, adapters and motion system

- **Objective:** the Adaptive Nexus layouts with every route stubbed and navigable.
- **Guidance:**
  - Use `design-taste-frontend`, `frontend-design`, `ui-ux-pro-max` and `vercel-react-best-practices`.
  - Public layout (editorial) and workspace layout (dense, dark), with a skip link.
  - Global navigation linking all modules; contextual module sub-navigation; a real mobile menu; footer with real links.
  - Role-aware menu (stub session for now). Live/Demo badge component; environment badge.
  - Motion primitives: `MotionConfig reducedMotion="user"`, fade/rise/stagger, signal-ribbon route transition (check installed docs for view transitions).
  - Quality-tier hook (DPR, device memory, frame-time sampler, visibility pause).
  - Adapter interfaces in `lib/server` with `live` and `demo` implementations chosen by `NEXUS_MODE` (fixtures in `lib/fixtures`).
  - A stub page for every route in the overview's route list with title, subtitle and a sub-brand hero.
  - `robots` and `noindex` for workspace and Control routes.
- **Tests:** Playwright navigation across all routes; keyboard focus order; axe with zero serious violations at 390, 1440 and 3840 px widths; reduced-motion snapshot; unit tests for the adapter switch and tier logic.
- **Demo:** click through every module stub with transitions; the mobile menu works.

### Task 4: Server preparation, backup, wipe, hardening and first deployment

- **Objective:** a backed-up, cleaned, hardened server serving the shell over HTTPS with deploy and rollback.
- **Guidance:**
  1. **Verify the target:** confirm `hostname`, IP 10.26.64.164 and the machine ID before anything destructive.
  2. **Backup:** `mariadb-dump --all-databases --routines --events`; tar `/var/www`, `/etc/{httpd,postfix,dovecot,vsftpd,php*,sudoers.d}`, `/usr/local/sbin/webmail-useradmin`, mail spools and Maildirs, Podman container inspect output and crontabs into `/root/nexus-preflight-backup-<date>/` with checksums; `scp` to `~/ytl-nexus-backups/` on the Mac (outside the repository); verify the checksums match.
  3. **Show the itemized removal list** to the owner once, then remove: old `/var/www/html/*` content, the `ftpadmin` vhost, the old webmail and `/etc/sudoers.d/webmail-useradmin` plus its helper, old WordPress with `wordpress_db` and `wp_user`, vsftpd (stop, disable, remove), the `superman` container and nginx image, old Postfix and Dovecot custom configuration (reset to package defaults) and old mailboxes. Leave OS users and `sssd` untouched.
  4. **Time and identity:** enable `chronyd` and verify sync. Check `realm list` and the `sssd` domain configuration. If the host is joined to a directory, do **not** rename it; add aliases only and report. Otherwise set the hostname to `ytl-nexus.ytlcomms.my`. Update `/etc/hosts` with the old name as an alias.
  5. **Runtimes:** Node.js 24 via `dnf module` (ADR 0002). PHP 8.3 with fpm, mysqlnd, intl, mbstring, xml, gd, zip, opcache and sodium. The Remi repository is already enabled on the server (`php:remi-8.1`); prefer the AppStream `php:8.3` stream and record the choice. Enable EPEL if needed.
  6. **MariaDB and storage:** bind MariaDB to 127.0.0.1. Verify `sdb` has no partitions or signatures (`lsblk -f`, `wipefs -n`), format it as xfs and mount it at `/srv/nexus-transfer` via fstab with `nosuid,nodev,noexec`.
  7. **firewalld:** add the ssh service first, then 80, 443, 2022, 587 and 993. Before enabling, schedule an automatic `systemctl stop firewalld` in 5 minutes as a safety net; verify SSH from a new connection, then cancel the safety net.
  8. **TLS and Apache:** internal CA plus a server certificate with the SANs from [`../tech.md`](../tech.md). Apache vhost for :443 with security headers, :80 redirect to HTTPS, `Options -Indexes`, proxy to 127.0.0.1:3000 with SSE settings. Disable the default welcome page.
  9. **Service and deploy:** create the `nexus` service user. Write `nexus-web.service` with sandboxing, graceful stop and `EnvironmentFile`. Write `deploy.sh` (builds on the server) and `rollback.sh` with automatic health-check rollback. Add `/api/health/live`. Set `output: 'standalone'`.
  10. **Benchmark prep:** record `lscpu` flags (AVX/AVX2) in `docs/PROGRESS.md` for Task 14. Record whether the server has outbound internet access for `npm`, `dnf` and model downloads.
  11. **Docs:** `docs/operations/deploy.md`, `rollback.md`, `server-baseline.md`, and `docs/handover/ca-install.md`.
- **Tests:** `curl` smoke tests (HTTPS 200, HTTP 301, headers present, no directory listing); port scan from the Mac matches the allowlist; rollback drill (deploy a broken build, confirm automatic rollback); SSH still works after firewalld is enabled.
- **Demo:** `https://ytl-nexus.internal` (hosts entry on the Mac) serves the shell; deploy and rollback work.
- **You do:** add the hosts entry and install the CA on your Mac (guide provided); send the DNS request template to YTL IT for `ytl-nexus.ytlcomms.my`.

### Task 5: Database schema, migrations and seed data

- **Objective:** the `ytl_nexus` database with migrations and realistic seed data.
- **Guidance:**
  - Create database `ytl_nexus` with users `nexus_app` (DML on application tables), `nexus_migrate` (DDL) and `nexus_ingest` (INSERT on scan and backup tables).
  - Kysely with `mysql2`, a typed schema, and SQL migrations with up and down.
  - Tables: `audit_events`; `services` and `service_dependencies` (Atlas inventory); `service_checks`, `incidents`, `incident_updates`; `backup_runs`, `restore_tests`; `shield_findings`; `data_assets`, `data_sites`, `data_tickets` (generic infrastructure assets, sites and maintenance tickets with no confidential data); `ai_chunks` (text, embedding BLOB, audience, source); `ai_conversations`.
  - Deterministic generic seed scripts. A test database harness for local MariaDB (choose Docker with `mariadb:10.5` or a Homebrew MariaDB; the Mac already has Homebrew `mysql`, which conflicts with Homebrew `mariadb`).
  - `docs/operations/database.md`, including the optional Oracle MySQL 8 Podman procedure (enabled only if Logesh requires exact Oracle MySQL).
  - Extend `/api/health/ready` to check the database.
- **Tests:** integration tests for migrate up/down/up, seed integrity and constraints.
- **Demo:** seeded database on the server; `/api/health/ready` reports the database as healthy.

### Task 6: Authentication, roles, audit and Control entry

- **Objective:** central login with the full role matrix enforced on the server.
- **Guidance:**
  - Better Auth with MariaDB: email/password, admin plugin with roles `viewer`, `member`, `operator`, `admin` and impersonation off, two-factor TOTP, rate limits, session expiry, `nextCookies()` last in the plugin list.
  - `requireRole()` and `requireStepUp()` guards. The Next.js Proxy checks only cookie presence for redirects.
  - `/signin` with TOTP enrolment enforced on first login for Operator and Administrator.
  - `/control` shell: non-admins get `notFound()`; admins must step up.
  - A first-admin CLI script run on the server. Admin-driven password reset (no email).
  - Audit events for every auth event and mutation.
  - `docs/security/auth.md` and an ADR.
- **Tests:** table-driven role-matrix tests for each page, Route Handler and Server Function, including direct POSTs without a session or with the wrong role; brute-force lockout; TOTP enrolment and step-up expiry; cookie flags.
- **Demo:** sign in as each role and see the correct menu; `/control` as a Member returns 404; the audit shows the attempts.
- **You do:** choose the initial accounts for Logesh, Azlin and Sonu (Administrator) and yourself.

### Task 7: Headless WordPress, Nexus Studio and Nexus Library

- **Objective:** editable content with correct audience filtering, plus Library, Story and FAQ pages.
- **Guidance:**
  - WP-CLI (phar verified) fresh install at `/studio` with database `nexus_wordpress` and its own user. Apache Alias plus a PHP-FPM pool `wordpress` running as its own user.
  - Disable XML-RPC and file editing. Install the Two Factor plugin.
  - Restrict `wp-admin` and `wp-login.php` to the allowed source IPs. A minimal headless theme redirects the WordPress frontend to `/`.
  - Build the `nexus-content` plugin (post types and fields in the spec), plus the signed revalidation webhook (HMAC, POST) and preview token.
  - Application Password for the server-to-server reader.
  - Server-only WordPress client with fetch tags and ISR. Images through restricted `images.remotePatterns`.
  - Pages: `/library` (public items for visitors, internal items for Viewer and above), Project Story chapters, FAQ.
  - Seed initial content: platform overview, first runbooks, FAQs.
  - `docs/operations/wordpress.md`.
- **Tests:** contract tests with mocked WordPress JSON; webhook signature and replay tests; audience-leak test (a visitor never receives internal items, including through the API).
- **Demo:** edit a runbook in Studio; it appears in Library within seconds.

### Task 8: Monitoring pipeline and Nexus Command

- **Objective:** real Nexus Core 01 telemetry with the interactive particle dashboard.
- **Guidance:**
  - Install Prometheus from the official release (verify the checksum) as its own user with a systemd unit, bound to 127.0.0.1:9090, 15-day retention.
  - Rebind node_exporter to 127.0.0.1 with the systemd collector enabled.
  - PromQL allowlist adapter (CPU, load, memory, swap, disk usage and IO, network, uptime, systemd unit states for tracked services).
  - In-process SSE poller with backoff.
  - Pages: `/command` overview, `/command/core-01`, `/command/metrics` (range charts), `/command/services`.
  - Particle field: one cluster per tracked service, colour and motion driven by health, pointer reactive, tiered. Every value labelled Live or Demo; demo fixtures for demo mode.
  - `docs/operations/monitoring.md`.
- **Tests:** adapter tests against fixture responses; rejection of non-allowlisted queries; SSE reconnect test; reduced motion renders the static frame; non-blocking performance trace check on the particle frame budget.
- **Demo:** live CPU, memory, disk, network and service state with reactive particles.

### Task 9: Operations agent, controlled actions and Nexus Status

- **Objective:** safe operator actions plus health history and incidents.
- **Guidance:**
  - `services/ops-agent` with its own systemd unit (`nexus-ops` user, socket in `/run/nexus-ops/`, group `nexus-ops-clients`).
  - HMAC + nonce + timestamp protocol and a strict schema.
  - Polkit JavaScript rule in `/etc/polkit-1/rules.d/` limited to verb `restart` on the allowlisted units.
  - Bounded `journalctl` reads with a sanitizer. Predefined health checks (HTTP, database, Prometheus, Ollama, SFTPGo, mail ports).
  - `services/worker` (`nexus-worker` unit): scheduled service checks every 60 s into `service_checks`, uptime computation.
  - Operator UI: log viewer, health checks, restart with a confirm dialog, all audited.
  - `/status`: sanitized public summary; full history, incidents and incident updates for Viewer and above. Operators and Administrators can open and update incidents. WordPress `announcement` items act as maintenance notices.
  - `docs/security/ops-agent.md` and runbooks.
- **Tests:** allowlist rejection (`sshd`, `mariadb`, path tricks, unit-name injection); bad signature, replayed nonce, expired timestamp; sanitizer fixtures; polkit denial verified on the server for a non-allowlisted unit.
- **Demo:** an Operator restarts `nexus-worker`; a disallowed unit is refused; the audit shows both; Status shows uptime history.

### Task 10: Nexus Atlas

- **Objective:** an interactive service dependency map connecting modules.
- **Guidance:**
  - React Flow (or equivalent) with custom nodes from `services` and `service_dependencies`. Live health colouring from the poller.
  - Node detail panel: health and recent metrics, dependencies, runbook link (Library), recent incidents (Status), allowed actions (Task 9, role-gated), audit history.
  - Keyboard navigable, with a list-view alternative.
  - "Explain with Nexus AI" is added in Task 14.
- **Tests:** graph-building unit tests and keyboard e2e; role gating on actions.
- **Demo:** select a service on the map and see its metrics, runbook, incidents and permitted actions.

### Task 11: Nexus Data

- **Objective:** a visible MariaDB demonstration with safe CRUD.
- **Guidance:**
  - Searchable, filterable, paginated tables over the `data_*` tables.
  - Operator create, update and delete via validated Server Functions with audit.
  - CSV export and a read-only schema/ER view.
  - Explain on the page how the supervisor's "install a MySQL database and input data" request is met.
- **Tests:** CRUD integration tests, hostile-input and SQL-injection fixtures, role gating.
- **Demo:** add a record and see it in the table and in the audit trail.

### Task 12: Nexus Transfer (SFTPGo)

- **Objective:** secure SFTP with password and key login, a browser portal, and management from Control.
- **Guidance:**
  - Install SFTPGo from the official YUM repository as the unprivileged `sftpgo` user. MariaDB provider `nexus_sftpgo`. SFTP on :2022. FTP and WebDAV disabled. Defender and rate limits on. Homes under `/srv/nexus-transfer`. Remove the `chmod` and `chown` permissions.
  - Two HTTP bindings: 127.0.0.1:8090 with WebClient only, served at `/files` (configure `web_root`; verify against current docs); 127.0.0.1:8091 with WebAdmin and REST API, never proxied (Administrators use an SSH tunnel).
  - Expose SFTPGo metrics to Prometheus.
  - Server-only SFTPGo API client (API key in the environment file).
  - Control screens: create, disable and delete accounts; set quotas; add and remove public keys; reset passwords; all audited.
  - `/transfer` page: connection guides for WinSCP, FileZilla, Cyberduck and terminal (`sftp -P 2022`), the account's quota and keys, and a link to `/files`.
  - `docs/operations/sftp.md` and the tunnel guide.
- **Tests:** integration with a test user over password and key auth; path-escape attempts; quota enforcement; defender lockout; Control actions audited.
- **Demo:** `sftp -P 2022` with a key, then upload through the browser portal; the quota updates in Nexus.

### Task 13: Nexus Mail

- **Objective:** fresh, secure webmail with a Gmail-inspired Nexus skin.
- **Guidance:**
  - Configure Postfix and Dovecot from defaults: virtual domain `ytl-nexus.internal`, virtual users in `nexus_mail` with ARGON2ID hashes (if `doveadm pw -l` lists it, otherwise SHA512-CRYPT), Dovecot LMTP and IMAPS on 993. Submission on 587 (STARTTLS plus SASL via Dovecot). `mynetworks` loopback only; relay restrictions reject external recipients. Certificate from the internal CA.
  - Install Roundcube current stable (verified tarball) at `/webmail` with its own PHP-FPM pool and database `nexus_roundcube`. Remove the installer after setup. Secure session settings.
  - Child skin `roundcube/skins/nexus` extending Elastic: Nexus tokens, three-pane layout, Compose button in the folder rail, dark mode, mobile flow, accessible focus states.
  - Control mail account management (create, disable, reset password, quota), audited.
  - `/mail` entry page: status, client settings, help (`mail_help` from WordPress), link to `/webmail`.
  - `docs/operations/mail.md`.
- **Tests:** send and receive between two test mailboxes; open-relay test from the Mac (must fail); external recipient rejected; TLS verification on 587 and 993; Roundcube login rate limiting.
- **Demo:** send mail between two Nexus mailboxes in the new interface.

### Task 14: Nexus AI

- **Objective:** a grounded local assistant with citations, wired into Atlas.
- **Guidance:**
  - Update Ollama if needed (≥0.6 for Gemma 3) and keep it bound to 127.0.0.1.
  - Benchmark on this CPU: `gemma3:4b-it-qat`, `gemma3:1b-it-qat`, the `tinyllama` baseline, plus an embedding model (verify the current best small option on ollama.com). Record tokens per second, time to first token and RAM in `docs/operations/ai.md`, and pick a model. If too slow, use the smaller model and write the hypervisor CPU-type request into the handover roadmap.
  - The worker indexes WordPress content (by audience) and `docs/operations` runbooks into `ai_chunks`, re-indexing on the revalidation webhook.
  - `/ai`: streaming chat (SSE), stop button, conversation list, delete, cited sources linking to Library, clear error states, limits from the spec.
  - "Explain" mode receives a sanitized metrics or log summary built on the server.
  - Add "Explain with Nexus AI" to the Atlas node panel and to Status incidents.
  - Public `yes-public` scope endpoint for Task 15.
- **Tests:** retrieval ranking; audience-leak tests per role; prompt-injection fixtures (retrieved text cannot change instructions or reveal internal content); stream abort; rate limits.
- **Demo:** ask a runbook question and get a streamed answer with citations; click Explain in Atlas.

### Task 15: Yes Experience

- **Objective:** port `yes-website-redesign` into the `(yes)` route group as a complete, polished, integrated experience.
- **Guidance:**
  - Read the old project's pages and components. Port them into `app/(yes)/yes/*` and `modules/yes` inside the Nexus shell (shared auth, accessibility, deployment, navigation back to Nexus).
  - Cherry-blossom art direction with official Yes logomarks and exact Yes colours. Petal motion respects reduced motion.
  - Fix the known defects: mobile navigation; dead "Get Started" and "Select Plan" controls (link to yes.my or into a concept flow); coverage and support forms (validated, with an honest confirmation); the chatbot stale-state bug and fixed width; footer links and social icons (official links).
  - Replace unverified prices, coverage and promotion claims with official yes.my wording plus source, or mark them clearly as "Concept design – not live pricing".
  - Connect the chatbot to the `yes-public` AI scope.
- **Tests:** e2e for home, plans, coverage and support; mobile navigation regression; chatbot regression (the user message persists after the reply); axe at 390 and 3840 px.
- **Demo:** browse Yes Experience on mobile and at 4K, chat, and jump back to Nexus.

### Task 16: Nexus Continuity

- **Objective:** verified backups visible in Nexus.
- **Guidance:**
  - Root `nexus-backup.timer`: per-database `mariadb-dump` (all five databases), `/etc/ytl-nexus` and service configuration, WordPress uploads, Roundcube configuration, SFTPGo data snapshot and mail storage. Compression and checksums. Rotation of 7 daily and 4 weekly. Writes `backup_runs` via `nexus_ingest`.
  - Weekly `nexus-restore-test.timer` restores into scratch databases, compares row counts and checksums, and records `restore_tests`.
  - `/continuity`: last backup age per component, size, status, last verified restore, restore steps.
  - `docs/operations/backup-restore.md`, including the off-box copy command.
- **Tests:** a real restore drill on the server; corrupted-archive detection; a stale-backup alert appears in Status and Shield.
- **Demo:** Continuity shows today's verified restore in green.

### Task 17: Nexus Shield

- **Objective:** a read-only security posture view.
- **Guidance:**
  - Root `nexus-shield-scan.timer` writes JSON covering TLS certificate expiry (web, mail), listening ports versus the allowlist, firewalld state, pending security updates, failed SSH and SFTP logins, SSH configuration flags (`PermitRootLogin`, `PasswordAuthentication`), SELinux state, disk usage, time sync, backup freshness and fail2ban status.
  - The worker ingests results into `shield_findings` with severity, sanitized evidence and remediation guidance.
  - `/shield` for Operator and above. No automatic remediation.
- **Tests:** fixture-driven parser tests per check; severity mapping.
- **Demo:** the findings list shows the known SELinux and root-SSH risks with guidance.

### Task 18: Nexus Tour, Project Story and demo mode

- **Objective:** the portfolio and presentation layer.
- **Guidance:**
  - `/tour`: guided steps (WordPress `tour_step`) through every module using demo fixtures only, with signal-ribbon transitions.
  - `/story`: the internship case study. Before and after of the old drafts (described, not reused), architecture decisions, challenges, security lessons, skills gained, team thanks.
  - Presenter mode: large type, hidden chrome, keyboard stepping.
  - Complete demo fixtures so `NEXUS_MODE=demo npm run build && npm start` runs everything offline with "Demo data" labels.
  - `docs/operations/demo-mode.md`.
- **Tests:** a test asserts no outbound live adapter calls in demo mode; Tour e2e; presenter keyboard e2e.
- **Demo:** run the full site in demo mode on the Mac with the network off.
- **You do:** write short notes on your challenges, what you learned and who helped you, for Project Story.

### Task 19: Nexus Control completion and cross-module links

- **Objective:** finished administration and a fully interconnected platform.
- **Guidance:**
  - Complete Control: users and roles (create, change role, disable, revoke sessions, reset password, force 2FA re-enrolment), SFTP accounts and keys, mail accounts, service actions, configuration view (non-secret), audit viewer with filters and CSV export.
  - Contextual links everywhere: Atlas, Status, Library, AI, Continuity, Shield and Control.
  - Module "related" panels and a global command palette (Cmd/Ctrl+K) for navigation only.
- **Tests:** full role-matrix e2e across all modules; audit completeness test (every mutation produces an event).
- **Demo:** create a Member, give them an SFTP account and a mailbox, then sign in as them and use both.

### Task 20: Quality, motion and 4K pass

- **Objective:** fluid, sharp, fast and accessible everywhere.
- **Guidance:**
  - Use `impeccable`, `web-design-guidelines` and `webapp-testing`.
  - Performance budgets (JS per route, LCP, CLS < 0.1, INP). Font subsetting. Image `sizes` and AVIF.
  - Particle tier tuning. Reduced-motion audit. Contrast audit in dark and light.
  - Responsive checks at 390, 768, 1440, 2560 and 3840 px. High-DPI screenshots. Visual regression snapshots.
  - Light load test on SSE and pages from the Mac.
- **Tests:** CI gates for bundle budgets and zero serious axe violations; Lighthouse report saved in `docs/design/`.
- **Demo:** smooth dashboard on the Mac and a clean accessibility report.

### Task 21: Security hardening and final review

- **Objective:** close gaps before handover.
- **Guidance:**
  - Enforce CSP. Verify rate limits on every public handler.
  - fail2ban jails verified with the Mac IP ignored.
  - gitleaks over the full history. `npm audit` and dependency review.
  - `systemd-analyze security` on Nexus units.
  - Re-check that MariaDB, Ollama, Prometheus, node_exporter and the SFTPGo admin binding are loopback-only.
  - Checklist: every handler has a guard, no `NEXT_PUBLIC_` secret, no secret in logs, every mutation audited.
  - Update `docs/security/threat-model.md`. Run the `code-review` skill.
- **Tests:** security e2e suite (auth bypass attempts, CSRF/origin checks on Server Functions, IDOR checks on SFTP and mail administration); external port scan; header check.
- **Demo:** a clean security report with residual risks listed.
- **You do:** switch to GPT 5.6 Sol for one final review session only, then back to Sonnet.

### Task 22: Documentation, handover and v1.0.0 release

- **Objective:** a system the IT Infrastructure team can run without Muammer.
- **Guidance:**
  - Finish every document in [`../README.md`](../README.md). Publish service runbooks into WordPress Library so Nexus AI can answer from them.
  - `docs/handover/`: owners (Logesh, Azlin, Sonu) and their roles; account inventory (no secrets); credential rotation checklist (Better Auth secret, database users, SFTPGo API key, WordPress Application Password, ops HMAC secret, webhook secret, CA); DNS request template; CA install guide; known risks (SELinux off, root SSH, internal CA, single server, CPU without AVX); roadmap (SELinux enforcing, real certificates, external mail with MX/SPF/DKIM, corporate SSO, hypervisor CPU type, off-site backups, multi-instance); demo rehearsal script.
  - Give the team GitHub access (add collaborators or transfer to a YTL organization).
  - Before removing the local `yes-website-redesign/`, run `git -C yes-website-redesign bundle create ~/ytl-nexus-backups/yes-website-redesign.bundle --all` and confirm with the owner. Then delete it.
  - Tag `v1.0.0` and deploy it.
- **Tests:** a fresh session (or a teammate) follows only the docs to deploy, roll back and restore successfully.
- **Demo:** a full walkthrough from Tour to Control, then a live deploy and rollback.
- **You do:** run the handover meeting with Logesh, Azlin and Sonu; have them sign in and enrol 2FA.

## 3. If time runs short

Cut in this order: Task 17 depth, then Task 16 UI extras, then Task 10 polish, then Task 18 presenter mode. Never cut Tasks 4, 6, 9, 12, 13, 21 or 22.
