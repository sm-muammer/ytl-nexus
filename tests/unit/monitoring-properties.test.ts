import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { QUERIES, isQueryId } from "@/lib/monitoring/queries";
import {
  STALE_AFTER_INTERVALS,
  isStale,
  serviceHealth,
  type UnitState,
} from "@/lib/monitoring/snapshot";
import { demoSnapshot } from "@/lib/fixtures/metrics";
import { SnapshotPoller } from "@/lib/server/monitoring/poller";
import {
  QueryNotAllowedError,
  createPrometheusClient,
} from "@/lib/server/prometheus";
import {
  createStreamResponse,
  streamsOpenFor,
} from "@/lib/server/monitoring/stream";

// Property 15: Metrics query allowlist. Property 16: poller backoff,
// staleness and stream cap (tasks 9.1).

describe("Property 15: the query allowlist", () => {
  it("accepts a string if and only if it is a key of the allowlist", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(isQueryId(s)).toBe(Object.keys(QUERIES).includes(s));
      }),
    );
  });

  it("never sends a request for text that is not an ID, whatever the text", async () => {
    const fetchSpy = vi.fn();
    const client = createPrometheusClient(
      { baseUrl: "http://127.0.0.1:9090" },
      fetchSpy as unknown as typeof fetch,
    );
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.string(),
          fc.constantFrom("__proto__", "constructor", "hasOwnProperty"),
        ),
        async (s) => {
          fc.pre(!Object.keys(QUERIES).includes(s));
          await expect(client.instant(s)).rejects.toBeInstanceOf(
            QueryNotAllowedError,
          );
        },
      ),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("Property 16: backoff, staleness and the stream cap", () => {
  it("backoff is the interval doubled per failure, never below the interval or above the ceiling, and never decreasing", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 12 }),
        async (intervalSeconds, failures) => {
          vi.useFakeTimers();
          try {
            const interval = intervalSeconds * 1000;
            const max = 60_000;
            const poller = new SnapshotPoller({
              collect: async () => {
                throw new Error("down");
              },
              intervalMs: interval,
              maxBackoffMs: Math.max(max, interval),
            });
            const delays: number[] = [];
            poller.subscribe(() => {});
            await vi.advanceTimersByTimeAsync(0);
            for (let i = 0; i < failures; i += 1) {
              delays.push(poller.nextDelay());
              await vi.advanceTimersByTimeAsync(poller.nextDelay());
            }
            for (const d of delays) {
              expect(d).toBeGreaterThanOrEqual(interval);
              expect(d).toBeLessThanOrEqual(Math.max(max, interval));
            }
            for (let i = 1; i < delays.length; i += 1) {
              expect(delays[i]!).toBeGreaterThanOrEqual(delays[i - 1]!);
            }
          } finally {
            vi.useRealTimers();
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  it("data is stale exactly when older than three intervals", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 60_000 }),
        fc.integer({ min: 0, max: 400_000 }),
        (interval, age) => {
          const s = { ...demoSnapshot(0), takenAt: 0, intervalMs: interval };
          expect(isStale(s, age)).toBe(age > STALE_AFTER_INTERVALS * interval);
        },
      ),
    );
  });

  it("stale data is never reported as healthy, for any unit state", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<UnitState>(
          "active",
          "inactive",
          "failed",
          "activating",
          "deactivating",
          "absent",
          "unknown",
        ),
        (state) => {
          expect(serviceHealth(state, true)).not.toBe("ok");
        },
      ),
    );
  });

  it("a user never holds more than the cap, however opens and aborts interleave", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom("open", "close"), {
          minLength: 1,
          maxLength: 40,
        }),
        fc.integer({ min: 1, max: 5 }),
        (ops, cap) => {
          const key = `prop-${Math.random()}`;
          const poller = { subscribe: () => () => {} };
          const live: AbortController[] = [];
          for (const op of ops) {
            if (op === "open") {
              const c = new AbortController();
              const res = createStreamResponse({
                poller,
                signal: c.signal,
                key,
                max: cap,
              });
              if (res.status === 200) live.push(c);
              else expect(res.status).toBe(429);
            } else {
              live.pop()?.abort();
            }
            expect(streamsOpenFor(key)).toBe(live.length);
            expect(live.length).toBeLessThanOrEqual(cap);
          }
          for (const c of live) c.abort();
          expect(streamsOpenFor(key)).toBe(0);
        },
      ),
      { numRuns: 50 },
    );
  });
});
