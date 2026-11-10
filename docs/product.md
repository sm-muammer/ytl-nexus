# YTL Nexus product overview

> **Purpose:** the single source of truth for what YTL Nexus is, who uses it, which modules exist, who may access what, and what is out of scope.
> **Audience:** everyone working on or reviewing YTL Nexus. Read this before any module spec.

## 1. Problem statement

Muammer (BSc IT Cloud Engineering, APU Malaysia) is an intern in the YTL Communications IT Infrastructure team. Earlier draft sites on the team's Rocky Linux test server were separate, buggy and unmaintained. YTL Nexus replaces them with one unified platform that provides:

- a live infrastructure dashboard for the server;
- a local AI assistant grounded in the team's own documentation;
- secure SFTP with a browser file portal;
- a MariaDB demonstration dataset (the supervisor asked to "install a MySQL database and input some data");
- headless WordPress content management;
- webmail;
- the Yes website redesign;
- supporting operations modules (dependency map, status, backups, security posture, guided tour).

YTL Nexus runs as a **controlled internal pilot** that the IT Infrastructure team owns after Muammer leaves. The same codebase also serves as a **portfolio showcase**.

## 2. Identity and delivery

| Item                  | Decision                                                                                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product name          | **YTL Nexus**                                                                                                                                                              |
| Repository and folder | `ytl-nexus` (GitHub `sm-muammer/ytl-nexus`, private first)                                                                                                                 |
| Target hostname       | `ytl-nexus.ytlcomms.my` (DNS record requested from YTL IT)                                                                                                                 |
| Temporary hostname    | `ytl-nexus.internal` through hosts-file entries                                                                                                                            |
| Legacy hostname       | `sn1lyvx1d0002.ytlcomms.my`, kept as an alias and rollback path                                                                                                            |
| Server identity       | **Nexus Core 01** (`nexus-core-01`), the Rocky server at 10.26.64.164                                                                                                      |
| Versions              | One codebase and one build. `NEXUS_MODE=live` talks to real services; `NEXUS_MODE=demo` runs the full UI on fixtures with visible "Demo data" labels and zero server calls |
| Branding              | Official YTL and Yes assets are approved for internal and public use                                                                                                       |
| Positioning           | Project Story presents YTL Nexus as Muammer's internship project, not an official YTL commercial product                                                                   |
| Delivery              | Portfolio-ready experience that also supports a live demo and technical handover. About two weeks, no fixed end date                                                       |
| Owners after handover | IT Infrastructure team. Primary owners: Logesh, Azlin and Sonu. Nothing may depend on Muammer's personal accounts                                                          |

### Naming

Every module has a branded title and a plain subtitle. Standalone module names may appear as sub-brands in heroes, loaders, badges and transitions. The full "YTL Nexus" name stays in global navigation, metadata, sign-in and documentation.

| Module               | Subtitle                                              | Spec                                            | Task  |
| -------------------- | ----------------------------------------------------- | ----------------------------------------------- | ----- |
| **Nexus Command**    | Infrastructure dashboard (Core 01, metrics, services) | [11](spec/11-nexus-command.md)                  | 8     |
| **Nexus Atlas**      | Service dependency map                                | [13](spec/13-nexus-atlas.md)                    | 10    |
| **Nexus Status**     | Health history, incidents and maintenance notices     | [12](spec/12-nexus-status-and-operations.md)    | 9     |
| **Nexus AI**         | Local knowledge and operations assistant              | [18](spec/18-nexus-ai.md)                       | 14    |
| **Nexus Transfer**   | Secure SFTP and browser file portal                   | [16](spec/16-nexus-transfer.md)                 | 12    |
| **Nexus Mail**       | Secure webmail                                        | [17](spec/17-nexus-mail.md)                     | 13    |
| **Nexus Data**       | MariaDB demonstration records                         | [14](spec/14-nexus-data.md)                     | 5, 11 |
| **Nexus Library**    | Runbooks, FAQs and architecture notes                 | [15](spec/15-nexus-library-and-studio.md)       | 7     |
| **Nexus Studio**     | WordPress content management                          | [15](spec/15-nexus-library-and-studio.md)       | 7     |
| **Nexus Continuity** | Backups and restore verification                      | [20](spec/20-nexus-continuity.md)               | 16    |
| **Nexus Shield**     | Read-only security posture                            | [21](spec/21-nexus-shield.md)                   | 17    |
| **Nexus Tour**       | Guided sanitized presentation                         | [22](spec/22-nexus-tour-story-and-demo-mode.md) | 18    |
| **Project Story**    | The internship case study                             | [22](spec/22-nexus-tour-story-and-demo-mode.md) | 18    |
| **Nexus Control**    | Hidden administration                                 | [23](spec/23-nexus-control.md)                  | 6, 19 |
| **Yes Experience**   | Yes website redesign                                  | [19](spec/19-yes-experience.md)                 | 15    |

Cross-cutting documents: [Design language](design-language.md), [Identity and access](spec/10-identity-and-access.md), [Technology](tech.md), [Structure](structure.md), and [Security](security.md). Task order: [`spec/implementation-plan.md`](spec/implementation-plan.md).

## 3. Roles

| Capability                                                                                          | Visitor | Viewer | Member | Operator | Administrator |
| --------------------------------------------------------------------------------------------------- | :-----: | :----: | :----: | :------: | :-----------: |
| Public pages, Tour, Yes Experience, Project Story, public Library items, sanitized Status summary   |    ✓    |   ✓    |   ✓    |    ✓     |       ✓       |
| Command, Core 01, Atlas, metrics, services, full Status, internal Library, Data (read)              |         |   ✓    |   ✓    |    ✓     |       ✓       |
| Nexus AI, own Transfer status and files, Nexus Mail entry                                           |         |        |   ✓    |    ✓     |       ✓       |
| Data (write), bounded logs, health checks, allowlisted restarts, Shield, Continuity detail          |         |        |        |    ✓     |       ✓       |
| Control: users, roles, SFTP and mail accounts, keys, quotas, configuration, audit viewer and export |         |        |        |          |       ✓       |

- Visitor means not signed in.
- TOTP two-factor authentication is mandatory for Operator and Administrator.
- WordPress Editor accounts, mail credentials and SFTP credentials are separate from Nexus accounts.
- Root access stays SSH-only. Nothing in Nexus grants it.

Details: [Identity and access](spec/10-identity-and-access.md).

## 4. Routes

One hostname with path routing through Apache.

| Area                       | Routes                                                                                                                                                                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Next.js public             | `/`, `/platform`, `/story`, `/tour`, `/yes/*`, `/status`, `/library/*`, `/signin`                                                                                                                                               |
| Next.js internal reference | `/design` (Viewer and above)                                                                                                                                                                                                    |
| Next.js workspace          | `/command`, `/command/core-01`, `/command/atlas`, `/command/metrics`, `/command/services`, `/ai`, `/transfer`, `/mail`, `/data`, `/continuity`, `/shield`                                                                       |
| Next.js hidden             | `/control/*`                                                                                                                                                                                                                    |
| Next.js APIs               | `/api/auth/*` (Better Auth; sign-up, email flows and account administration are switched off), `/api/health/live`, `/api/health/ready`, `/api/metrics/stream` (SSE), `/api/ai/chat` (SSE), `/api/revalidate` (signed POST only) |
| Apache, not Next.js        | `/studio/` WordPress (admin and REST only; its frontend redirects to `/`), `/webmail/` Roundcube, `/files/` SFTPGo WebClient                                                                                                    |
| Other ports                | SFTP on 2022 (SSH stays on 22); mail submission 587; IMAPS 993                                                                                                                                                                  |

`/transfer` and `/mail` are Nexus entry pages (guides, status, help). The actual file portal and webmail live at `/files/` and `/webmail/`.

## 5. Greenfield and cleanup rules

- Nothing from earlier projects is reused except `yes-website-redesign/`. That rule covers code, layouts, configuration, data models and the old webmail.
- Allowed inputs: official brand files in `assets/source/` and inspiration material in `reference/` (ideas only, never copied code or media).
- Old server content is removed after a verified backup: old static pages and `api/`, the old webmail and its sudoers helper, the `ftpadmin` vhost, old WordPress and `wordpress_db`, vsftpd, the `superman` Podman container and image, old Postfix and Dovecot configuration and old mailboxes. The owner confirmed none of it is needed.
- **OS user accounts are never deleted** (logesh, azlin, sonu and others). `sssd` configuration is never changed.
- Every local deletion is recorded in [`PROGRESS.md`](PROGRESS.md).

## 6. Out of scope

YTL Nexus does not include:

- a browser terminal, root console or arbitrary command execution;
- raw internal logs on public pages;
- customer, billing, subscriber or production network data;
- a replacement for YTL's real CMDB, ticketing or monitoring;
- fabricated performance claims presented as real;
- social, chat or employee-portal features;
- separate hard-coded subsidiary sites;
- particles or parallax on forms or admin screens;
- external internet mail delivery (roadmap item).

## 7. Company facts for public copy

Public copy may only use claims from official YTL or Yes pages, with the source recorded next to the content.

- YTL Communications Sdn Bhd sits under YTL's Technology activities and operates the service brand **Yes**. YTL describes it as Malaysia's first mobile operator to launch 4G nationwide, the first to launch 5G commercially and the first in Malaysia to deploy 5G Advanced. Source: <https://www.ytl.com/keyactivities/technology/>.
- YTL AI Labs belongs to YTL Power International Berhad. Nexus AI must not imply it is a YTL AI Labs product.
- YTL Data Center Holdings is a separate YTL business. Nexus never implies access to or monitoring of other YTL companies' systems.
- The content model carries an optional `business_unit` field (Yes, YTL Broadband, YTL Data Centers and others) for a future approved YTL Ecosystem section.

## 8. Success criteria

1. Every module in section 2 is reachable, works at its specified level, and is linked to related modules.
2. The role matrix in section 3 is enforced on the server and covered by automated tests.
3. The platform runs on Nexus Core 01 over HTTPS with deploy, rollback, backup and verified restore.
4. `NEXUS_MODE=demo` runs the whole UI offline for the portfolio.
5. Logesh, Azlin and Sonu can deploy, roll back, restore and administer the platform from the documentation alone.
