import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FRAME_WINDOW,
  FrameSampler,
  PARTICLE_COUNT,
  RESUME_DEADLINE_MS,
  SLOW_FRAME_MS,
  averageFrameMs,
  baselineTier,
  lowerTier,
  observeVisibility,
} from "@/lib/motion/quality";

describe("baselineTier", () => {
  it("stays high on a normal display with enough memory", () => {
    expect(baselineTier({ devicePixelRatio: 1 })).toBe("high");
    expect(baselineTier({ devicePixelRatio: 2, deviceMemory: 8 })).toBe("high");
    expect(baselineTier({ devicePixelRatio: 2, deviceMemory: 4 })).toBe("high");
  });

  it("drops one tier when the device pixel ratio is above 2", () => {
    expect(baselineTier({ devicePixelRatio: 2.01 })).toBe("medium");
    expect(baselineTier({ devicePixelRatio: 3, deviceMemory: 8 })).toBe(
      "medium",
    );
  });

  it("drops one tier when device memory is below 4 GB", () => {
    expect(baselineTier({ devicePixelRatio: 1, deviceMemory: 2 })).toBe(
      "medium",
    );
    expect(baselineTier({ devicePixelRatio: 1, deviceMemory: 0.5 })).toBe(
      "medium",
    );
  });

  it("drops two tiers when both limits apply, and never below low", () => {
    expect(baselineTier({ devicePixelRatio: 3, deviceMemory: 2 })).toBe("low");
  });

  it("does not penalise browsers that do not report device memory", () => {
    expect(baselineTier({ devicePixelRatio: 1, deviceMemory: undefined })).toBe(
      "high",
    );
  });
});

describe("lowerTier", () => {
  it("steps down and stops at low", () => {
    expect(lowerTier("high")).toBe("medium");
    expect(lowerTier("medium")).toBe("low");
    expect(lowerTier("low")).toBe("low");
    expect(lowerTier("high", 5)).toBe("low");
  });

  it("scales particle counts down with the tier", () => {
    expect(PARTICLE_COUNT.high).toBeGreaterThan(PARTICLE_COUNT.medium);
    expect(PARTICLE_COUNT.medium).toBeGreaterThan(PARTICLE_COUNT.low);
    expect(PARTICLE_COUNT.low).toBeGreaterThan(0);
  });
});

describe("frame-time sampling", () => {
  it("uses a 60-frame window and a 20 ms threshold", () => {
    expect(FRAME_WINDOW).toBe(60);
    expect(SLOW_FRAME_MS).toBe(20);
  });

  it("averages the deltas", () => {
    expect(averageFrameMs([10, 20, 30])).toBe(20);
    expect(averageFrameMs([])).toBe(0);
  });

  it("is not ready until 60 frames have been sampled", () => {
    const s = new FrameSampler();
    for (let i = 0; i < FRAME_WINDOW - 1; i++) s.push(40);
    expect(s.isFull).toBe(false);
    expect(s.shouldLowerTier()).toBe(false);
    s.push(40);
    expect(s.isFull).toBe(true);
    expect(s.shouldLowerTier()).toBe(true);
  });

  it("lowers the tier only when the average is above 20 ms", () => {
    const exactly = new FrameSampler();
    for (let i = 0; i < FRAME_WINDOW; i++) exactly.push(20);
    expect(exactly.average()).toBe(20);
    expect(exactly.shouldLowerTier()).toBe(false);

    const slow = new FrameSampler();
    for (let i = 0; i < FRAME_WINDOW; i++) slow.push(20.5);
    expect(slow.shouldLowerTier()).toBe(true);
  });

  it("slides the window: old slow frames stop counting", () => {
    const s = new FrameSampler();
    for (let i = 0; i < FRAME_WINDOW; i++) s.push(50);
    expect(s.shouldLowerTier()).toBe(true);
    for (let i = 0; i < FRAME_WINDOW; i++) s.push(16);
    expect(s.average()).toBe(16);
    expect(s.shouldLowerTier()).toBe(false);
  });

  it("reset clears the window", () => {
    const s = new FrameSampler();
    for (let i = 0; i < FRAME_WINDOW; i++) s.push(50);
    s.reset();
    expect(s.isFull).toBe(false);
    expect(s.average()).toBe(0);
  });
});

describe("observeVisibility", () => {
  let state: DocumentVisibilityState = "visible";

  function setVisibility(next: DocumentVisibilityState) {
    state = next;
    document.dispatchEvent(new Event("visibilitychange"));
  }

  afterEach(() => {
    state = "visible";
  });

  function install() {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
  }

  it("pauses when the tab is hidden and resumes when it is visible again", () => {
    install();
    const onChange = vi.fn();
    const stop = observeVisibility(document, onChange);

    setVisibility("hidden");
    expect(onChange).toHaveBeenLastCalledWith(false);

    setVisibility("visible");
    expect(onChange).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenCalledTimes(2);
    stop();
  });

  it("resumes well inside the 500 ms deadline", () => {
    vi.useFakeTimers();
    try {
      install();
      const resumedAt: number[] = [];
      const stop = observeVisibility(document, (visible) => {
        if (visible) resumedAt.push(Date.now());
      });
      setVisibility("hidden");
      vi.advanceTimersByTime(60_000);
      const shown = Date.now();
      setVisibility("visible");
      expect(RESUME_DEADLINE_MS).toBe(500);
      expect(resumedAt).toHaveLength(1);
      expect(resumedAt[0]! - shown).toBeLessThan(RESUME_DEADLINE_MS);
      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("stops listening after unsubscribe", () => {
    install();
    const onChange = vi.fn();
    const stop = observeVisibility(document, onChange);
    stop();
    setVisibility("hidden");
    expect(onChange).not.toHaveBeenCalled();
  });
});
