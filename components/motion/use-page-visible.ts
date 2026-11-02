"use client";

import { useSyncExternalStore } from "react";
import { observeVisibility } from "@/lib/motion/quality";

function subscribe(onChange: () => void) {
  return observeVisibility(document, onChange);
}

/** False while the tab is hidden. Rendering loops stop and resume with it. */
export function usePageVisible(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}
