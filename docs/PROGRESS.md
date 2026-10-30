# YTL Nexus progress log

> **Purpose:** the running record of what is done, what was decided, what is open, and what comes next. Every session starts here.
> **Audience:** the next agent session and the project owner.

## Current status

| Item                        | Value                                                                                               |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Last completed              | **Task 1:** workspace, repository, specs and tooling baseline (2026-10-30)                          |
| Next task                   | **Task 2:** brand asset pipeline and design tokens                                                  |
| Recommended model           | Claude Sonnet 5.5, effort Medium. Switch to Claude Haiku 5.5 for writing `assets/asset-manifest.md` |
| Start the next session with | `Continue YTL Nexus: run Task 2`                                                                    |

## Owner actions waiting

1. Ask Logesh whether exact Oracle MySQL is required or MariaDB (MySQL-compatible) is fine. The answer decides whether Task 5 adds the optional MySQL 8 container.
2. Before Task 2: request the official YTL and Yes media kit and any photos you want to use from Logesh or YTL Corporate Communications.
3. Optional: after Task 2 confirms nothing else is needed, empty `~/.Trash/ytl-nexus-cleanup-2026-10-30` (see the deletion log).

## Task log

### Task 1: workspace, repository, specs and tooling baseline (done 2026-10-30)

- Cleaned the workspace (deletion log below). Official YTL Communications and Yes logo masters plus the logo guideline moved to `assets/source/` with original filenames; checksums in `assets/source/SHA256SUMS` (39 files). Brand extras and inspiration moved to git-ignored `reference/`.
- Scaffolded Next.js 16.3.5 with `create-next-app@16.3.5` (React 19.2.8, TypeScript strict plus `noUncheckedIndexedAccess`, Tailwind v4, ESLint flat config) and moved it into the root.
- Tooling: Prettier with the Tailwind plugin, Vitest with Testing Library and jsdom, Playwright with `@axe-core/playwright`, Husky with lint-staged and a gitleaks pre-commit hook.
- Branded placeholder home page with skip link; unit tests (3) and end-to-end smoke tests (3, including axe WCAG 2.2 AA) pass.
- GitHub Actions workflow `.github/workflows/ci.yml`: gitleaks over full history; format, lint, typecheck, unit tests, build; end-to-end smoke tests.
- Documentation: `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `.kiro/steering/ytl-nexus.md`, the five canonical guides in `docs/`, detailed module specs and implementation plan in `docs/spec/`, and ADRs in `docs/architecture/decisions/`.
- Documentation refined after the workspace rename: canonical entry points are now `docs/product.md`, `docs/tech.md`, `docs/structure.md`, `docs/design-language.md` and `docs/security.md`; detailed module contracts remain under `docs/spec/` and decisions under `docs/architecture/decisions/`.
- One Kiro hook added: `.kiro/hooks/confirm-destructive-commands.json` asks for confirmation before destructive shell commands (activates on the next session start). SessionStart and save hooks were rejected because steering, Husky and CI already cover them.

## Decisions

| ID    | Date       | Decision                                                                                                   | Why                                                                                                                                                                                                |
| ----- | ---------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-001 | 2026-10-30 | Node.js 24 LTS on the server and in CI ([ADR 0002](architecture/decisions/0002-node-24-lts.md))            | Server offers `nodejs:24`; Node 22 ends April 2027                                                                                                                                                 |
| D-002 | 2026-10-30 | `AGENTS.md` is the single rule set; `.kiro/steering/ytl-nexus.md` only adds Kiro credit rules              | Both load every turn; duplication costs credits and drifts                                                                                                                                         |
| D-003 | 2026-10-30 | Local deletions go to `~/.Trash/ytl-nexus-cleanup-2026-10-30` instead of permanent removal                 | Reversible until the owner empties the Trash                                                                                                                                                       |
| D-004 | 2026-10-30 | `assets/source/` (4.4 MB of logo masters) is tracked in Git                                                | The team needs the originals after handover; approved for public use                                                                                                                               |
| D-005 | 2026-10-30 | Husky sets the repository-local `core.hooksPath` through `npm run prepare`                                 | Standard way to share hooks with the team                                                                                                                                                          |
| D-006 | 2026-10-30 | The `unrs-resolver` install script stays unapproved under npm's `allowScripts`                             | It only downloads a binding when the optional native package is missing; the native package installs normally                                                                                      |
| D-007 | 2026-10-30 | Specs are split into overview, design, module specs and the implementation plan (how and when)             | Each fact has one home; later sessions read only what their task needs                                                                                                                             |
| D-008 | 2026-10-30 | Fonts move to `next/font/local` or a font npm package in Task 2                                            | The server build should not depend on downloading Google Fonts                                                                                                                                     |
| D-009 | 2026-10-30 | Task 4 prefers the AppStream `php:8.3` stream over Remi                                                    | Remi `remi-8.1` is currently enabled; AppStream is the distribution-supported path. Record the final choice in Task 4                                                                              |
| D-010 | 2026-10-30 | Five canonical reader guides: `product.md`, `tech.md`, `structure.md`, `design-language.md`, `security.md` | Stable entry points reduce search and keep detailed module contracts in `docs/spec/`                                                                                                               |
| D-011 | 2026-10-30 | One Kiro hook: `confirm-destructive-commands` (PreToolUse on `execute_bash`)                               | Plain shell check, zero credits; prompts before `rm -rf`, disk, firewall, hostname, database-drop and force-push commands. Steering, Husky and CI already cover everything else, so no other hooks |

## Open issues

| ID    | Issue                                                                                                                                                                                                                              | Resolve in |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| O-001 | Local integration database for Task 5. Docker CLI is installed but Docker Desktop is not running; Homebrew `mysql` 26.10 is installed and conflicts with Homebrew `mariadb`. Prefer a `mariadb:10.5` container to match the server | Task 5     |
| O-002 | Does the server have outbound internet access for `npm ci`, `dnf` and Ollama model downloads? (`dnf module list` worked)                                                                                                           | Task 4     |
| O-003 | `lscpu` flags (AVX, AVX2) for the AI benchmark                                                                                                                                                                                     | Task 4     |
| O-004 | Is the server joined to a directory (`realm list`)? Decides whether the hostname may change                                                                                                                                        | Task 4     |
| O-005 | Exact Oracle MySQL requirement (owner action 2)                                                                                                                                                                                    | Task 5     |
| O-006 | `pdftocairo` (Homebrew `poppler`) or Inkscape is needed for PDF-to-SVG conversion; ask before installing                                                                                                                           | Task 2     |

## Environment facts

**Owner's Mac (2026-10-30):** macOS 27.0.1 on arm64; Node.js 26.13.0; npm 11.20.0; git 2.56.0; Homebrew 7.0.11; GitHub CLI 2.103.3 signed in as `sm-muammer` with `repo` and `workflow` scopes; gitleaks 8.30.1 (installed in Task 1); Docker CLI present, daemon not running; Homebrew `mysql` 26.10; no Podman, MariaDB, poppler or Inkscape.

**Server:** see [technology, host facts](tech.md#6-host-facts-read-only-audit-2026-10-30). Module streams checked in Task 1: `nodejs` 18, 20, 22, 24; `php` 8.1–8.3 (AppStream) and Remi 7.4–8.6 with `remi-8.1` enabled.

**CI pins:** `actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, gitleaks 8.30.1 (checksum-verified download).

## Deletion log

Everything below was moved to `~/.Trash/ytl-nexus-cleanup-2026-10-30/` on 2026-10-30, keeping its relative path. `.DS_Store` files were deleted outright.

| Path                                                                                                            | Size   | Reason                                                                                                                                |
| --------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `inspiration/` (after moving Markdown captures, 1 SVG, 5 font files and 1 font CSS to `reference/inspiration/`) | 152 MB | Shopify CDN mirror (PNG, WebP, JPG, minified JS) and flattened minified Spring '26 bundles; not reusable and not needed for reference |
| `sftp/`                                                                                                         | 12 KB  | Empty folder                                                                                                                          |
| `assets/log_console_art.js`                                                                                     | 12 KB  | Unused leftover script                                                                                                                |
| `assets/YTL Branding/` (after moving all contents)                                                              | 140 KB | Only empty folders and `.DS_Store` files remained                                                                                     |
| `yes-website-redesign/node_modules/`                                                                            | 889 MB | Regenerable with `npm ci`                                                                                                             |
| `yes-website-redesign/.next/`                                                                                   | 217 MB | Regenerable build output                                                                                                              |
| `yes-website-redesign/tsconfig.tsbuildinfo`                                                                     | 108 KB | Regenerable TypeScript cache                                                                                                          |
| `yes-website-redesign/pnpm-lock.yaml`, `pnpm-workspace.yaml`                                                    | 144 KB | Stray pnpm files; the project uses npm                                                                                                |

Moved, not deleted:

| From                                                                                                                  | To                                                                                                                                                                                  |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| YTL Communications logo PDFs and PNGs, logo guideline                                                                 | `assets/source/ytl-communications/{main-colour,black-wordmark,reverse-white-wordmark,black-monochrome,reverse-white-monochrome}/{pdf,png}/` and `assets/source/ytl-communications/` |
| Yes logomark PDFs and PNGs                                                                                            | `assets/source/yes/{gradient,pink,black,white}/{pdf,png}/`                                                                                                                          |
| YTL Group, Construction, Corporation and e-Solutions logos; Zoom backgrounds; wallpapers; PPT template; email banners | `reference/brand-extras/` (git-ignored)                                                                                                                                             |
| Shopify Editions and Couchdrop Markdown captures, Shopify SVG and font references                                     | `reference/inspiration/` (git-ignored)                                                                                                                                              |
