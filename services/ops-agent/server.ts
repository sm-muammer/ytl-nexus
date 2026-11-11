import { createServer, type Server } from "node:http";
import type { AgentReply } from "./agent.ts";

// The HTTP layer of the operations agent: one route, a small body limit and
// short timeouts. It carries bytes to the agent and bytes back; every decision
// is made in agent.ts.

export const MAX_BODY = 4096;

export function createOpsServer(
  handle: (rawBody: string) => Promise<AgentReply>,
): Server {
  const server = createServer((req, res) => {
    const reply = (status: number, body: unknown) => {
      const text = JSON.stringify(body);
      res.writeHead(status, {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(text),
        "cache-control": "no-store",
      });
      res.end(text);
    };
    if (req.method !== "POST" || req.url !== "/v1/request") {
      reply(404, { ok: false, error: "invalid-request" });
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    let tooBig = false;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        tooBig = true;
        reply(401, { ok: false, error: "auth-failure" });
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (tooBig) return;
      void handle(Buffer.concat(chunks).toString("utf8")).then((r) =>
        reply(r.status, r.body),
      );
    });
  });
  server.maxConnections = 16;
  server.headersTimeout = 5_000;
  server.requestTimeout = 15_000;
  return server;
}
