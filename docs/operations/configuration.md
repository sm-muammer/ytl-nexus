# YTL Nexus configuration

> **Purpose:** every environment variable YTL Nexus reads, what it does and where it lives.
> **Audience:** developers running the app locally and the IT Infrastructure team configuring the server.

Variables are added to this file in the same commit that starts reading them. Secrets are named here, never shown. Locally they live in `.env.local` (Git-ignored); on Nexus Core 01 they live in `/etc/ytl-nexus/*.env` (`root:nexus`, mode 0640), loaded by the `nexus-web` systemd unit and by `deploy.sh` when it builds (Task 4). On Core 01, `/etc/ytl-nexus/web.env` currently holds `NEXUS_MODE=live` and nothing secret; the unit adds `NODE_ENV=production`, `PORT=3000` and `HOSTNAME=127.0.0.1` itself. Do not put `NODE_ENV=production` in `web.env`: the build would then skip dev dependencies and fail. See [Deploy](deploy.md).

## Variables

| Variable     | Required | Values           | Used by                                                      | Secret |
| ------------ | -------- | ---------------- | ------------------------------------------------------------ | ------ |
| `NEXUS_MODE` | Yes      | `live` or `demo` | `instrumentation.ts`, `lib/server/mode.ts`, the adapter sets | No     |

### `NEXUS_MODE`

Chooses which of the two adapter sets the server uses ([`lib/server/adapters`](../../lib/server/adapters/index.ts)).

| Value  | Behaviour                                                                                                                                                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `demo` | The whole UI runs on fixtures from `lib/fixtures`. No adapter opens a network or database connection. Every value carries a "Demo data" label. A demo session switcher lets a presenter view as each role |
| `live` | Adapters talk to the real services. In Task 3 they are placeholders that report "Not connected"; each module task connects its own. Nobody is signed in until Task 6                                      |

The value must be exactly `live` or `demo` (lower case, no spaces). Anything else, or no value, stops the server at start with an error that names `NEXUS_MODE` and the accepted values. The same applies to `npm run build`, because pages read the mode while building.

Run it locally:

```bash
cp .env.example .env.local     # sets NEXUS_MODE=demo
npm run dev
```

Run the production build offline, as a portfolio demo:

```bash
NEXUS_MODE=demo npm run build && NEXUS_MODE=demo npm start
```

CI and the Playwright test server set `NEXUS_MODE=demo`.

## Demo session cookie

In demo mode the session switcher stores the chosen role in the HttpOnly cookie `nexus-demo-role` (values `viewer`, `member`, `operator`, `admin`; no cookie means Visitor). Only the demo auth adapter reads it, and the Server Function that sets it does nothing in `live` mode. It is a presentation aid: it changes menus and labels and grants nothing. Real access control arrives with `requireRole()` in Task 6.

Related: [Technology](../tech.md) · [Security](../security.md) · [Nexus Tour, Project Story and demo mode](../spec/22-nexus-tour-story-and-demo-mode.md)
