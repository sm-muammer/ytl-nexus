# Nexus Atlas: service dependency map

> **Purpose:** requirements for the interactive map that connects every module through the services they depend on.
> **Audience:** builders and reviewers of Task 10. Access: Viewer and above at `/command/atlas`.

## Summary

Atlas draws the platform's services and their dependencies as a live graph. Selecting a service opens one panel that joins health, metrics, documentation, incidents, AI explanations, permitted actions and audit history.

## Requirements

| ID     | Requirement                                                                                                                                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ATL-01 | Nodes and edges come from the `services` and `service_dependencies` tables, not from hard-coded markup                                                                                                           |
| ATL-02 | Node colour reflects live health from the metrics poller; stale or unknown health is shown distinctly                                                                                                            |
| ATL-03 | Node detail panel: health and recent metrics, upstream and downstream dependencies, runbook link (Library), recent incidents (Status), allowed actions (role-gated, through the operations agent), audit history |
| ATL-04 | "Explain with Nexus AI" in the panel (added in Task 14) sends a sanitized server-built summary, never raw logs                                                                                                   |
| ATL-05 | Fully keyboard navigable, with an equivalent list view                                                                                                                                                           |
| ATL-06 | The graph library is lazy-loaded and the page stays usable before it loads                                                                                                                                       |

## Demo mode

Fixture inventory and health; actions disabled with a "Demo session" explanation.

## Acceptance criteria

- Graph-building unit tests pass; keyboard e2e reaches every node and the panel.
- Actions are hidden or disabled for roles without permission.
- Selecting a service shows its metrics, runbook, incidents and permitted actions.

## Related

[11 Command](11-nexus-command.md) · [12 Status and operations](12-nexus-status-and-operations.md) · [18 AI](18-nexus-ai.md)
