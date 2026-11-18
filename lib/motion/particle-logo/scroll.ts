// Pure scroll, intro and idle motion rules for the home 3D particle logomark
// (docs/spec/24-home-showcase.md). No Three.js or DOM globals.

export const INTRO_DURATION_SEC = 1.8;
export const IDLE_RESUME_DELAY_SEC = 1.5;
export const IDLE_RAMP_SEC = 1.0;
export const IDLE_SPIN_RAD_PER_SEC = 0.18;
export const IDLE_WOBBLE_AMPLITUDE = 0.08;
export const IDLE_WOBBLE_PERIOD_SEC = 9;
export const POINTER_TILT_MAX = 0.3;
export const POINTER_REPULSE_RADIUS = 0.45;
export const SCATTERED_OPACITY = 0.4;
export const SCROLL_DISTANCE_FACTOR = 0.9;
export const MAX_GROUP_SCROLL_Z = -1.2;
export const MAX_CAMERA_DOLLY_Z = 1.6;

export type ScrollState = {
  /** Linear scroll progress p = clamp(scrollY / (0.9 * vh), 0, 1). */
  progress: number;
  /** Eased morph factor in [0, 1] (0 = formed mark, 1 = scattered). */
  morph: number;
  /** Canvas particle opacity in [SCATTERED_OPACITY, 1]. */
  opacity: number;
  /** Target group z offset (moves back slightly while dispersing). */
  groupZ: number;
  /** Additional camera dolly z offset as the field opens up. */
  cameraDollyZ: number;
  /** True while the hero is active and canvas pointer events should stay enabled. */
  inHero: boolean;
};

/** Clamps a value to [0, 1]. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Symmetric cubic ease-in-out curve matching --ease-in-out-cubic. */
export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/** Scroll progress p = scrollY / (0.9 * viewportHeight), clamped to [0, 1]. */
export function scrollProgress(
  scrollY: number,
  viewportHeight: number,
): number {
  if (
    !Number.isFinite(scrollY) ||
    !Number.isFinite(viewportHeight) ||
    viewportHeight <= 0
  ) {
    return 0;
  }
  return clamp01(scrollY / (SCROLL_DISTANCE_FACTOR * viewportHeight));
}

/** Full scroll-derived transform, morph and opacity state. */
export function scrollState(
  scrollY: number,
  viewportHeight: number,
): ScrollState {
  const progress = scrollProgress(scrollY, viewportHeight);
  const morph = easeInOutCubic(progress);
  return {
    progress,
    morph,
    opacity: 1 - (1 - SCATTERED_OPACITY) * morph,
    groupZ: MAX_GROUP_SCROLL_Z * morph + 0,
    cameraDollyZ: MAX_CAMERA_DOLLY_Z * morph + 0,
    inHero: progress < 1,
  };
}

/**
 * Blends the 1.8 s load intro (1 -> 0) with the scroll-driven morph target so
 * particles converge cleanly on load and scatter seamlessly if already scrolled.
 */
export function blendIntroAndScrollMorph(
  introElapsedSec: number,
  scrollMorph: number,
): number {
  const t = clamp01(introElapsedSec / INTRO_DURATION_SEC);
  const introRemaining = 1 - easeInOutCubic(t);
  const target = clamp01(scrollMorph);
  return 1 - (1 - introRemaining) * (1 - target);
}

/**
 * Smoothstep weight in [0, 1] for resuming idle rotation/wobble 1.5 s after
 * the last pointer, drag or wheel interaction.
 */
export function idleResumeWeight(secondsSinceInteraction: number): number {
  if (
    !Number.isFinite(secondsSinceInteraction) ||
    secondsSinceInteraction <= IDLE_RESUME_DELAY_SEC
  ) {
    return 0;
  }
  const u = clamp01(
    (secondsSinceInteraction - IDLE_RESUME_DELAY_SEC) / IDLE_RAMP_SEC,
  );
  return u * u * (3 - 2 * u);
}
