"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wraps the app once (Requirement 3.10). `reducedMotion="user"` makes every
 * Motion component drop transform and layout animation when the visitor asks
 * for reduced motion, while opacity changes still run. `LazyMotion` loads only
 * the DOM animation features, which keeps first-load JavaScript small.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
