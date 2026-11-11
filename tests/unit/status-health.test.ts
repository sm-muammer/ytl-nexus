import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  STALE_AFTER_MS,
  UPTIME_WINDOWS,
  formatUptime,
  nodeHealth,
  uptime,
  uptimeSummary,
  type CheckSample,
} from "@/lib/status/health";

// Property 17: service health derivation and uptime.

const NOW = 1_800_000_000_000;
const state = fc.constantFrom("healthy", "degraded", "down" as const);
const sample = (maxAge: number) =>
  fc.record({
    state,
    checkedAt: fc.integer({ min: 0, max: maxAge }).map((age) => NOW - age),
  });

describe("nodeHealth", () => {
  it("is unknown with no result", () => {
    expect(nodeHealth(undefined, NOW)).toBe("unknown");
  });

  it("is stale only when the latest result is older than five minutes", () => {
    expect(
      nodeHealth({ state: "healthy", checkedAt: NOW - STALE_AFTER_MS }, NOW),
    ).toBe("healthy");
    expect(
      nodeHealth(
        { state: "healthy", checkedAt: NOW - STALE_AFTER_MS - 1 },
        NOW,
      ),
    ).toBe("stale");
  });

  it("returns the latest state when it is recent, and never stale then", () => {
    fc.assert(
      fc.property(sample(STALE_AFTER_MS), (s) => {
        expect(nodeHealth(s, NOW)).toBe(s.state);
      }),
    );
  });

  it("returns stale for any old result, whatever its state", () => {
    fc.assert(
      fc.property(
        state,
        fc.integer({ min: STALE_AFTER_MS + 1, max: 10 ** 10 }),
        (s, age) => {
          expect(nodeHealth({ state: s, checkedAt: NOW - age }, NOW)).toBe(
            "stale",
          );
        },
      ),
    );
  });

  it("accepts Date values", () => {
    expect(
      nodeHealth(
        { state: "down", checkedAt: new Date(NOW - 1000) },
        new Date(NOW),
      ),
    ).toBe("down");
  });
});

describe("uptime", () => {
  it("is healthy checks divided by total checks in the window", () => {
    const checks: CheckSample[] = [
      { state: "healthy", checkedAt: NOW - 1000 },
      { state: "healthy", checkedAt: NOW - 2000 },
      { state: "degraded", checkedAt: NOW - 3000 },
      { state: "down", checkedAt: NOW - 4000 },
    ];
    expect(uptime(checks, 60_000, NOW)).toBe(0.5);
  });

  it("is null with no check in the window, not 0 or 1", () => {
    expect(uptime([], 60_000, NOW)).toBeNull();
    expect(
      uptime([{ state: "healthy", checkedAt: NOW - 90_000 }], 60_000, NOW),
    ).toBeNull();
  });

  it("lies between 0 and 1 and matches the count, for any set of checks", () => {
    fc.assert(
      fc.property(
        fc.array(sample(40 * 24 * 3_600_000), { maxLength: 200 }),
        (checks) => {
          for (const w of UPTIME_WINDOWS) {
            const inWindow = checks.filter(
              (c) => NOW - Number(c.checkedAt) <= w.ms,
            );
            const healthy = inWindow.filter((c) => c.state === "healthy");
            const value = uptime(checks, w.ms, NOW);
            if (inWindow.length === 0) {
              expect(value).toBeNull();
            } else {
              expect(value).toBeGreaterThanOrEqual(0);
              expect(value).toBeLessThanOrEqual(1);
              expect(value).toBeCloseTo(healthy.length / inWindow.length, 10);
            }
          }
        },
      ),
    );
  });

  it("never falls as healthy checks are added to the window", () => {
    fc.assert(
      fc.property(
        fc.array(sample(3_600_000), { minLength: 1, maxLength: 50 }),
        (checks) => {
          const before = uptime(checks, 24 * 3_600_000, NOW) ?? 0;
          const after =
            uptime(
              [...checks, { state: "healthy", checkedAt: NOW - 10 }],
              24 * 3_600_000,
              NOW,
            ) ?? 0;
          expect(after).toBeGreaterThanOrEqual(before - 1e-12);
        },
      ),
    );
  });

  it("summarises 24 hours, 7 days and 30 days", () => {
    const checks: CheckSample[] = [
      { state: "healthy", checkedAt: NOW - 3_600_000 },
      { state: "down", checkedAt: NOW - 3 * 24 * 3_600_000 },
      { state: "down", checkedAt: NOW - 20 * 24 * 3_600_000 },
    ];
    expect(uptimeSummary(checks, NOW)).toEqual({
      "24h": 1,
      "7d": 0.5,
      "30d": 1 / 3,
    });
  });
});

describe("formatUptime", () => {
  it("shows no data, 100% only for a perfect record, and never rounds a miss up", () => {
    expect(formatUptime(null)).toBe("No data");
    expect(formatUptime(1)).toBe("100%");
    expect(formatUptime(0.9999)).toBe("99.9%");
    expect(formatUptime(0.5)).toBe("50.0%");
    expect(formatUptime(0)).toBe("0.0%");
  });
});
