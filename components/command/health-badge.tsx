import { HEALTH_LABEL, type Health } from "@/lib/monitoring/snapshot";

const config: Record<Health, { colour: string; icon: React.ReactNode }> = {
  ok: { colour: "text-ok-ink", icon: <path d="m3.5 8.5 3 3 6-7" /> },
  warn: {
    colour: "text-warn-ink",
    icon: <path d="M8 3 14 13H2L8 3Zm0 4v3m0 1.5v.01" />,
  },
  bad: { colour: "text-bad-ink", icon: <path d="m4 4 8 8M12 4l-8 8" /> },
  idle: { colour: "text-muted", icon: <path d="M3.5 8h9" /> },
  stale: {
    colour: "text-muted",
    icon: (
      <path d="M8 3.5v5l3 1.5M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Z" />
    ),
  },
};

/**
 * A service state as icon plus text. Colour is never the only signal: each
 * state has its own shape, and "No recent data" never looks like "Running".
 */
export function HealthBadge({
  health,
  label,
}: {
  health: Health;
  label?: string;
}) {
  const c = config[health];
  return (
    <span
      data-health={health}
      className={`inline-flex items-center gap-2 text-sm font-medium ${c.colour}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-4 shrink-0 fill-none stroke-current stroke-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {c.icon}
      </svg>
      {label ?? HEALTH_LABEL[health]}
    </span>
  );
}
