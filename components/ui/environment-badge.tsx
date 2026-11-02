import type { NexusMode } from "@/lib/server/mode";

/**
 * States the platform mode on every page (Requirement 3.7). Demo mode runs on
 * fixtures with no server calls; Live mode talks to Nexus Core 01. A dot plus
 * text, so the state never relies on colour alone.
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
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium whitespace-nowrap ${
        demo
          ? "border-pink-ink/40 bg-pink-ink/10 text-pink-ink"
          : "border-accent-ink/40 bg-accent-ink/10 text-accent-ink"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 8 8"
        className="size-2 shrink-0 fill-current"
      >
        <circle cx="4" cy="4" r="4" />
      </svg>
      {demo ? "Demo mode" : "Live mode"}
    </span>
  );
}
