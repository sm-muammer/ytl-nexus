const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** Binary units, one decimal from KB up. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return unit === 0
    ? `${Math.round(value)} B`
    : `${value.toFixed(1)} ${UNITS[unit]}`;
}

/** Whole percent of the quota in use, 0 to 100, or null when there is no limit. */
export function usagePercent(used: number, quota: number): number | null {
  if (quota <= 0) return null;
  return Math.min(100, Math.max(0, Math.round((used / quota) * 100)));
}
