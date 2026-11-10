import type { SeriesPoint } from "./snapshot.ts";

// Geometry for the range charts on /command/metrics. Pure functions: the
// component only draws what these return, and the tests check the numbers.

export type Box = {
  width: number;
  height: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export const CHART_BOX: Box = {
  width: 640,
  height: 220,
  left: 56,
  right: 12,
  top: 12,
  bottom: 28,
};

/** A round upper bound for the y axis: 1, 2, 2.5, 5 or 10 times a power of ten. */
export function niceMax(value: number, floor = 1): number {
  const v = Math.max(value, floor);
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  for (const m of [1, 2, 2.5, 5, 10]) {
    if (m * base >= v) return m * base;
  }
  return 10 * base;
}

export function seriesMax(series: readonly (readonly SeriesPoint[])[]): number {
  let max = 0;
  for (const s of series) for (const p of s) if (p.v > max) max = p.v;
  return max;
}

export type Scale = {
  x(t: number): number;
  y(v: number): number;
};

export function makeScale(
  box: Box,
  tMin: number,
  tMax: number,
  yMax: number,
): Scale {
  const w = box.width - box.left - box.right;
  const h = box.height - box.top - box.bottom;
  const span = Math.max(1, tMax - tMin);
  return {
    x: (t) => box.left + ((t - tMin) / span) * w,
    y: (v) => box.top + h - (Math.min(Math.max(v, 0), yMax) / yMax) * h,
  };
}

/** SVG path data for a series. Empty for fewer than two points. */
export function linePath(points: readonly SeriesPoint[], scale: Scale): string {
  if (points.length < 2) return "";
  return points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${scale.x(p.t).toFixed(1)} ${scale.y(p.v).toFixed(1)}`,
    )
    .join(" ");
}

/** At most `n` evenly spaced points, always keeping the first and the last. */
export function sample<T>(items: readonly T[], n: number): T[] {
  if (items.length <= n || n < 2) return [...items];
  const out: T[] = [];
  for (let i = 0; i < n; i += 1) {
    out.push(items[Math.round((i * (items.length - 1)) / (n - 1))] as T);
  }
  return out;
}
