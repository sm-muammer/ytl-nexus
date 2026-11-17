import { describe, expect, it } from "vitest";
import { checkRateLimit, clearRateLimits } from "@/lib/server/rate-limit";

describe("rate limiter (Requirement 11, Task 21)", () => {
  it("allows requests under the threshold", () => {
    clearRateLimits();
    const key = "10.24.5.91:test-endpoint";
    const opts = { maxRequests: 5, windowMs: 1000 };

    for (let i = 0; i < 5; i++) {
      const res = checkRateLimit(key, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.remaining).toBe(4 - i);
      }
    }
  });

  it("blocks requests once the threshold is reached", () => {
    clearRateLimits();
    const key = "10.24.5.91:blocked-endpoint";
    const opts = { maxRequests: 3, windowMs: 10_000, now: 1000 };

    expect(checkRateLimit(key, opts).ok).toBe(true);
    expect(checkRateLimit(key, opts).ok).toBe(true);
    expect(checkRateLimit(key, opts).ok).toBe(true);

    const blocked = checkRateLimit(key, opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) {
      expect(blocked.retryAfter).toBeGreaterThan(0);
    }
  });

  it("resets after the window expires", () => {
    clearRateLimits();
    const key = "10.24.5.91:reset-endpoint";
    let now = 1000;
    const opts = { maxRequests: 2, windowMs: 5000, now };

    expect(checkRateLimit(key, { ...opts, now }).ok).toBe(true);
    expect(checkRateLimit(key, { ...opts, now }).ok).toBe(true);
    expect(checkRateLimit(key, { ...opts, now }).ok).toBe(false);

    // Advance time past the 5000ms window
    now = 6500;
    const after = checkRateLimit(key, { ...opts, now });
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.remaining).toBe(1);
    }
  });

  it("isolates different keys independently", () => {
    clearRateLimits();
    const opts = { maxRequests: 1, windowMs: 5000 };
    expect(checkRateLimit("ip-1:endpoint", opts).ok).toBe(true);
    expect(checkRateLimit("ip-1:endpoint", opts).ok).toBe(false);

    // Different IP is not blocked
    expect(checkRateLimit("ip-2:endpoint", opts).ok).toBe(true);
  });
});
