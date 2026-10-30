# YTL Nexus documentation

> **Purpose:** the map of every document, where new documents belong, and the standard they must meet.
> **Audience:** anyone looking for or writing YTL Nexus documentation.

## Start here

| Document                                                     | Read it when                                                      |
| ------------------------------------------------------------ | ----------------------------------------------------------------- |
| [`PROGRESS.md`](PROGRESS.md)                                 | You start a session: current task, decisions, open issues         |
| [`spec/00-overview.md`](spec/00-overview.md)                 | You need to know what YTL Nexus is, its modules, roles and routes |
| [`spec/implementation-plan.md`](spec/implementation-plan.md) | You are running or reviewing a task                               |
| [`architecture/overview.md`](architecture/overview.md)       | You need components, trust boundaries or key design decisions     |

## Map

| Folder          | Contents                                                                                                                                               | Status                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------- |
| `spec/`         | Product overview, design spec, one spec per module, implementation plan                                                                                | Written in Task 1                           |
| `architecture/` | Architecture overview and [decision records](architecture/decisions/README.md)                                                                         | Written in Task 1; ADRs added per task      |
| `design/`       | Tokens, motion rules, asset guide, asset sourcing, Lighthouse reports                                                                                  | Tasks 2, 3 and 20                           |
| `operations/`   | Deploy, rollback, server baseline, configuration, database, WordPress, monitoring, SFTP, mail, AI, backup and restore, demo mode, per-service runbooks | Written with each service task, from Task 4 |
| `security/`     | Authentication, operations agent, threat model                                                                                                         | Tasks 6, 9 and 21                           |
| `handover/`     | Owners, accounts and roles, credential rotation, DNS request, CA install, known risks, roadmap, demo rehearsal                                         | Task 4 (CA install) and Task 22             |

## Documentation standard

Every document:

1. Opens with a **Purpose** line and an **Audience** line.
2. Uses real commands, paths and values that were run or verified.
3. Contains no placeholders, TBDs or "coming soon" sections. A document is written when its subject exists.
4. Links to the related specs and documents instead of repeating them. Each fact has one home.
5. Keeps secrets out: name the file or variable that holds a secret, never its value.
6. Uses plain language: short sentences, active voice, one term per concept, module names exactly as in the overview.
7. Is updated in the same commit as the behaviour it describes.
