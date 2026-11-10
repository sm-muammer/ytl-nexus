// Deterministic demo telemetry for Nexus Command (DEMO-02). The same time
// always produces the same reading, so tests and screenshots are stable. No
// randomness, no clock reads: callers pass the time.

import {
  RANGES,
  type RangeId,
  type RangeQueryId,
} from "@/lib/monitoring/queries";
import { TRACKED_SERVICES } from "@/lib/monitoring/services";
import type {
  HostInfo,
  Metrics,
  SeriesPoint,
  Snapshot,
  UnitState,
} from "@/lib/monitoring/snapshot";

export const DEMO_INTERVAL_MS = 5000;

const wave = (t: number, period: number, phase = 0) =>
  Math.sin((2 * Math.PI * (t + phase)) / period);

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

/** Value of one series at second `t`. */
export function demoSeries(id: RangeQueryId, t: number): number {
  switch (id) {
    case "cpu_used_pct":
      return clamp(14 + 9 * wave(t, 900) + 4 * wave(t, 97, 11), 1, 99);
    case "mem_used_pct":
      return clamp(46 + 3 * wave(t, 3600) + 0.8 * wave(t, 211), 1, 99);
    case "load1":
      return clamp(0.35 + 0.25 * wave(t, 700) + 0.1 * wave(t, 61), 0, 8);
    case "disk_used_pct":
      return 38.4 + 0.2 * wave(t, 86400 * 3);
    case "disk_read_bps":
      return clamp(180_000 + 150_000 * wave(t, 420, 5), 0, 5e8);
    case "disk_write_bps":
      return clamp(420_000 + 300_000 * wave(t, 300, 40), 0, 5e8);
    case "net_rx_bps":
      return clamp(
        90_000 + 70_000 * wave(t, 240) + 20_000 * wave(t, 37),
        0,
        5e8,
      );
    case "net_tx_bps":
      return clamp(60_000 + 50_000 * wave(t, 360, 90), 0, 5e8);
  }
}

const round = (v: number, digits = 2) => Number(v.toFixed(digits));

const DEMO_BOOT_MS = Date.UTC(2026, 9, 28, 6, 0, 0);

/** Fixed states: the sample server has one stopped and one missing unit. */
const DEMO_STATES: Record<string, UnitState> = {
  dovecot: "inactive",
  sftpgo: "absent",
};

export function demoSnapshot(takenAt: number): Snapshot {
  // Quantised to the interval, so two readers in the same interval agree.
  const bucket = Math.floor(takenAt / DEMO_INTERVAL_MS) * DEMO_INTERVAL_MS;
  const t = bucket / 1000;
  const metrics: Metrics = {
    cpuPct: round(demoSeries("cpu_used_pct", t)),
    load1: round(demoSeries("load1", t)),
    load5: round(demoSeries("load1", t - 120) * 0.9),
    load15: round(demoSeries("load1", t - 600) * 0.8),
    memPct: round(demoSeries("mem_used_pct", t)),
    swapPct: 0.4,
    diskPct: round(demoSeries("disk_used_pct", t)),
    diskReadBps: Math.round(demoSeries("disk_read_bps", t)),
    diskWriteBps: Math.round(demoSeries("disk_write_bps", t)),
    netRxBps: Math.round(demoSeries("net_rx_bps", t)),
    netTxBps: Math.round(demoSeries("net_tx_bps", t)),
    uptimeSeconds: Math.max(0, Math.floor((bucket - DEMO_BOOT_MS) / 1000)),
  };
  return {
    source: "demo",
    takenAt: bucket,
    intervalMs: DEMO_INTERVAL_MS,
    reachable: true,
    metrics,
    services: TRACKED_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit,
      state: DEMO_STATES[s.id] ?? "active",
    })),
  };
}

export function demoRange(
  id: RangeQueryId,
  range: RangeId,
  endMs: number,
): SeriesPoint[] {
  const { seconds, stepSeconds } = RANGES[range];
  const end = Math.floor(endMs / 1000 / stepSeconds) * stepSeconds;
  const points: SeriesPoint[] = [];
  for (let t = end - seconds; t <= end; t += stepSeconds) {
    points.push({ t: t * 1000, v: Number(demoSeries(id, t).toFixed(3)) });
  }
  return points;
}

export const DEMO_HOST: HostInfo = {
  os: "Rocky Linux 9 (sample)",
  kernel: "5.14 (sample)",
  arch: "x86_64",
  cores: 8,
  memTotalBytes: 16 * 1024 ** 3,
  diskTotalBytes: 44 * 1024 ** 3,
};
