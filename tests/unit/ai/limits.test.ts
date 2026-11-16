import { describe, expect, it } from "vitest";
import {
  checkAiLimits,
  checkConcurrentSlots,
  acquireSlot,
  releaseSlot,
  AI_LIMITS,
} from "@/lib/ai/limits";

describe("checkAiLimits", () => {
  it("enforces maximum prompt character length", () => {
    const valid = "Hello, can you help me understand Nexus Atlas?";
    expect(checkAiLimits({ prompt: valid, ip: "127.0.0.1" })).toEqual({
      ok: true,
    });

    const tooLong = "a".repeat(AI_LIMITS.MAX_PROMPT_CHARS + 1);
    expect(checkAiLimits({ prompt: tooLong, ip: "127.0.0.1" })).toEqual({
      ok: false,
      error: "prompt-too-long",
    });
  });

  it("enforces per-user / per-IP rate limiting", () => {
    const ip = "192.168.10.20";
    // Send allowed number of requests
    for (let i = 0; i < AI_LIMITS.RATE_LIMIT_PER_WINDOW; i++) {
      const res = checkAiLimits({ prompt: "test", ip });
      expect(res.ok).toBe(true);
    }

    // Next request should hit rate limit
    const exceeded = checkAiLimits({ prompt: "test", ip });
    expect(exceeded).toEqual({ ok: false, error: "rate-limited" });
  });
});

describe("Concurrency slot management", () => {
  it("bounds global concurrent generations on the CPU", () => {
    // Acquire all available slots
    const slots: number[] = [];
    for (let i = 0; i < AI_LIMITS.MAX_CONCURRENT_GENERATIONS; i++) {
      const slot = acquireSlot();
      expect(slot).toBe(true);
      slots.push(i);
    }

    // Attempting another generation should be blocked
    expect(acquireSlot()).toBe(false);
    expect(checkConcurrentSlots()).toBe(false);

    // Release one slot
    releaseSlot();
    expect(checkConcurrentSlots()).toBe(true);
    expect(acquireSlot()).toBe(true);

    // Clean up
    for (let i = 0; i < AI_LIMITS.MAX_CONCURRENT_GENERATIONS; i++) {
      releaseSlot();
    }
  });
});
