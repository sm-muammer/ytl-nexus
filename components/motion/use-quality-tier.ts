"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import {
  FrameSampler,
  baselineTier,
  lowerTier,
  type QualityTier,
} from "@/lib/motion/quality";

type MemoryNavigator = Navigator & { deviceMemory?: number };

function subscribe() {
  // Device pixel ratio and memory do not change during a page visit that a
  // particle field cares about, so there is nothing to listen to.
  return () => {};
}

function readBaseline(): QualityTier {
  return baselineTier({
    devicePixelRatio: window.devicePixelRatio,
    deviceMemory: (navigator as MemoryNavigator).deviceMemory,
  });
}

/**
 * Current particle quality tier (Requirement 3.12). It starts from the device
 * (pixel ratio above 2 and memory below 4 GB each lower it one step). The
 * renderer reports every frame time; when 60 frames average above 20 ms the
 * tier drops one more step. It never rises again within a visit, so a weak
 * device does not flicker between tiers.
 */
export function useQualityTier(): {
  tier: QualityTier;
  reportFrame: (deltaMs: number) => void;
} {
  const baseline = useSyncExternalStore(
    subscribe,
    readBaseline,
    (): QualityTier => "high",
  );
  const [drops, setDrops] = useState(0);
  const samplerRef = useRef<FrameSampler | null>(null);

  const reportFrame = useCallback((deltaMs: number) => {
    const sampler = (samplerRef.current ??= new FrameSampler());
    sampler.push(deltaMs);
    if (sampler.shouldLowerTier()) {
      sampler.reset();
      setDrops((d) => d + 1);
    }
  }, []);

  return { tier: lowerTier(baseline, drops), reportFrame };
}
