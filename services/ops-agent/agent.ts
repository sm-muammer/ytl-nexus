import { execFile } from "node:child_process";
import {
  NonceCache,
  validateRequest,
  verifyEnvelope,
  type OpsRequest,
  type OpsResponse,
} from "../../lib/ops/protocol.ts";
import {
  HEALTH_CHECK_TARGETS,
  runProbe,
  type ProbeResult,
  type ProbeTarget,
} from "../../lib/ops/probes.ts";
import { redactLog, type RedactConfig } from "../../lib/ops/redact.ts";
import type { OpsUnit } from "../../lib/ops/units.ts";

// The operations agent's decision logic, with every side effect injected so the
// whole protocol runs in unit tests. main.ts binds it to the Unix socket.
//
// Order of checks for every request: authenticate (signature, time, nonce),
// then validate against the allowlist, then run. A request that fails either
// check executes nothing (OPS-02, OPS-03, OPS-04).

export type Runner = {
  /** Queues `systemctl restart --no-block <unit>.service`. Resolves once queued. */
  restart(unit: OpsUnit): Promise<void>;
  /** Raw journal text for the unit. */
  logs(unit: OpsUnit, lines: number): Promise<string>;
  probe(target: ProbeTarget): Promise<ProbeResult>;
};

export type AgentDeps = {
  secret: string;
  redact: RedactConfig;
  runner: Runner;
  now(): number;
  /** One line per request, for the journal. Never contains a secret. */
  log(entry: Record<string, string | number | boolean>): void;
};

export type AgentReply = { status: 200 | 400 | 401 | 502; body: OpsResponse };

export const MAX_LOG_BYTES = 128 * 1024;

export function createAgent(deps: AgentDeps) {
  const seen = new NonceCache();

  async function execute(req: OpsRequest): Promise<OpsResponse> {
    switch (req.op) {
      case "restart":
        await deps.runner.restart(req.unit);
        return { ok: true, op: "restart", unit: req.unit, accepted: true };
      case "logs": {
        const raw = await deps.runner.logs(req.unit, req.lines);
        const masked = redactLog(raw, deps.redact);
        const lines = masked.split("\n").filter((l) => l.length > 0);
        let bytes = 0;
        const kept: string[] = [];
        // Keep the newest lines when the output is over the byte cap.
        for (let i = lines.length - 1; i >= 0; i--) {
          const line = (lines[i] ?? "").slice(0, 2000);
          bytes += line.length + 1;
          if (bytes > MAX_LOG_BYTES) break;
          kept.unshift(line);
        }
        return {
          ok: true,
          op: "logs",
          unit: req.unit,
          lines: kept,
          truncated: kept.length < lines.length,
        };
      }
      case "health": {
        const result = await deps.runner.probe(HEALTH_CHECK_TARGETS[req.check]);
        return { ok: true, op: "health", check: req.check, ...result };
      }
    }
  }

  return async function handle(rawBody: string): Promise<AgentReply> {
    let envelope: unknown;
    try {
      envelope = JSON.parse(rawBody);
    } catch {
      deps.log({ result: "auth-failure" });
      return { status: 401, body: { ok: false, error: "auth-failure" } };
    }
    if (verifyEnvelope(envelope, deps.secret, deps.now(), seen) !== "ok") {
      deps.log({ result: "auth-failure" });
      return { status: 401, body: { ok: false, error: "auth-failure" } };
    }
    const parsed = validateRequest((envelope as { req: unknown }).req);
    if (!parsed.ok) {
      deps.log({ result: "invalid-request" });
      return { status: 400, body: { ok: false, error: "invalid-request" } };
    }
    const target =
      parsed.req.op === "health" ? parsed.req.check : parsed.req.unit;
    try {
      const body = await execute(parsed.req);
      deps.log({ op: parsed.req.op, target, result: "ok" });
      return { status: 200, body };
    } catch {
      deps.log({ op: parsed.req.op, target, result: "failed" });
      return { status: 502, body: { ok: false, error: "failed" } };
    }
  };
}

// ---- The real runner ------------------------------------------------------------

function run(
  file: string,
  args: string[],
  options: { timeout: number; maxBuffer: number },
): Promise<string> {
  return new Promise((resolve, reject) => {
    // execFile never starts a shell; the arguments are an array of fixed
    // strings plus a validated unit name and an integer.
    execFile(file, args, { ...options, encoding: "utf8" }, (error, stdout) => {
      if (error) reject(error);
      else resolve(stdout);
    });
  });
}

export const systemRunner: Runner = {
  async restart(unit) {
    await run(
      "/usr/bin/systemctl",
      ["restart", "--no-block", `${unit}.service`],
      { timeout: 1_500, maxBuffer: 64 * 1024 },
    );
  },
  logs(unit, lines) {
    return run(
      "/usr/bin/journalctl",
      [
        "--unit",
        `${unit}.service`,
        "--lines",
        String(lines),
        "--no-pager",
        "--output=short-iso",
        "--quiet",
      ],
      { timeout: 8_000, maxBuffer: 2 * 1024 * 1024 },
    );
  },
  probe: (target) => runProbe(target),
};
