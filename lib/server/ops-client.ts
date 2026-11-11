import "server-only";
import { request } from "node:http";
import { signEnvelope, type OpsResponse } from "@/lib/ops/protocol";

// The web side of the operations agent protocol. Signs a request with the shared
// secret and sends it over the Unix socket. The agent is the authority on what
// is allowed; this client only transports. It returns a typed result and never
// throws, and no error carries the socket path or the secret (OPS-02).

export type OpsCallResult =
  | { ok: true; response: Extract<OpsResponse, { ok: true }> }
  | {
      ok: false;
      error: "unavailable" | "auth-failure" | "invalid-request" | "failed";
    };

const DEFAULT_SOCKET = "/run/nexus-ops/ops.sock";

export type OpsClientConfig = { secret: string; socketPath: string };

export function readOpsConfig(
  env: Record<string, string | undefined> = process.env,
): OpsClientConfig | null {
  const secret = env.NEXUS_OPS_SECRET;
  if (!secret || secret.length < 32) return null;
  return { secret, socketPath: env.NEXUS_OPS_SOCKET ?? DEFAULT_SOCKET };
}

function isResponse(value: unknown): value is OpsResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { ok?: unknown }).ok === "boolean"
  );
}

export function callOps(
  req: unknown,
  options: {
    config?: OpsClientConfig | null;
    now?: () => number;
    timeoutMs?: number;
  } = {},
): Promise<OpsCallResult> {
  const config =
    options.config === undefined ? readOpsConfig() : options.config;
  if (!config) return Promise.resolve({ ok: false, error: "unavailable" });
  const body = JSON.stringify(
    signEnvelope(req, config.secret, (options.now ?? Date.now)()),
  );
  return new Promise((resolve) => {
    let settled = false;
    const done = (result: OpsCallResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const http = request(
      {
        socketPath: config.socketPath,
        path: "/v1/request",
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
        timeout: options.timeoutMs ?? 12_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > 512 * 1024) {
            res.destroy();
            done({ ok: false, error: "failed" });
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () => {
          try {
            const parsed: unknown = JSON.parse(
              Buffer.concat(chunks).toString("utf8"),
            );
            if (!isResponse(parsed))
              return done({ ok: false, error: "failed" });
            if (parsed.ok) return done({ ok: true, response: parsed });
            const known = [
              "auth-failure",
              "invalid-request",
              "failed",
            ] as const;
            done({
              ok: false,
              error: known.find((k) => k === parsed.error) ?? "failed",
            });
          } catch {
            done({ ok: false, error: "failed" });
          }
        });
        res.on("error", () => done({ ok: false, error: "failed" }));
      },
    );
    http.on("timeout", () => {
      http.destroy();
      done({ ok: false, error: "unavailable" });
    });
    http.on("error", () => done({ ok: false, error: "unavailable" }));
    http.end(body);
  });
}
