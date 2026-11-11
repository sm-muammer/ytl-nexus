# Nexus Atlas

> **Purpose:** how the service dependency map at `/command/atlas` works and how to read it.
> **Audience:** operators and the next agent session.

## What it shows

Nodes come from the `services` table and edges from `service_dependencies` (Demo mode uses `lib/fixtures/atlas.ts`, kept equal to the seed by a unit test). An edge runs from a service to something it needs. Entry points sit on the left, their dependencies to the right.

Selecting a service opens one panel: state and 24-hour history and uptime (from Nexus Status), what it needs and what needs it, everything affected if it fails, the Library runbook whose `related_service` equals the service slug, recent incidents (link to `/status`), permitted actions and the last five operator actions from the audit trail (action, result, role and time only; no account or address).

## Access and actions

Viewer and above. Actions (health check, 50-line log, restart) appear for Operators and Administrators only, map to the Task 9 allowlist in `lib/atlas/actions.ts`, run through the same Server Functions as `/command/services` (role re-checked, audited) and are disabled in a demo session. Services without an allowlisted unit or check show "No predefined action".

## Keyboard

Tab visits every node. Arrow keys move to the neighbouring node, Enter selects. The List view is a table with the same data. The selection is kept in `?service=<slug>`.

## Design notes

The map is plain SVG built by `lib/atlas/graph.ts`; no graph library is loaded, so the page is usable at once (ATL-06 is met by having nothing to lazy-load). "Explain with Nexus AI" arrives in Task 14.
