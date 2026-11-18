import { describe, expect, it } from "vitest";
import {
  IDLE_RESUME_DELAY_SEC,
  INTRO_DURATION_SEC,
  POINTER_REPULSE_RADIUS,
  SCATTERED_OPACITY,
  blendIntroAndScrollMorph,
  easeInOutCubic,
  idleResumeWeight,
  introElapsedSec,
  scrollProgress,
  scrollState,
} from "@/lib/motion/particle-logo/scroll";

describe("particle logo scroll mapping", () => {
  it("computes progress = scrollY / (0.9 * viewportHeight) clamped to [0, 1]", () => {
    expect(scrollProgress(0, 1000)).toBe(0);
    expect(scrollProgress(-120, 1000)).toBe(0);
    expect(scrollProgress(450, 1000)).toBeCloseTo(0.5, 6);
    expect(scrollProgress(900, 1000)).toBe(1);
    expect(scrollProgress(2500, 1000)).toBe(1);
    expect(scrollProgress(300, 0)).toBe(0);
    expect(scrollProgress(Number.NaN, 900)).toBe(0);
  });

  it("applies symmetric ease-in-out cubic curve clamped to [0, 1]", () => {
    expect(easeInOutCubic(-0.2)).toBe(0);
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(0.25)).toBeCloseTo(0.0625, 6);
    expect(easeInOutCubic(0.5)).toBeCloseTo(0.5, 6);
    expect(easeInOutCubic(0.75)).toBeCloseTo(0.9375, 6);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(1.4)).toBe(1);
  });

  it("derives formed hero state at top and 40%-opacity scattered field past 0.9 * vh", () => {
    expect(SCATTERED_OPACITY).toBeCloseTo(0.4, 6);

    const top = scrollState(0, 1000);
    expect(top.progress).toBe(0);
    expect(top.morph).toBe(0);
    expect(top.opacity).toBe(1);
    expect(top.groupZ).toBe(0);
    expect(top.cameraDollyZ).toBe(0);
    expect(top.inHero).toBe(true);

    const mid = scrollState(450, 1000);
    expect(mid.progress).toBeCloseTo(0.5, 6);
    expect(mid.morph).toBeCloseTo(0.5, 6);
    expect(mid.opacity).toBeCloseTo(0.7, 6);
    expect(mid.groupZ).toBeLessThan(0);
    expect(mid.cameraDollyZ).toBeGreaterThan(0);
    expect(mid.inHero).toBe(true);

    const past = scrollState(900, 1000);
    expect(past.progress).toBe(1);
    expect(past.morph).toBe(1);
    expect(past.opacity).toBeCloseTo(0.4, 6);
    expect(past.inHero).toBe(false);
  });

  it("converges intro morph from 1 to scrollMorph over 1.8 s", () => {
    expect(INTRO_DURATION_SEC).toBeCloseTo(1.8, 6);
    expect(blendIntroAndScrollMorph(0, 0)).toBe(1);
    expect(blendIntroAndScrollMorph(0, 0.5)).toBe(1);
    expect(blendIntroAndScrollMorph(0.9, 0)).toBeCloseTo(0.5, 6);
    expect(blendIntroAndScrollMorph(1.8, 0)).toBe(0);
    expect(blendIntroAndScrollMorph(3.0, 0)).toBe(0);
    expect(blendIntroAndScrollMorph(1.8, 0.7)).toBeCloseTo(0.7, 6);
  });

  it("waits 1.5 s after interaction before easing idle motion back in", () => {
    expect(IDLE_RESUME_DELAY_SEC).toBeCloseTo(1.5, 6);
    expect(idleResumeWeight(0)).toBe(0);
    expect(idleResumeWeight(1.49)).toBe(0);
    expect(idleResumeWeight(2.0)).toBeGreaterThan(0);
    expect(idleResumeWeight(2.0)).toBeLessThan(1);
    expect(idleResumeWeight(3.0)).toBe(1);
  });

  it("computes intro elapsed from wall-clock milliseconds and uses gentler 0.32 pointer radius", () => {
    expect(POINTER_REPULSE_RADIUS).toBeCloseTo(0.32, 6);
    expect(introElapsedSec(1000, 1000)).toBe(0);
    expect(introElapsedSec(2800, 1000)).toBeCloseTo(1.8, 6);
    expect(introElapsedSec(900, 1000)).toBe(0);
    expect(blendIntroAndScrollMorph(introElapsedSec(2800, 1000), 0)).toBe(0);
  });
});
