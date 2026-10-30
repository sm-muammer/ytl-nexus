<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# YTL Nexus agent rules

YTL Nexus is one Next.js 16.3.5 platform plus host services (WordPress, Roundcube, SFTPGo, Prometheus, Ollama, MariaDB) on one Rocky Linux server, Nexus Core 01. Product: `docs/product.md`. Technology: `docs/tech.md`. Structure: `docs/structure.md`. Design: `docs/design-language.md`. Security: `docs/security.md`. Tasks: `docs/spec/implementation-plan.md`.

## Session protocol

1. Read `docs/PROGRESS.md`. It names the current task, open issues and recent decisions.
2. Read the current task in `docs/spec/implementation-plan.md` and every spec it links.
3. Run one task per session, test first: write the failing test, watch it go red, then make it green.
4. Finish only when the task's Tests and Demo lines hold, `npm run check` passes, `docs/PROGRESS.md` records what was done, decided and left open plus the next task with its recommended model and effort, and the work is committed (conventional commits) and pushed.
5. Close with a "What you need to do" list and one plain paragraph explaining what was built. The owner is a beginner.

## Rules

- **Greenfield.** Reusable code comes only from `yes-website-redesign/` (read-only source for Task 15). `assets/source/` holds official brand files. `reference/` is inspiration for ideas, never copied code or media.
- **Authorization on the server.** Every protected page, layout, Route Handler and Server Function calls `requireRole()` and validates input with Zod. A hidden URL is never the protection.
- **Secrets** live in `/etc/ytl-nexus/*.env` on the server and `.env.local` locally. They stay out of Git, logs, chat output, error responses and `NEXT_PUBLIC_` variables.
- **Data access** goes through `lib/server` (`import "server-only"`), uses parameterized queries, and returns minimal DTOs.
- **Audit** every modifying action and authentication event in `audit_events`.
- **Server actions from the web** go only through the `nexus-ops` allowlist: restart of allowlisted units, bounded logs, predefined health checks.
- **Server access:** `ssh root@10.26.64.164 '<command>'`, non-interactive, long-running work as systemd units. Before any destructive step: verify hostname and IP, confirm a verified backup, show the owner an itemized list, and wait for approval. Keep OS user accounts and `sssd` configuration exactly as they are.
- **Honest data.** Label every figure Live or Demo. Public company claims come from official YTL or Yes pages with the source recorded.
- **Naming.** Modules use the names in `docs/product.md`. Files and folders are kebab-case.
- **Docs** follow the standard in `docs/README.md` and change in the same commit as the behaviour.
- **Skills:** use `tdd`, `design-taste-frontend`, `frontend-design`, `ui-ux-pro-max`, `impeccable`, `vercel-react-best-practices`, `web-design-guidelines`, `webapp-testing`, `diagnosing-bugs`, `code-review`, `pdf`, `doc-coauthoring` and `writing-for-agents` where they fit. Ask before installing new ones.

## Commands

Scripts are in `package.json`. `npm run check` runs format check, lint, typecheck and unit tests. `npm run test:e2e` needs `npx playwright install chromium` once. The pre-commit hook needs `gitleaks` (`brew install gitleaks`).
