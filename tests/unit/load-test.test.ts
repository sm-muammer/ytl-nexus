import { describe, expect, it } from "vitest";
import {
  runPageLoadTest,
  runSseLoadTest,
} from "../../scripts/quality/load-test";
import http from "node:http";

describe("load test harness (Task 20 & Requirement 8.9)", () => {
  it("measures latency percentiles and RPS on mock HTTP server", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/fast") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("ok");
      } else {
        res.writeHead(404);
        res.end("not found");
      }
    });

    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const res = await runPageLoadTest({
        baseUrl,
        path: "/fast",
        concurrency: 5,
        totalRequests: 20,
      });

      expect(res.endpoint).toBe("/fast");
      expect(res.totalRequests).toBe(20);
      expect(res.successCount).toBe(20);
      expect(res.failureCount).toBe(0);
      expect(res.requestsPerSecond).toBeGreaterThan(0);
      expect(res.avgMs).toBeGreaterThanOrEqual(0);
      expect(res.p95Ms).toBeGreaterThanOrEqual(res.p50Ms);
      expect(res.maxMs).toBeGreaterThanOrEqual(res.minMs);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("handles concurrent SSE streaming subscribers without drops", async () => {
    const server = http.createServer((req, res) => {
      if (req.url === "/stream") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const interval = setInterval(() => {
          res.write(`event: metrics\ndata: {"ok":true}\n\n`);
        }, 100);
        req.on("close", () => clearInterval(interval));
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    await new Promise<void>((resolve) =>
      server.listen(0, "127.0.0.1", resolve),
    );
    const address = server.address() as { port: number };
    const baseUrl = `http://127.0.0.1:${address.port}`;

    try {
      const sseRes = await runSseLoadTest({
        baseUrl,
        path: "/stream",
        clientCount: 5,
        listenSeconds: 1,
      });

      expect(sseRes.totalClients).toBe(5);
      expect(sseRes.connectedClients).toBe(5);
      expect(sseRes.eventsReceived).toBeGreaterThanOrEqual(5);
      expect(sseRes.droppedClients).toBe(0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
