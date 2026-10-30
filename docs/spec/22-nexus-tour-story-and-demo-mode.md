# Nexus Tour, Project Story and demo mode

> **Purpose:** requirements for the portfolio and presentation layer and for running the whole platform offline on fixtures.
> **Audience:** builders and reviewers of Tasks 3 (adapter switch) and 18. Access: public.

## Summary

Nexus Tour is a guided, sanitized walk through every module. Project Story is the internship case study. Demo mode (`NEXUS_MODE=demo`) runs the complete UI on fixtures with no server calls, so the platform can be shown anywhere.

## Demo mode requirements

| ID      | Requirement                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DEMO-01 | Every server adapter (database, auth, WordPress, Prometheus, Ollama, SFTPGo, operations agent, mail) has a `live` and a `demo` implementation selected by `NEXUS_MODE` |
| DEMO-02 | Demo fixtures live in `lib/fixtures` and are deterministic                                                                                                             |
| DEMO-03 | Every demo value carries a visible "Demo data" or **Demo** label                                                                                                       |
| DEMO-04 | `NEXUS_MODE=demo npm run build && npm start` runs the whole site with the network off                                                                                  |
| DEMO-05 | Demo mode never performs outbound calls to live adapters (enforced by a test)                                                                                          |
| DEMO-06 | A demo session switcher lets presenters view the UI as each role, clearly labelled "Demo session"                                                                      |

## Nexus Tour requirements

| ID      | Requirement                                                                                                |
| ------- | ---------------------------------------------------------------------------------------------------------- |
| TOUR-01 | `/tour` steps through every module using demo fixtures only; steps come from WordPress `tour_step` content |
| TOUR-02 | Signal-ribbon transitions between steps; reduced motion uses fades                                         |
| TOUR-03 | Presenter mode: large type, hidden chrome, keyboard stepping (arrow keys, space, Escape to exit)           |

## Project Story requirements

| ID       | Requirement                                                                                                                                                 |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| STORY-01 | `/story` covers: the starting point (old drafts described, not reused), architecture decisions, challenges, security lessons, skills gained and team thanks |
| STORY-02 | Content comes from WordPress `story_chapter` items written with the owner's notes                                                                           |
| STORY-03 | The page states that YTL Nexus is an internship project, not an official YTL commercial product                                                             |

## Acceptance criteria

- A test proves no live adapter is called in demo mode.
- Tour e2e and presenter keyboard e2e pass.
- The full site runs in demo mode on the Mac with the network off.

## Related

[Product](../product.md) · [15 Library and Studio](15-nexus-library-and-studio.md)
