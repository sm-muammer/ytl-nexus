# YTL Nexus

One platform for infrastructure, intelligence and digital services, built during an IT Infrastructure internship at YTL Communications.

YTL Nexus brings a live server dashboard, a local AI assistant, secure SFTP, webmail, a MariaDB demonstration, headless WordPress content and the Yes website redesign together under one design and one sign-in. It runs on the team's Rocky Linux server (Nexus Core 01) as a controlled internal pilot, and the same code runs offline in demo mode for portfolio presentations.

> YTL Nexus is an internship project, not an official YTL commercial product.

## Status

Task 1 of 22 is complete: repository, tooling, specifications and agent rules. Progress and the next task are in [`docs/PROGRESS.md`](docs/PROGRESS.md).

## Modules

| Module                       | What it does                                                        |
| ---------------------------- | ------------------------------------------------------------------- |
| Nexus Command                | Live dashboard for Nexus Core 01 with an interactive particle field |
| Nexus Atlas                  | Service dependency map                                              |
| Nexus Status                 | Health history, incidents and maintenance notices                   |
| Nexus AI                     | Local assistant grounded in team documentation                      |
| Nexus Transfer               | SFTP with password and key login, plus a browser file portal        |
| Nexus Mail                   | Secure internal webmail                                             |
| Nexus Data                   | MariaDB demonstration records                                       |
| Nexus Library and Studio     | Runbooks and FAQs, edited in headless WordPress                     |
| Nexus Continuity             | Backups and verified restores                                       |
| Nexus Shield                 | Read-only security posture                                          |
| Nexus Tour and Project Story | Guided presentation and the internship case study                   |
| Nexus Control                | Hidden administration                                               |
| Yes Experience               | The Yes website redesign                                            |

Full requirements: [`docs/spec/00-overview.md`](docs/spec/00-overview.md).

## Quick start

Requirements: Node.js 24 or newer, npm, and [gitleaks](https://github.com/gitleaks/gitleaks) for the pre-commit hook.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open <http://localhost:3000>.

| Command            | Purpose                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `npm run check`    | Format check, lint, typecheck and unit tests                        |
| `npm run test:e2e` | End-to-end tests (run `npx playwright install chromium` once first) |
| `npm run build`    | Production build                                                    |

## Documentation

- [Documentation map and standard](docs/README.md)
- [Architecture overview](docs/architecture/overview.md)
- [Implementation plan](docs/spec/implementation-plan.md)
- [Contributing](CONTRIBUTING.md)

## Ownership

Built by Muammer. After the internship, the YTL Communications IT Infrastructure team owns YTL Nexus, with Logesh, Azlin and Sonu as primary owners.
