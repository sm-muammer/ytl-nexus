# YTL Nexus

One platform for infrastructure, intelligence, and digital services, engineered by **Muammer** during an IT Infrastructure internship at YTL Communications.

YTL Nexus brings a live host telemetry dashboard, a local AI assistant grounded in team runbooks, secure SFTP with single sign-on, internal webmail, MariaDB demonstration records, headless WordPress content management, and the Yes 5G website redesign together under one unified design system and a single sign-in.

It runs on the team's Rocky Linux server (**Nexus Core 01**) as a controlled internal pilot, and runs completely offline in **Demo mode** with deterministic fixtures and zero server calls for portfolio presentations.

> **Positioning:** YTL Nexus is an internship capstone project and technical demonstration built by Muammer, not an official YTL commercial product. Official brand assets are used under authorization for project presentation.

---

## Highlights

- **Nexus Command (`/command`):** Real-time Rocky Linux host telemetry, CPU/memory/disk gauges, service orchestration with systemd, and an interactive 3D WebGL particle mark.
- **Nexus AI (`/ai`):** Private on-box AI assistant powered by local Ollama LLMs with streaming responses and citations grounded in team Markdown runbooks.
- **Nexus Status & Operations (`/status`):** Public health status, historical 30-day uptime, incident timeline, and end-to-end incident tracking (`INC-YYYY-NNNN`).
- **Nexus Atlas (`/command/atlas`):** Interactive topological dependency graph illustrating upstream/downstream relationships across the 16 platform modules.
- **Nexus Transfer (`/transfer`):** Chrooted SFTP file transfer powered by SFTPGo with public-key & password authentication plus browser-based WebClient SSO.
- **Nexus Mail (`/mail`):** Secure internal webmail client backed by Dovecot/Postfix and customized Roundcube webmail with dark mode support.
- **Nexus Data (`/data`):** Demonstration MariaDB dataset with parameterized filtering, audit logging, and CSV exports.
- **Nexus Library & Studio (`/library`, `/studio`):** Architecture documentation and operational FAQs edited via headless WordPress REST endpoints.
- **Nexus Continuity (`/continuity`):** Automated multi-tier backup registry, point-in-time restore drills, and disaster recovery runbooks.
- **Nexus Shield (`/shield`):** Read-only security posture analysis, compliance baselines, and configuration drift detection.
- **Nexus Tour & Story (`/tour`, `/story`):** 16-step guided interactive presentation with Presenter Mode and the internship engineering case study.
- **Nexus Control (`/control`, `/control/users`):** Hidden administrative portal with role-based access control (RBAC), multi-factor authentication (MFA), step-up auth, session revocation, and user provisioning.
- **Yes Experience (`/yes`):** Responsive Yes 5G public portal redesign with coverage checker, plan comparison, and Yes 5G Assistant.

Full requirements & specifications: [`docs/product.md`](docs/product.md) · [`docs/spec/implementation-plan.md`](docs/spec/implementation-plan.md).

---

## Architecture & Technology

```
                          Internet / Corporate LAN (10.0.0.0/8)
                                        │
                         [ Apache 2.4 Reverse Proxy Gateway ]
                         Ports 80/443 (HTTPS) · 2022 (SFTP) · 587/993 (Mail)
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
  Next.js 16.3.5 App           Headless WordPress             SFTPGo / Webmail
  Node.js 24 Standalone        (PHP 8.2-FPM / MariaDB)       (Go + Roundcube)
  127.0.0.1:3000               127.0.0.1:8080                127.0.0.1:8082/8081
           │                            │                            │
           └────────────────────────────┼────────────────────────────┘
                                        │
                         [ MariaDB 10.11 InnoDB Storage ]
                         5 Isolated Databases · Least Privilege
                                        │
                         [ Host Automation & Telemetry ]
                         nexus-ops (Unix Socket) · Prometheus (:9100) · Ollama (:11434)
```

- **Frontend & App Server:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, Three.js WebGL particles.
- **Authentication & Authorization:** Better Auth with scrypt password hashing, TOTP 2FA, session cookies, and strict server-side role gating (`admin`, `operator`, `member`, `viewer`, `visitor`).
- **Host & Services:** Rocky Linux 9, Apache HTTPD (TLS 1.3, Strict CSP, HSTS), MariaDB, SFTPGo, Dovecot, Postfix, Roundcube, Ollama, Prometheus.
- **Ops Daemon:** Dedicated `nexus-ops` root-isolated Python service communicating over a chmod 0660 Unix socket with HMAC-SHA256 request signing and polkit-bounded system actions.

---

## Quick Start

YTL Nexus runs out of the box in **Demo mode** without needing access to the physical Rocky Linux server or databases.

### Prerequisites

- **Node.js:** `^24.0.0` (matching `.node-version`)
- **npm:** `^10.0.0`
- **Optional:** [gitleaks](https://github.com/gitleaks/gitleaks) for pre-commit security verification

### Installation & Local Run

```bash
# 1. Clone repository
git clone https://github.com/sm-muammer/ytl-nexus.git
cd ytl-nexus

# 2. Install dependencies
npm ci

# 3. Configure local environment (defaults to demo mode)
cp .env.example .env.local

# 4. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

Explore as a guest or sign in using sample credentials to view higher-tier modules (e.g. `admin@ytl-nexus.internal`).

---

## Available Scripts

| Command                | Purpose                                                                             |
| :--------------------- | :---------------------------------------------------------------------------------- |
| `npm run dev`          | Start Next.js development server with hot reload                                    |
| `npm run build`        | Compile optimized Next.js standalone production build                               |
| `npm run start`        | Start compiled production build locally                                             |
| `npm run check`        | Run complete test & quality gate: formatting, linting, typechecking, and unit tests |
| `npm run test`         | Run fast unit & integration tests with Vitest                                       |
| `npm run test:e2e`     | Run Playwright end-to-end browser tests (`npx playwright install chromium` first)   |
| `npm run format`       | Format code with Prettier                                                           |
| `npm run format:check` | Verify code formatting with Prettier                                                |
| `npm run lint`         | Run ESLint static analysis                                                          |
| `npm run typecheck`    | Validate TypeScript types and Next.js route types                                   |

---

## Documentation

Comprehensive architecture, design, and operations documentation is maintained in the [`docs/`](docs/) directory:

- [Progress Log (`docs/PROGRESS.md`)](docs/PROGRESS.md) — Running changelog, completed tasks, and deployment history.
- [Product Overview (`docs/product.md`)](docs/product.md) — Core problem statement, audience, modules, and access matrix.
- [Technical Architecture (`docs/tech.md`)](docs/tech.md) — Topology, host services, trust boundaries, and network diagrams.
- [System Structure (`docs/structure.md`)](docs/structure.md) — Directory layout, route structure, and convention guide.
- [Design Language (`docs/design-language.md`)](docs/design-language.md) — Visual standards, typography, motion philosophy, and palettes.
- [Security Model (`docs/security.md`)](docs/security.md) — Defense-in-depth, RBAC roles, audit logging, and secrets management.
- [Implementation Plan (`docs/spec/implementation-plan.md`)](docs/spec/implementation-plan.md) — 24 detailed technical specifications and acceptance criteria.
- [Operations & Runbooks (`docs/operations/`)](docs/operations/) — Host management, deployment scripts, database migrations, and disaster recovery.

---

## Project Status

All **24 technical specifications** across the platform are fully designed, implemented, tested, and deployed to Nexus Core 01.

| Milestone                         | Status    | Details                                                                       |
| :-------------------------------- | :-------- | :---------------------------------------------------------------------------- |
| **Foundation & Core 01 Baseline** | Completed | Systemd units, Apache gateway, MariaDB schemas, Better Auth.                  |
| **Workspace Services**            | Completed | Command telemetry, Atlas graph, Status tracker, Library, Transfer, Mail.      |
| **Intelligence & Governance**     | Completed | Nexus AI (Ollama RAG), Continuity (backups), Shield (security posture).       |
| **Presentation & Portfolio**      | Completed | 3D WebGL particle Yes logo, Interactive Tour (Presenter Mode), Story dossier. |
| **Administration**                | Completed | Nexus Control, User Management (`/control/users`), self-service requests.     |

---

## Author & Acknowledgments

- **Lead Engineer:** **Muammer** (BSc IT Cloud Engineering, Asia Pacific University)
- **Host Organization:** YTL Communications (IT Infrastructure Team)
- **Supervisors & Mentors:** Logesh, Azlin, Sonu
