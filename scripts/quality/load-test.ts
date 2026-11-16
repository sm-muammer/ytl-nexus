import http from "node:http";

// Task 20 & Requirement 8.9: Light load test on SSE and pages from the Mac.
// Tests concurrent page requests and concurrent SSE connections to /api/stream/metrics.

export type LoadTestResult = {
  endpoint: string;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  durationMs: number;
  requestsPerSecond: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  minMs: number;
  maxMs: number;
  avgMs: number;
};

export type SseLoadResult = {
  totalClients: number;
  connectedClients: number;
  eventsReceived: number;
  droppedClients: number;
  durationMs: number;
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))]!;
}

export async function runPageLoadTest(options: {
  baseUrl: string;
  path: string;
  concurrency: number;
  totalRequests: number;
}): Promise<LoadTestResult> {
  const { baseUrl, path, concurrency, totalRequests } = options;
  const url = new URL(path, baseUrl);
  const latencies: number[] = [];
  let completed = 0;
  let successes = 0;
  let failures = 0;

  const startAll = performance.now();

  async function worker() {
    while (completed < totalRequests) {
      completed++;
      const reqStart = performance.now();
      try {
        const statusCode = await new Promise<number>((resolve, reject) => {
          const req = http.get(url, { timeout: 5000 }, (res) => {
            res.resume();
            res.on("end", () => resolve(res.statusCode ?? 500));
          });
          req.on("error", reject);
          req.on("timeout", () => {
            req.destroy();
            reject(new Error("Timeout"));
          });
        });
        const elapsed = performance.now() - reqStart;
        latencies.push(elapsed);
        if (statusCode >= 200 && statusCode < 400) {
          successes++;
        } else {
          failures++;
        }
      } catch {
        failures++;
        latencies.push(performance.now() - reqStart);
      }
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker());
  await Promise.all(workers);

  const durationMs = performance.now() - startAll;
  latencies.sort((a, b) => a - b);

  return {
    endpoint: path,
    totalRequests,
    successCount: successes,
    failureCount: failures,
    durationMs: Math.round(durationMs),
    requestsPerSecond: Math.round((successes / (durationMs / 1000)) * 10) / 10,
    p50Ms: Math.round(percentile(latencies, 50) * 10) / 10,
    p95Ms: Math.round(percentile(latencies, 95) * 10) / 10,
    p99Ms: Math.round(percentile(latencies, 99) * 10) / 10,
    minMs: Math.round((latencies[0] ?? 0) * 10) / 10,
    maxMs: Math.round((latencies[latencies.length - 1] ?? 0) * 10) / 10,
    avgMs:
      Math.round(
        (latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1)) * 10,
      ) / 10,
  };
}

export async function runSseLoadTest(options: {
  baseUrl: string;
  path: string;
  clientCount: number;
  listenSeconds: number;
}): Promise<SseLoadResult> {
  const { baseUrl, path, clientCount, listenSeconds } = options;
  const url = new URL(path, baseUrl);
  let connected = 0;
  let events = 0;
  let dropped = 0;

  const start = performance.now();

  const clients = Array.from({ length: clientCount }, () => {
    return new Promise<void>((resolve) => {
      let reqConnected = false;
      const req = http.get(url, (res) => {
        if (res.statusCode === 200) {
          connected++;
          reqConnected = true;
        }

        res.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          if (text.includes("data:")) {
            events++;
          }
        });

        res.on("error", () => {
          if (reqConnected) dropped++;
        });

        setTimeout(() => {
          req.destroy();
          resolve();
        }, listenSeconds * 1000);
      });

      req.on("error", () => {
        if (!reqConnected) dropped++;
        resolve();
      });
    });
  });

  await Promise.all(clients);
  const durationMs = performance.now() - start;

  return {
    totalClients: clientCount,
    connectedClients: connected,
    eventsReceived: events,
    droppedClients: dropped,
    durationMs: Math.round(durationMs),
  };
}

if (process.argv[1]?.endsWith("load-test.ts")) {
  const port = process.env.PORT || 3000;
  const baseUrl = `http://127.0.0.1:${port}`;

  (async () => {
    console.log(`Starting light load test against ${baseUrl}...\n`);

    const routes = [
      "/",
      "/platform",
      "/tour",
      "/status",
      "/api/health/live",
      "/api/health/ready",
    ];

    console.log("=== Page Load Concurrency Test (50 reqs, 10 concurrent) ===");
    for (const route of routes) {
      const res = await runPageLoadTest({
        baseUrl,
        path: route,
        concurrency: 10,
        totalRequests: 50,
      });
      console.log(
        ` ${res.endpoint.padEnd(20)} | ${res.requestsPerSecond} rps | avg: ${res.avgMs}ms | p95: ${res.p95Ms}ms | pass: ${res.successCount}/${res.totalRequests}`,
      );
    }

    console.log("\n=== SSE Metrics Stream Concurrency Test ===");
    console.log(
      "Connecting 10 concurrent SSE subscribers to /api/stream/metrics for 3s...",
    );
    const sseRes = await runSseLoadTest({
      baseUrl,
      path: "/api/stream/metrics",
      clientCount: 10,
      listenSeconds: 3,
    });
    console.log(
      ` SSE Connected: ${sseRes.connectedClients}/${sseRes.totalClients} | Events received: ${sseRes.eventsReceived} | Dropped: ${sseRes.droppedClients}`,
    );

    console.log("\nLoad test completed successfully!");
  })();
}
