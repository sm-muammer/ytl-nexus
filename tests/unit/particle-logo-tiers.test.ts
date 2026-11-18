import { describe, expect, it } from "vitest";
import {
  MAX_PARTICLE_DPR,
  PARTICLE_LOGO_COUNTS,
  clampParticleDpr,
  particleCountForTier,
} from "@/lib/motion/particle-logo/tiers";

describe("particle logo tier counts", () => {
  it("maps quality tiers to exact particle budgets from spec 24", () => {
    expect(PARTICLE_LOGO_COUNTS).toEqual({
      high: 140_000,
      medium: 70_000,
      low: 30_000,
    });
    expect(particleCountForTier("high")).toBe(140_000);
    expect(particleCountForTier("medium")).toBe(70_000);
    expect(particleCountForTier("low")).toBe(30_000);
  });

  it("caps device pixel ratio at 2 and prevents non-positive values", () => {
    expect(MAX_PARTICLE_DPR).toBe(2);
    expect(clampParticleDpr(1)).toBe(1);
    expect(clampParticleDpr(1.5)).toBe(1.5);
    expect(clampParticleDpr(2)).toBe(2);
    expect(clampParticleDpr(3)).toBe(2);
    expect(clampParticleDpr(0)).toBe(1);
    expect(clampParticleDpr(-2)).toBe(1);
    expect(clampParticleDpr(Number.NaN)).toBe(1);
  });
});
