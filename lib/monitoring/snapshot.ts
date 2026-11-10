import { TRACKED_SERVICES } from "./services.ts";

// The shape of one reading of Nexus Core 01, shared by the poller, the SSE
// stream, the demo fixtures and the UI. Pure types and rules, client-safe.
// Nothing here carries a hostname, an address or a path (CMD security rules).

export type DataSource = "live" | "demo";

export type UnitState =
  | "active"
  | "inactive"
  | "failed"
  | "activating"
  | "deactivating"
  /** node_exporter reports no series: the unit is not installed or not loaded. */
  | "absent"
  /** The systemd collector is not reporting, so the state cannot be known. */
  | "unknown";

export type Metrics = {
  cpuPct: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  memPct: number | null;
  swapPct: number | null;
  diskPct: number | null;
  diskReadBps: number | null;
  diskWriteBps: number | null;
  netRxBps: number | null;
  netTxBps: number | null;
  uptimeSeconds: number | null;
};

export type ServiceReading = {
  id: string;
  name: string;
  unit: string;
  state: UnitState;
};

export type Snapshot = {
  source: DataSource;
  /** Milliseconds since the epoch when the readings were taken. */
  takenAt: number;
  /** Poll interval, so a client can tell when readings are stale. */
  intervalMs: number;
  /** False when the last attempt to reach Prometheus failed. */
  reachable: boolean;
  metrics: Metrics;
  services: ServiceReading[];
};

/** One point of a range chart: milliseconds since the epoch and the value. */
export type SeriesPoint = { t: number; v: number };

/** Identity and size of the server for /command/core-01. No hostname or address. */
export type HostInfo = {
  os: string | null;
  kernel: string | null;
  arch: string | null;
  cores: number | null;
  memTotalBytes: number | null;
  diskTotalBytes: number | null;
};

export const EMPTY_METRICS: Metrics = {
  cpuPct: null,
  load1: null,
  load5: null,
  load15: null,
  memPct: null,
  swapPct: null,
  diskPct: null,
  diskReadBps: null,
  diskWriteBps: null,
  netRxBps: null,
  netTxBps: null,
  uptimeSeconds: null,
};

/** A snapshot with no readings, used before the first successful poll. */
export function emptySnapshot(
  source: DataSource,
  now: number,
  intervalMs: number,
): Snapshot {
  return {
    source,
    takenAt: now,
    intervalMs,
    reachable: false,
    metrics: { ...EMPTY_METRICS },
    services: TRACKED_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit,
      state: "unknown",
    })),
  };
}

/** Stale after three missed intervals (CMD-06). */
export const STALE_AFTER_INTERVALS = 3;

export function isStale(snapshot: Snapshot, now: number): boolean {
  return now - snapshot.takenAt > STALE_AFTER_INTERVALS * snapshot.intervalMs;
}

// ---- Health -------------------------------------------------------------

/**
 * How a service looks to the user. "idle" is a unit that exists but is not
 * running, or is not installed yet: neutral, not a fault. "stale" and
 * "unknown" are never shown as healthy (CMD-06).
 */
export type Health = "ok" | "warn" | "bad" | "idle" | "stale";

export function serviceHealth(state: UnitState, stale: boolean): Health {
  if (stale) return "stale";
  switch (state) {
    case "active":
      return "ok";
    case "activating":
    case "deactivating":
      return "warn";
    case "failed":
      return "bad";
    case "inactive":
    case "absent":
      return "idle";
    case "unknown":
      return "stale";
  }
}

export type MetricLevel = "ok" | "warn" | "bad" | "unknown";

/** Percentage thresholds for the key gauges. */
export function percentLevel(
  value: number | null,
  warnAt = 80,
  badAt = 92,
): MetricLevel {
  if (value === null || Number.isNaN(value)) return "unknown";
  if (value >= badAt) return "bad";
  if (value >= warnAt) return "warn";
  return "ok";
}

/** Overall health of the host: the worst of the tracked services and gauges. */
export function overallHealth(snapshot: Snapshot, now: number): Health {
  if (isStale(snapshot, now) || !snapshot.reachable) return "stale";
  const healths = snapshot.services.map((s) => serviceHealth(s.state, false));
  const levels = [
    percentLevel(snapshot.metrics.cpuPct, 90, 98),
    percentLevel(snapshot.metrics.memPct),
    percentLevel(snapshot.metrics.diskPct, 85, 95),
  ];
  if (healths.includes("bad") || levels.includes("bad")) return "bad";
  if (healths.includes("warn") || levels.includes("warn")) return "warn";
  return "ok";
}

// ---- Formatting -----------------------------------------------------------

export function formatPercent(value: number | null): string {
  return value === null ? "No data" : `${value.toFixed(1)}%`;
}

export function formatBytes(value: number | null): string {
  if (value === null) return "No data";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = Math.max(0, value);
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function formatRate(value: number | null): string {
  return value === null ? "No data" : `${formatBytes(value)}/s`;
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return "No data";
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d} d ${h} h`;
  if (h > 0) return `${h} h ${m} min`;
  return `${m} min`;
}

export const HEALTH_LABEL: Record<Health, string> = {
  ok: "Running",
  warn: "Changing",
  bad: "Failed",
  idle: "Not running",
  stale: "No recent data",
};

export const STATE_LABEL: Record<UnitState, string> = {
  active: "Running",
  inactive: "Stopped",
  failed: "Failed",
  activating: "Starting",
  deactivating: "Stopping",
  absent: "Not installed",
  unknown: "Unknown",
};
