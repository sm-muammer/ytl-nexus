# YTL Nexus documentation

> **Purpose:** map every project document, where new documents belong, and the standard they must meet.
> **Audience:** anyone looking for or writing YTL Nexus documentation.

## Start here

| Document                                                     | Read it when                                                                         |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| [`PROGRESS.md`](PROGRESS.md)                                 | You start a session and need the current task, decisions or open issues              |
| [`product.md`](product.md)                                   | You need the product, modules, roles, routes, scope or success criteria              |
| [`tech.md`](tech.md)                                         | You need the stack, runtime components, integrations, trust boundaries or host facts |
| [`structure.md`](structure.md)                               | You need to place a file, route, module, service or document                         |
| [`design-language.md`](design-language.md)                   | You are designing or reviewing an interface                                          |
| [`security.md`](security.md)                                 | You are changing auth, data, APIs, services, networking or administration            |
| [`spec/implementation-plan.md`](spec/implementation-plan.md) | You are running or reviewing a task                                                  |

## Map

| Location                  | Contents                                                                                                                     | Status                                                                                                                                                                                               |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `product.md`              | Product, users, modules, roles, routes, scope and success criteria                                                           | Canonical                                                                                                                                                                                            |
| `tech.md`                 | Stack, components, integrations, trust boundaries and host facts                                                             | Canonical                                                                                                                                                                                            |
| `structure.md`            | Current and target repository structure, route ownership and placement rules                                                 | Canonical                                                                                                                                                                                            |
| `design-language.md`      | Adaptive Nexus visual, brand, motion, accessibility and responsive rules                                                     | Canonical                                                                                                                                                                                            |
| `security.md`             | Security model, controls, risks and verification gates                                                                       | Canonical                                                                                                                                                                                            |
| `spec/`                   | Detailed module contracts and implementation plan                                                                            | Written in Task 1; updated with behaviour                                                                                                                                                            |
| `architecture/decisions/` | [Architecture decision records](architecture/decisions/README.md)                                                            | Add an ADR when a significant decision changes                                                                                                                                                       |
| `design/`                 | Tokens, motion implementation, asset guide, asset sourcing and Lighthouse reports                                            | Tasks 2, 3 and 20                                                                                                                                                                                    |
| `operations/`             | Deploy, rollback, server baseline, configuration and service runbooks                                                        | `configuration.md` (Task 3); `deploy.md`, `rollback.md`, `server-baseline.md` (Task 4); `database.md` (Task 5); `wordpress.md` (Task 7); `monitoring.md` (Task 8); later runbooks as services arrive |
| `security/`               | [`auth.md`](security/auth.md) (Task 6); operations-agent (Task 9) and threat-model (Task 21) documents                       | Tasks 6, 9 and 21                                                                                                                                                                                    |
| `handover/`               | `ca-install.md` and `dns-request.md` (Task 4); owners, accounts, credential rotation, risks, roadmap and rehearsal (Task 22) | Tasks 4 and 22                                                                                                                                                                                       |

The five canonical guides are stable entry points. Detailed module contracts remain under `docs/spec/`; decisions remain under `docs/architecture/decisions/`.

## Documentation standard

Every document:

1. Opens with a **Purpose** line and an **Audience** line.
2. Uses real commands, paths and values that were run or verified.
3. Contains no placeholders, TBDs or "coming soon" sections. Write a document when its subject exists.
4. Links to related documents instead of repeating them. Each fact has one home.
5. Keeps secrets out: name the file or variable that holds a secret, never its value.
6. Uses plain language: short sentences, active voice, one term per concept, module names exactly as in [`product.md`](product.md).
7. Changes in the same commit as the behaviour it describes.
