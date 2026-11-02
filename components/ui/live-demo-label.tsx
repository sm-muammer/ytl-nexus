import type { DataSource } from "@/lib/server/adapters/types";

/**
 * Marks where a displayed value comes from (Requirement 1.10). Demo values
 * read "Demo data" (or "Demo" where space is tight); real values read "Live".
 * The dot differs in shape too, so the label never relies on colour alone.
 */
export function LiveDemoLabel({
  source,
  short = false,
}: {
  source: DataSource;
  short?: boolean;
}) {
  const demo = source === "demo";
  return (
    <span
      data-live-demo
      data-source={source}
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        demo ? "text-pink-ink" : "text-accent-ink"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 8 8"
        className="size-2 shrink-0 fill-current"
      >
        {demo ? (
          <rect x="1" y="1" width="6" height="6" rx="1" />
        ) : (
          <circle cx="4" cy="4" r="3.5" />
        )}
      </svg>
      {demo ? (short ? "Demo" : "Demo data") : "Live"}
    </span>
  );
}
