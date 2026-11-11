import { request } from "node:http";
import { connect } from "node:net";
import type { HealthCheckId } from "./units.ts";

// Predefined probes, shared by the operations agent (the `health` operation)
// and the worker (the 60-second service checks). Every target is a fixed
// loopback address in this file; nothing a request says reaches a socket.

export type ProbeTarget =
  { kind: "tcp"; host: string; port: number } | { kind: "http"; url: string };

export type ProbeState = "healthy" | "degraded" | "down";

export type ProbeResult = {
  state: ProbeState;
  latencyMs: number | null;
  /** A fixed phrase. Never a host, address or system error text. */
  detail: string;
};

export const HEALTH_CHECK_TARGETS: Record<HealthCheckId, ProbeTarget> = {
  web: { kind: "http", url: "http://127.0.0.1:3000/api/health/live" },
  database: { kind: "tcp", host: "127.0.0.1", port: 3306 },
  prometheus: { kind: "http", url: "http://127.0.0.1:9090/-/healthy" },
  ollama: { kind: "http", url: "http://127.0.0.1:11434/api/version" },
  sftpgo: { kind: "tcp", host: "127.0.0.1", port: 8091 },
  mail: { kind: "tcp", host: "127.0.0.1", port: 25 },
};

export const PROBE_TIMEOUT_MS = 3_000;
/** A reply slower than this counts as degraded. */
export const SLOW_MS = 1_000;

const NO_ANSWER: ProbeResult = {
  state: "down",
  latencyMs: null,
  detail: "No answer",
};

function judge(latencyMs: number, ok: boolean): ProbeResult {
  if (!ok) return { state: "degraded", latencyMs, detail: "Unexpected reply" };
  if (latencyMs > SLOW_MS) {
    return { state: "degraded", latencyMs, detail: "Slow reply" };
  }
  return { state: "healthy", latencyMs, detail: "Answered" };
}

function tcpProbe(
  host: string,
  port: number,
  timeoutMs: number,
): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    const socket = connect({ host, port });
    let done = false;
    const finish = (result: ProbeResult) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs, () => finish(NO_ANSWER));
    socket.once("error", () => finish(NO_ANSWER));
    socket.once("connect", () => finish(judge(Date.now() - started, true)));
  });
}

function httpProbe(url: string, timeoutMs: number): Promise<ProbeResult> {
  return new Promise((resolve) => {
    const started = Date.now();
    let done = false;
    const finish = (result: ProbeResult) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    const req = request(url, { method: "GET", timeout: timeoutMs }, (res) => {
      const status = res.statusCode ?? 0;
      res.destroy();
      finish(judge(Date.now() - started, status >= 200 && status < 300));
    });
    req.once("timeout", () => {
      req.destroy();
      finish(NO_ANSWER);
    });
    req.once("error", () => finish(NO_ANSWER));
    req.end();
  });
}

export function runProbe(
  target: ProbeTarget,
  timeoutMs: number = PROBE_TIMEOUT_MS,
): Promise<ProbeResult> {
  return target.kind === "tcp"
    ? tcpProbe(target.host, target.port, timeoutMs)
    : httpProbe(target.url, timeoutMs);
}
