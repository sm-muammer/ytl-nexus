// Health derivation and uptime (STA-02, Property 17). Pure functions, safe for
// the worker, the server data layer, Atlas and tests.

export type CheckState = "healthy" | "degraded" | "down";
export type Health = CheckState | "stale" | "unknown";

export type CheckSample = { state: CheckState; checkedAt: Date | number };

export const STALE_AFTER_MS = 5 * 60_000;

function ms(value: Date | number): number {
  return typeof value === "number" ? value : value.getTime();
}

/**
 * No result gives "unknown". A result older than five minutes gives "stale",
 * so an old "healthy" is never shown as current. Otherwise the latest state.
 */
export function nodeHealth(
  latest: CheckSample | undefined,
  now: Date | number,
): Health {
  if (!latest) return "unknown";
  if (ms(now) - ms(latest.checkedAt) > STALE_AFTER_MS) return "stale";
  return latest.state;
}

export const UPTIME_WINDOWS = [
  { id: "24h", label: "24 hours", ms: 24 * 3_600_000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 3_600_000 },
  { id: "30d", label: "30 days", ms: 30 * 24 * 3_600_000 },
] as const;
export type UptimeWindowId = (typeof UPTIME_WINDOWS)[number]["id"];

/**
 * Healthy checks divided by all checks in the window ending at `now`. Null
 * when the window holds no check, which is "no data", not 0% and not 100%.
 */
export function uptime(
  checks: readonly CheckSample[],
  windowMs: number,
  now: Date | number,
): number | null {
  const end = ms(now);
  const start = end - windowMs;
  let total = 0;
  let healthy = 0;
  for (const c of checks) {
    const t = ms(c.checkedAt);
    if (t < start || t > end) continue;
    total += 1;
    if (c.state === "healthy") healthy += 1;
  }
  return total === 0 ? null : healthy / total;
}

export type UptimeSummary = Record<UptimeWindowId, number | null>;

export function uptimeSummary(
  checks: readonly CheckSample[],
  now: Date | number,
): UptimeSummary {
  return {
    "24h": uptime(checks, UPTIME_WINDOWS[0].ms, now),
    "7d": uptime(checks, UPTIME_WINDOWS[1].ms, now),
    "30d": uptime(checks, UPTIME_WINDOWS[2].ms, now),
  };
}

export function formatUptime(value: number | null): string {
  if (value === null) return "No data";
  if (value >= 1) return "100%";
  // Never round a miss up to a clean 100%.
  return `${Math.min(value * 100, 99.9).toFixed(1)}%`;
}
