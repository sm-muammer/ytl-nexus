// Quality-tier and visibility logic for particle rendering (Requirements
// 3.12 and 3.13). Pure functions and small classes with no React or DOM
// globals, so the rules are unit-tested; components/motion/ wires them up.

export type QualityTier = "high" | "medium" | "low";

const ORDER: readonly QualityTier[] = ["high", "medium", "low"];

/** Particles drawn per tier. */
export const PARTICLE_COUNT: Record<QualityTier, number> = {
  high: 120,
  medium: 60,
  low: 24,
};

/** Frames averaged before the frame-time rule is applied. */
export const FRAME_WINDOW = 60;
/** An average frame time above this many milliseconds lowers the tier. */
export const SLOW_FRAME_MS = 20;
/** Device pixel ratios above this lower the tier. Rendering is also capped here. */
export const MAX_DPR = 2;
/** Device memory (GB) below this lowers the tier. */
export const LOW_MEMORY_GB = 4;
/** Rendering must resume within this many milliseconds of the tab showing. */
export const RESUME_DEADLINE_MS = 500;

export function lowerTier(tier: QualityTier, steps = 1): QualityTier {
  const index = Math.min(ORDER.indexOf(tier) + steps, ORDER.length - 1);
  return ORDER[index]!;
}

/**
 * Starting tier from what the device reports. Each limit that applies lowers
 * the tier one step. `deviceMemory` is missing outside Chromium; a missing
 * value is not treated as low memory.
 */
export function baselineTier(env: {
  devicePixelRatio: number;
  deviceMemory?: number | undefined;
}): QualityTier {
  let steps = 0;
  if (env.devicePixelRatio > MAX_DPR) steps += 1;
  if (env.deviceMemory !== undefined && env.deviceMemory < LOW_MEMORY_GB) {
    steps += 1;
  }
  return lowerTier("high", steps);
}

export function averageFrameMs(deltas: readonly number[]): number {
  if (deltas.length === 0) return 0;
  return deltas.reduce((sum, d) => sum + d, 0) / deltas.length;
}

/** Sliding window of the most recent frame times. */
export class FrameSampler {
  private deltas: number[] = [];

  push(deltaMs: number): void {
    this.deltas.push(deltaMs);
    if (this.deltas.length > FRAME_WINDOW) this.deltas.shift();
  }

  get isFull(): boolean {
    return this.deltas.length >= FRAME_WINDOW;
  }

  average(): number {
    return averageFrameMs(this.deltas);
  }

  /** True once a full window averages above the threshold. */
  shouldLowerTier(): boolean {
    return this.isFull && this.average() > SLOW_FRAME_MS;
  }

  reset(): void {
    this.deltas = [];
  }
}

/**
 * Reports whether the tab is visible: on every change and never later than the
 * event itself, so resuming is well inside RESUME_DEADLINE_MS. Returns an
 * unsubscribe function.
 */
export function observeVisibility(
  doc: Document,
  onChange: (visible: boolean) => void,
): () => void {
  const handler = () => onChange(doc.visibilityState !== "hidden");
  doc.addEventListener("visibilitychange", handler);
  return () => doc.removeEventListener("visibilitychange", handler);
}
