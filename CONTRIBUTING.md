# Contributing to YTL Nexus

> **Purpose:** how to set up a development machine, make a change, and get it merged safely.
> **Audience:** developers on the IT Infrastructure team and coding agents.

## Set up

1. Install Node.js 24 or newer and npm.
2. Install gitleaks. macOS: `brew install gitleaks`. Linux: download a release from <https://github.com/gitleaks/gitleaks/releases> and verify its checksum.
3. Clone the repository and install dependencies. `npm ci` also installs the Git hooks.

   ```bash
   git clone https://github.com/sm-muammer/ytl-nexus.git
   cd ytl-nexus
   npm ci
   cp .env.example .env.local
   ```

4. For end-to-end tests, install the browser once: `npx playwright install chromium`.

## Make a change

1. Read [`docs/PROGRESS.md`](docs/PROGRESS.md) and the spec for the area you are changing.
2. Write a failing test first, then the code that makes it pass.
3. Keep commits small and use [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:`, `ci:`.
4. Update the documentation in the same commit as the behaviour (standard: [`docs/README.md`](docs/README.md)).

## Quality gates

| Where           | Checks                                                                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Pre-commit hook | gitleaks on staged changes; ESLint and Prettier on staged files; typecheck; unit tests                                                    |
| GitHub Actions  | gitleaks over full history; format check; lint; typecheck; unit tests; production build; end-to-end smoke tests with accessibility checks |

Run everything locally with `npm run check`, then `npm run build` and `npm run test:e2e`.

## Definition of done

- The task's tests and demo criteria hold.
- `npm run check`, the build and the end-to-end tests pass.
- Every new page, Route Handler and Server Function authorizes on the server and validates input.
- Every modifying action writes an audit event.
- No secret appears in code, logs, fixtures or `NEXT_PUBLIC_` variables.
- `docs/PROGRESS.md` and the affected documents are updated.

## Secrets

Never commit `.env*` files (except `.env.example`), keys, certificates, database dumps or backups. They are listed in `.gitignore`. If gitleaks flags a real secret, remove it from the change and rotate the secret. Do not add an allowlist entry for a real secret.
