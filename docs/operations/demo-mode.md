# Running YTL Nexus in Demo Mode

> **Purpose:** Guidance for running, verifying, and presenting YTL Nexus completely offline using deterministic fixtures.
> **Audience:** Presenters, reviewers, auditors, and IT infrastructure operators.
> **Spec:** [22 Nexus Tour, Story and Demo Mode](../spec/22-nexus-tour-story-and-demo-mode.md).

---

## 1. Overview

YTL Nexus includes a zero-dependency **Demo Mode** (`NEXUS_MODE=demo`). When enabled:

1. **Deterministic Fixtures (DEMO-01, DEMO-02):** Every server adapter (database, authentication, WordPress, Prometheus, Ollama, SFTPGo, operations agent, mail) switches from live network/socket connections to pure, in-memory fixtures located in `lib/fixtures/`.
2. **Offline & Air-gapped Execution (DEMO-04):** The full platform builds and runs offline with the network disconnected. No outbound calls are made to live databases, daemons, or remote APIs.
3. **Strict Isolation (DEMO-05):** Enforced by automated tests (`tests/unit/demo-adapters.test.ts`), verifying that no network sockets (`net.connect`), HTTP requests (`fetch`), or live child processes are spawned in demo mode.
4. **Honest Attribution (DEMO-03):** Every demo figure, metric, and table row carries a visible **"Demo data"** or **Demo** label.
5. **Interactive Demo Session Switcher (DEMO-06):** Presenters can switch their active persona between Visitor, Viewer, Member, Operator, and Administrator directly from the header drawer. Role state is maintained via a secure, local HTTP-only cookie (`nexus-demo-role`).

---

## 2. Quickstart: Running Offline

### Prerequisites

- Node.js >= 24 (or Node.js 26)
- Dependencies installed: `npm ci`

### Running the Production Server Offline

```bash
# 1. Turn off Wi-Fi or disconnect Ethernet (optional, to verify zero-network operation)

# 2. Build and start with NEXUS_MODE=demo
NEXUS_MODE=demo npm run build
NEXUS_MODE=demo npm start
```

Open your browser to `http://localhost:3000`.

### Running in Development

```bash
NEXUS_MODE=demo npm run dev
```

---

## 3. Demo Personas & Capabilities (DEMO-06)

To demonstrate how authorization controls work across roles without touching an authentication database:

| Persona           | Role Key   | Visible Modules & Capabilities                                                                                                                                  |
| :---------------- | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visitor**       | `null`     | Public home, Nexus Tour, Project Story, Library (public articles), Status (public metrics), Yes Experience. Workspace routes redirect to sign-in or return 404. |
| **Viewer**        | `viewer`   | Read-only access to Nexus Command (Core 01 telemetry), Atlas (topology graph), Status (full checks & incident history), and Data browser.                       |
| **Member**        | `member`   | Viewer permissions plus Nexus AI chat and runbook explanation tools.                                                                                            |
| **Operator**      | `operator` | Member permissions plus Nexus Shield (security posture findings), Nexus Continuity (backup freshness & restore drill logs), and operations actions preview.     |
| **Administrator** | `admin`    | Full platform visibility, including Nexus Control (user accounts, SFTPGo accounts, virtual mailboxes, system service controls).                                 |

_Note: In demo mode, all modifying operations (e.g. restarts, data inserts, account changes, status posts) are safely disabled with an informative banner explaining that changes are not persisted._

---

## 4. Key Demo Paths

1. **Nexus Tour (`/tour`):**
   - Interactive 16-step guided walkthrough covering every platform module.
   - Signal-ribbon animated progress bar across steps.
   - **Presenter Mode:** Toggle with <kbd>P</kbd> or the button for expanded typography, hidden chrome, and keyboard navigation (<kbd>→</kbd>, <kbd>Space</kbd>, <kbd>←</kbd>, <kbd>Esc</kbd>).

2. **Project Story (`/story`):**
   - In-depth case study detailing the internship journey, architecture trade-offs, security lessons learned, team acknowledgments, and official disclaimer.

3. **Nexus Command & Atlas (`/command`, `/command/atlas`):**
   - Simulated real-time server telemetry (CPU, RAM, disk, network, ambient particle field) and interactive dependency graph with full component metadata.

4. **Nexus Continuity & Shield (`/continuity`, `/shield`):**
   - Backup age and verified restore drills across all 9 monitored sub-systems; 11-point security posture audit findings with clear risk remediation guidance.

---

## 5. Verification & Tests

To run the automated test suite enforcing demo mode integrity:

```bash
# Verify demo adapter safety and isolation
npx vitest run tests/unit/demo-adapters.test.ts

# Run the end-to-end tour and presenter tests
npx playwright test tests/e2e/tour.spec.ts
```
