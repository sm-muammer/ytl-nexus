import type { NexusMode } from "@/lib/server/mode";

/**
 * States the platform mode on every page (Requirement 3.7). Demo mode runs on
 * fixtures with no server calls; Live mode talks to Nexus Core 01.
 */
export function EnvironmentBadge({ mode }: { mode: NexusMode }) {
  const demo = mode === "demo";
  return (
    <span
      data-env-badge
      data-mode={mode}
      title={
        demo
          ? "Every value on this site is sample data from fixtures."
          : "Values come from Nexus Core 01."
      }
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs tracking-wide uppercase ${
        demo
          ? "border-pink-ink text-pink-ink"
          : "border-accent-ink text-accent-ink"
      }`}
    >
      {demo ? "Demo mode" : "Live mode"}
    </span>
  );
}
