import { chmodSync, rmSync } from "node:fs";
import { DEFAULT_IP_RANGES, parseCidr } from "../../lib/ops/redact.ts";
import { createAgent, systemRunner } from "./agent.ts";
import { createOpsServer } from "./server.ts";

// nexus-ops: listens on a Unix socket and answers signed requests from
// nexus-web. Runs as the unprivileged `nexus-ops` user (systemd sets the user,
// the socket directory and the group). See docs/security/ops-agent.md.

const secret = process.env.NEXUS_OPS_SECRET ?? "";
if (secret.length < 32) {
  console.error("NEXUS_OPS_SECRET is missing or shorter than 32 characters.");
  process.exit(1);
}
const socketPath = process.env.NEXUS_OPS_SOCKET ?? "/run/nexus-ops/ops.sock";

const configured = (process.env.NEXUS_OPS_REDACT_RANGES ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);
if (configured.some((c) => parseCidr(c) === null)) {
  console.error("NEXUS_OPS_REDACT_RANGES must be comma-separated IPv4 CIDRs.");
  process.exit(1);
}
const ipRanges = configured.length > 0 ? configured : [...DEFAULT_IP_RANGES];

const handle = createAgent({
  secret,
  redact: { ipRanges, secrets: [secret] },
  runner: systemRunner,
  now: () => Date.now(),
  log: (entry) => console.log(JSON.stringify(entry)),
});

const server = createOpsServer(handle);

rmSync(socketPath, { force: true });
server.listen(socketPath, () => {
  // The unit sets UMask=0007 and Group=nexus-ops-clients; this makes the
  // intent explicit: owner and group only, nobody else.
  chmodSync(socketPath, 0o660);
  console.log(JSON.stringify({ started: true }));
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3_000).unref();
  });
}
