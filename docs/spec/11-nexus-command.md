# Nexus Command: infrastructure dashboard

> **Purpose:** requirements for the live dashboard of Nexus Core 01 and its particle field.
> **Audience:** builders and reviewers of Task 8. Access: Viewer and above.

## Summary

Nexus Command shows real telemetry from the Rocky server, presented as **Nexus Core 01** (`nexus-core-01`). It is the visual centrepiece: an interactive particle field where each cluster represents a service and its health.

## Routes

| Route               | Content                                                                                         |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| `/command`          | Overview: health summary, particle field, key metrics, recent events, links to Atlas and Status |
| `/command/core-01`  | Server identity, hardware, uptime, OS, current resource use                                     |
| `/command/metrics`  | Range charts (1 h, 6 h, 24 h, 7 d)                                                              |
| `/command/services` | Tracked services with state and links to runbooks                                               |
| `/command/atlas`    | Nexus Atlas ([13](13-nexus-atlas.md))                                                           |

## Requirements

| ID     | Requirement                                                                                                                                                                                                              |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| CMD-01 | Prometheus (127.0.0.1:9090, 15-day retention) scrapes node_exporter (rebound to 127.0.0.1:9100 with the systemd collector) and service exporters                                                                         |
| CMD-02 | Nexus queries Prometheus only with fixed PromQL from an allowlist: CPU, load, memory, swap, disk usage and IO, network, uptime, and systemd unit states for tracked services. Callers pass a query ID, never PromQL text |
| CMD-03 | One in-process poller queries Prometheus on a fixed interval with backoff and fans out to all browsers over SSE at `/api/metrics/stream`                                                                                 |
| CMD-04 | Every value shows a **Live** or **Demo** label                                                                                                                                                                           |
| CMD-05 | Particle field: one cluster per tracked service; colour and motion reflect health; gentle pointer response; quality tiers; static frame under reduced motion; pauses when hidden                                         |
| CMD-06 | Stale data (no update for 3 intervals) is shown as stale, not as healthy                                                                                                                                                 |
| CMD-07 | Range charts have legends, tooltips, accessible colours and a table alternative                                                                                                                                          |

## Security requirements

- Prometheus and node_exporter listen on loopback only.
- The SSE route requires Viewer or above and limits connections per session.
- No hostname, IP or internal path is shown to Visitors; the public Status page uses a sanitized summary.

## Demo mode

Deterministic fixtures drive the same UI and SSE shape, labelled **Demo**.

## Acceptance criteria

- Adapter tests pass against fixture responses; non-allowlisted query IDs are rejected.
- SSE reconnects after a dropped connection.
- Reduced motion renders the static frame.
- Live CPU, memory, disk, network and service state appear with reactive particles.

## Related

[12 Status and operations](12-nexus-status-and-operations.md) · [13 Atlas](13-nexus-atlas.md) · [01 Design, motion](01-experience-and-design.md#4-motion)
