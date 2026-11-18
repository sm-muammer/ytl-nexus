import type { QualityTier } from "@/lib/motion/quality";

/** Particle counts for the home 3D WebGL Yes logomark by quality tier (spec 24). */
export const PARTICLE_LOGO_COUNTS: Record<QualityTier, number> = {
  high: 140_000,
  medium: 70_000,
  low: 30_000,
};

/** Maximum device pixel ratio used by the WebGL particle renderer (spec 24). */
export const MAX_PARTICLE_DPR = 2;

/** Returns the target particle count for a quality tier. */
export function particleCountForTier(tier: QualityTier): number {
  return PARTICLE_LOGO_COUNTS[tier];
}

/** Clamps device pixel ratio to [1, MAX_PARTICLE_DPR], falling back to 1 on invalid inputs. */
export function clampParticleDpr(dpr: number): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 1;
  return Math.min(MAX_PARTICLE_DPR, Math.max(1, dpr));
}
