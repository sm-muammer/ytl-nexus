# YTL Nexus repository and route structure

> **Purpose:** define where every kind of source file, route, service, configuration, test and document belongs.
> **Audience:** developers and agents adding or moving files. Product scope is in [`product.md`](product.md); runtime components are in [`tech.md`](tech.md).

## Current structure

Task 1 established this baseline:

```text
ytl-nexus/
├── app/                         # Next.js application: baseline page, /design reference, fonts in app/fonts/
├── assets/source/               # Approved YTL and Yes master assets plus checksums
├── assets/asset-manifest.md     # Generated record of every converted brand asset
├── components/{brand,ui}/       # Logo component, status badge
├── lib/{brand,design}/          # Brand asset catalogue, design tokens and contrast helper
├── public/brand/                # Generated SVG logos and PNG fallbacks (committed)
├── scripts/assets/              # Asset conversion and filename check
├── docs/                        # Canonical guides, module specs, ADRs and progress
├── reference/                   # Local-only inspiration and brand extras; Git ignored
├── tests/{unit,e2e}/            # Current automated tests
├── yes-website-redesign/        # Read-only source for Task 15; Git ignored
├── .github/workflows/ci.yml
├── .husky/pre-commit
├── .kiro/{steering/ytl-nexus.md,hooks/confirm-destructive-commands.json}
├── AGENTS.md
└── package.json
```

Generated directories (`.next/`, `node_modules/`, `playwright-report/`, `test-results/`) are ignored and never treated as source.

## Target structure

Directories appear only when their task creates working content. Do not scaffold empty architecture.

```text
ytl-nexus/
├── app/
│   ├── (public)/                # Public editorial pages
│   ├── (workspace)/             # Viewer-or-higher application pages
│   ├── (yes)/yes/               # Public Yes Experience
│   ├── control/                 # Hidden Administrator-only pages
│   └── api/                     # Route Handlers; every protected route authorizes itself
├── components/
│   ├── ui/                      # Product-wide primitives only
│   ├── layout/                  # Shared shells and navigation
│   └── motion/                  # Shared motion primitives and quality controls
├── modules/                     # One deep module per product module
│   ├── command/
│   ├── atlas/
│   ├── status/
│   ├── ai/
│   ├── transfer/
│   ├── mail/
│   ├── data/
│   ├── library/
│   ├── continuity/
│   ├── shield/
│   ├── tour/
│   ├── story/
│   ├── control/
│   └── yes/
├── lib/
│   ├── server/                  # Server-only data access, auth and service adapters
│   ├── client/                  # Browser-only helpers
│   └── fixtures/                # Deterministic demo-mode data
├── services/
│   ├── ops-agent/               # Allowlisted host operations
│   └── worker/                  # Checks, indexing and report ingestion
├── wordpress/
│   ├── plugins/nexus-content/
│   └── themes/nexus-headless/
├── roundcube/skins/nexus/
├── infrastructure/
│   ├── apache/
│   ├── database/
│   ├── fail2ban/
│   ├── firewalld/
│   ├── mail/
│   ├── polkit/
│   ├── prometheus/
│   ├── scripts/
│   ├── sftpgo/
│   └── systemd/
├── assets/
│   ├── source/                  # Original approved masters; never overwritten
│   └── web/                     # Named, optimized derivatives
├── public/                      # Browser-served application assets
├── docs/
├── tests/{unit,integration,e2e}/
└── reference/                   # Local-only; never deployed or committed
```

## Route ownership

| URL                                                                          | Owner                                                        | Runtime               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------- |
| `/`, `/platform`, `/story`, `/tour`, `/status`, `/library/*`, `/signin`      | Public route group                                           | Next.js               |
| `/yes/*`                                                                     | Yes route group and `modules/yes`                            | Next.js               |
| `/command/*`, `/ai`, `/transfer`, `/mail`, `/data`, `/continuity`, `/shield` | Workspace route group and matching module                    | Next.js               |
| `/control/*`                                                                 | `app/control` and `modules/control`                          | Next.js               |
| `/api/*`                                                                     | `app/api`; thin policy and transport layer over `lib/server` | Next.js               |
| `/studio/*`                                                                  | Nexus Studio                                                 | WordPress and PHP-FPM |
| `/webmail/*`                                                                 | Nexus Mail UI                                                | Roundcube and PHP-FPM |
| `/files/*`                                                                   | Nexus Transfer WebClient                                     | SFTPGo behind Apache  |

## Module boundary

Each folder under `modules/` is a deep module:

```text
modules/<name>/
├── index.ts                     # Public exports only
├── components/                 # Module-specific UI
├── server/                     # Module-specific server implementation
├── schemas/                    # Input and output schemas
└── *.test.ts                    # Unit tests close to the behaviour
```

- Other modules import from `modules/<name>`, never a private subpath.
- Shared primitives move to `components/ui` only after two real modules need the same behaviour.
- `app/` owns routing and composition. Business rules live in modules or `lib/server`, not Route Handlers.
- `lib/server` starts with `import "server-only"`. It returns minimal DTOs and holds every external credential.
- Demo and live adapters implement the same interface. Selection happens on the server from `NEXUS_MODE`.

## File naming

- Source files and folders: lowercase kebab-case.
- React components and TypeScript symbols: PascalCase for components/types, camelCase for functions and values.
- Tests: `<subject>.test.ts` or `<subject>.test.tsx`; end-to-end tests: `<journey>.spec.ts`.
- Database migrations: `<timestamp>-<imperative-description>.ts`.
- ADRs: `NNNN-<decision>.md`.
- Assets: conventions in [`design-language.md`](design-language.md) and the Task 2 asset manifest.

## Placement checks

Before adding a file, answer:

1. Which product module owns this behaviour?
2. Is it routing/composition (`app`), reusable UI (`components`), domain behaviour (`modules`), service access (`lib/server`), background work (`services`) or deployment (`infrastructure`)?
3. Does another module need the implementation, or only its public interface?
4. Which unit, integration or end-to-end test proves it works?

Related: [`product.md`](product.md) · [`tech.md`](tech.md) · [`security.md`](security.md) · [`spec/implementation-plan.md`](spec/implementation-plan.md)
