"use client";

import * as m from "motion/react-m";
import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * The signal ribbon: one gradient line that sweeps across the top of the
 * viewport on every route change and links the modules visually. It is
 * decorative and hidden from assistive technology. It does not play on the
 * first load. Under reduced motion the MotionProvider removes the scale, so it
 * becomes a brief opacity pulse. It uses only transform and opacity.
 */
export function SignalRibbon() {
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  const [runs, setRuns] = useState(0);

  // Adjusting state while rendering is React's documented way to respond to a
  // changed value without an effect.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setRuns(runs + 1);
  }

  if (runs === 0) return null;

  return (
    <div
      aria-hidden="true"
      data-signal-ribbon
      data-runs={runs}
      className="pointer-events-none fixed inset-x-0 top-0 z-(--z-toast) h-1 overflow-hidden"
    >
      <m.div
        key={runs}
        className="from-ytl-blue via-yes-pink to-yes-gradient-end h-full origin-left bg-linear-to-r"
        initial={{ scaleX: 0, opacity: 1 }}
        animate={{ scaleX: 1, opacity: [1, 1, 0] }}
        transition={{
          duration: 0.7, // --duration-ribbon
          ease: [0.65, 0, 0.35, 1], // --ease-in-out-cubic
          opacity: { times: [0, 0.65, 1], duration: 0.7 },
        }}
      />
    </div>
  );
}
