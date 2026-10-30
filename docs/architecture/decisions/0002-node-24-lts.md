# ADR 0002: Node.js 24 LTS for the server and CI

- **Status:** accepted
- **Date:** 2026-10-30
- **Supersedes:** the "Node 22 LTS" line in the original plan

## Context

Next.js 16.3.5 requires Node.js 20.9 or newer. The plan named Node 22 LTS. A read-only check on Nexus Core 01 showed the Rocky Linux module streams `nodejs:18`, `20`, `22` and `24`. Node 22 reaches end of life in April 2027, only months after handover. Node 24 is an LTS line supported until April 2028. The owner's Mac runs Node 26.

## Decision

- Install Node.js 24 from the `nodejs:24` module stream on the server.
- Pin CI to Node 24 through `.node-version`.
- Declare `"engines": { "node": ">=24" }` in `package.json`.

## Consequences

- The team gets about 17 months of supported runtime after handover.
- Local development on Node 26 is newer than production; CI on Node 24 catches incompatibilities.
- The handover roadmap must include the move to the next LTS before April 2028.
