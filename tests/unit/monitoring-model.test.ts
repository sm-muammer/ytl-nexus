import { describe, expect, it } from "vitest";
import {
  CHART_BOX,
  linePath,
  makeScale,
  niceMax,
  sample,
} from "@/lib/monitoring/chart";
import {
  BEHAVIOUR,
  POINTER_RADIUS,
  ClusterField,
  layoutClusters,
  rng,
} from "@/lib/monitoring/cluster-field";
import { RANGES, RANGE_QUERY_IDS } from "@/lib/monitoring/queries";
import { TRACKED_SERVICES } from "@/lib/monitoring/services";
import {
  STALE_AFTER_INTERVALS,
  emptySnapshot,
  formatBytes,
  formatDuration,
  formatPercent,
  isStale,
  overallHealth,
  percentLevel,
  serviceHealth,
  type Health,
  type UnitState,
} from "@/lib/monitoring/snapshot";
import {
  DEMO_INTERVAL_MS,
  demoRange,
  demoSnapshot,
} from "@/lib/fixtures/metrics";

const UNIT_STATES: UnitState[] = [
  "active",
  "inactive",
  "failed",
  "activating",
  "deactivating",
  "absent",
  "unknown",
];

describe("staleness (CMD-06)", () => {
  it("is stale after more than three intervals, not at three", () => {
    const s = demoSnapshot(1_000_000);
    const limit = STALE_AFTER_INTERVALS * s.intervalMs;
    expect(isStale(s, s.takenAt + limit)).toBe(false);
    expect(isStale(s, s.takenAt + limit + 1)).toBe(true);
  });

  it("never shows a stale service as running, whatever its state", () => {
    for (const state of UNIT_STATES) {
      expect(serviceHealth(state, true)).toBe("stale");
    }
    expect(serviceHealth("active", false)).toBe("ok");
  });

  it("never shows an unknown state as healthy", () => {
    expect(serviceHealth("unknown", false)).not.toBe("ok");
  });

  it("reports an unreachable or old snapshot as stale overall", () => {
    const s = demoSnapshot(1_000_000);
    expect(overallHealth(s, s.takenAt)).not.toBe("stale");
    expect(overallHealth({ ...s, reachable: false }, s.takenAt)).toBe("stale");
    expect(overallHealth(s, s.takenAt + 10 * s.intervalMs)).toBe("stale");
    expect(overallHealth(emptySnapshot("live", 0, 15000), 0)).toBe("stale");
  });

  it("turns bad when a service failed or a gauge is critical", () => {
    const s = demoSnapshot(1_000_000);
    const failed = {
      ...s,
      services: s.services.map((x, i) =>
        i === 0 ? { ...x, state: "failed" as const } : x,
      ),
    };
    expect(overallHealth(failed, s.takenAt)).toBe("bad");
    expect(
      overallHealth(
        { ...s, metrics: { ...s.metrics, diskPct: 97 } },
        s.takenAt,
      ),
    ).toBe("bad");
    expect(
      overallHealth({ ...s, metrics: { ...s.metrics, memPct: 85 } }, s.takenAt),
    ).toBe("warn");
  });

  it("treats a stopped or missing unit as idle, not a fault", () => {
    expect(serviceHealth("inactive", false)).toBe("idle");
    expect(serviceHealth("absent", false)).toBe("idle");
  });

  it("levels percentages and handles missing values", () => {
    expect(percentLevel(null)).toBe("unknown");
    expect(percentLevel(Number.NaN)).toBe("unknown");
    expect(percentLevel(50)).toBe("ok");
    expect(percentLevel(80)).toBe("warn");
    expect(percentLevel(92)).toBe("bad");
  });
});

describe("formatting", () => {
  it("formats readings and says 'No data' for null", () => {
    expect(formatPercent(12.34)).toBe("12.3%");
    expect(formatPercent(null)).toBe("No data");
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(8 * 1024 ** 3)).toBe("8.0 GB");
    expect(formatDuration(59)).toBe("0 min");
    expect(formatDuration(3 * 3600 + 120)).toBe("3 h 2 min");
    expect(formatDuration(2 * 86400 + 3600)).toBe("2 d 1 h");
  });
});

describe("demo fixtures", () => {
  it("are deterministic and quantised to the interval", () => {
    expect(demoSnapshot(1_000_000)).toEqual(demoSnapshot(1_000_000));
    const a = demoSnapshot(1_000_000);
    const b = demoSnapshot(1_000_000 + DEMO_INTERVAL_MS - 1);
    expect(a.takenAt).toBe(b.takenAt);
    expect(a.source).toBe("demo");
    expect(a.services).toHaveLength(TRACKED_SERVICES.length);
  });

  it("stay inside sensible bounds and include a stopped and a missing unit", () => {
    for (let i = 0; i < 500; i += 1) {
      const m = demoSnapshot(i * 97_000).metrics;
      expect(m.cpuPct).toBeGreaterThanOrEqual(0);
      expect(m.cpuPct).toBeLessThanOrEqual(100);
      expect(m.memPct).toBeLessThanOrEqual(100);
      expect(m.diskReadBps).toBeGreaterThanOrEqual(0);
    }
    const states = demoSnapshot(0).services.map((s) => s.state);
    expect(states).toContain("inactive");
    expect(states).toContain("absent");
  });

  it("give a range with the number of points its step implies", () => {
    for (const range of Object.keys(RANGES) as (keyof typeof RANGES)[]) {
      for (const id of RANGE_QUERY_IDS) {
        const pts = demoRange(id, range, 10_000_000_000);
        const { seconds, stepSeconds } = RANGES[range];
        expect(pts).toHaveLength(seconds / stepSeconds + 1);
        expect(pts.every((p) => Number.isFinite(p.v))).toBe(true);
      }
    }
  });
});

describe("the particle model (CMD-05)", () => {
  const inputs = (health: Health) =>
    TRACKED_SERVICES.map((s) => ({ id: s.id, name: s.name, health }));

  it("has one cluster per tracked service and a fixed number of particles each", () => {
    const f = new ClusterField(10);
    f.setClusters(inputs("ok"));
    f.resize(900, 400);
    expect(f.clusters).toHaveLength(TRACKED_SERVICES.length);
    expect(f.particleCount).toBe(10 * TRACKED_SERVICES.length);
  });

  it("is agitated when failing, calm when healthy, and nearly still when stale", () => {
    expect(BEHAVIOUR.bad.jitter).toBeGreaterThan(BEHAVIOUR.warn.jitter);
    expect(BEHAVIOUR.warn.jitter).toBeGreaterThan(BEHAVIOUR.ok.jitter);
    expect(BEHAVIOUR.bad.spin).toBeGreaterThan(BEHAVIOUR.ok.spin);
    expect(BEHAVIOUR.stale.spin).toBeLessThan(BEHAVIOUR.ok.spin);
    expect(BEHAVIOUR.stale.jitter).toBe(0);
    // Stale is drawn hollow, so it never relies on colour alone.
    expect(BEHAVIOUR.stale.hollow).toBe(true);
    expect(BEHAVIOUR.ok.hollow).toBe(false);
  });

  it("moves failing clusters more than healthy ones over the same time", () => {
    const travelled = (health: Health) => {
      const f = new ClusterField(20, 7);
      f.setClusters(inputs(health));
      f.resize(900, 400);
      const start = f.particles.map((p) => ({ x: p.x, y: p.y }));
      for (let i = 0; i < 120; i += 1) f.step(1 / 60);
      return f.particles.reduce(
        (sum, p, i) => sum + Math.hypot(p.x - start[i]!.x, p.y - start[i]!.y),
        0,
      );
    };
    expect(travelled("bad")).toBeGreaterThan(travelled("ok"));
    expect(travelled("ok")).toBeGreaterThan(travelled("stale"));
  });

  it("pushes particles away from the pointer, gently, and not far away ones", () => {
    const f = new ClusterField(30, 3);
    f.setClusters(inputs("stale"));
    f.resize(900, 400);
    const c = f.clusters[0]!.centre;
    const dist = (p: { x: number; y: number }) =>
      Math.hypot(p.x - c.x, p.y - c.y);
    const mine = f.particles.filter((p) => p.cluster === 0);
    const before = mine.map(dist);
    f.setPointer({ x: c.x, y: c.y });
    for (let i = 0; i < 30; i += 1) f.step(1 / 60);
    const after = mine.map(dist);
    expect(after.reduce((a, b) => a + b, 0)).toBeGreaterThan(
      before.reduce((a, b) => a + b, 0),
    );
    // The last cluster is far from the pointer and did not move.
    const lastIndex = f.clusters.length - 1;
    expect(
      Math.hypot(
        f.clusters[lastIndex]!.centre.x - c.x,
        f.clusters[lastIndex]!.centre.y - c.y,
      ),
    ).toBeGreaterThan(POINTER_RADIUS + f.clusters[lastIndex]!.radius);
  });

  it("changes health without rebuilding or moving the particles", () => {
    const f = new ClusterField(5);
    f.setClusters(inputs("ok"));
    f.resize(900, 400);
    const before = f.particles;
    f.setClusters(inputs("bad"));
    expect(f.particles).toBe(before);
    expect(f.clusters.every((c) => c.health === "bad")).toBe(true);
  });

  it("draws the same first frame for the same seed", () => {
    const make = () => {
      const f = new ClusterField(8, 42);
      f.setClusters(inputs("ok"));
      f.resize(800, 400);
      return f.particles.map((p) => [p.x, p.y]);
    };
    expect(make()).toEqual(make());
    expect(rng(1)()).toBe(rng(1)());
  });

  it("lays clusters inside the canvas", () => {
    for (const [w, h] of [
      [390, 360],
      [1440, 360],
      [3840, 600],
    ] as const) {
      const { centres, radius } = layoutClusters(TRACKED_SERVICES.length, w, h);
      expect(centres).toHaveLength(TRACKED_SERVICES.length);
      for (const c of centres) {
        expect(c.x - radius).toBeGreaterThanOrEqual(0);
        expect(c.x + radius).toBeLessThanOrEqual(w);
        expect(c.y - radius).toBeGreaterThanOrEqual(0);
        expect(c.y + radius).toBeLessThanOrEqual(h);
      }
    }
    expect(layoutClusters(0, 100, 100).centres).toEqual([]);
  });
});

describe("chart geometry", () => {
  it("picks round axis maxima", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(0.34)).toBe(1);
    expect(niceMax(1.2)).toBe(2);
    expect(niceMax(2.3)).toBe(2.5);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(420_000)).toBe(500_000);
  });

  it("maps the data range onto the plot area, higher values higher up", () => {
    const s = makeScale(CHART_BOX, 0, 100, 10);
    expect(s.x(0)).toBe(CHART_BOX.left);
    expect(s.x(100)).toBe(CHART_BOX.width - CHART_BOX.right);
    expect(s.y(0)).toBe(CHART_BOX.height - CHART_BOX.bottom);
    expect(s.y(10)).toBe(CHART_BOX.top);
    expect(s.y(5)).toBeGreaterThan(s.y(8));
    // Out of range values are clamped, never drawn outside the plot.
    expect(s.y(99)).toBe(CHART_BOX.top);
    expect(s.y(-5)).toBe(CHART_BOX.height - CHART_BOX.bottom);
  });

  it("builds a path from two points and none from fewer", () => {
    const s = makeScale(CHART_BOX, 0, 10, 10);
    expect(linePath([], s)).toBe("");
    expect(linePath([{ t: 0, v: 1 }], s)).toBe("");
    expect(
      linePath(
        [
          { t: 0, v: 1 },
          { t: 10, v: 2 },
        ],
        s,
      ),
    ).toMatch(/^M[\d.]+ [\d.]+ L[\d.]+ [\d.]+$/);
  });

  it("samples evenly and keeps both ends", () => {
    const items = Array.from({ length: 100 }, (_, i) => i);
    const out = sample(items, 12);
    expect(out).toHaveLength(12);
    expect(out[0]).toBe(0);
    expect(out.at(-1)).toBe(99);
    expect(sample([1, 2, 3], 12)).toEqual([1, 2, 3]);
  });
});
