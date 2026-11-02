type Status = "ok" | "warn" | "bad";

const config: Record<
  Status,
  { label: string; colour: string; icon: React.ReactNode }
> = {
  ok: {
    label: "Healthy",
    colour: "text-ok-ink",
    icon: <path d="m3.5 8.5 3 3 6-7" />,
  },
  warn: {
    label: "Degraded",
    colour: "text-warn-ink",
    icon: <path d="M8 3 14 13H2L8 3Zm0 4v3m0 1.5v.01" />,
  },
  bad: {
    label: "Down",
    colour: "text-bad-ink",
    icon: <path d="m4 4 8 8M12 4l-8 8" />,
  },
};

/**
 * Status is never conveyed by colour alone: every state has its own icon shape
 * and a text label. The icon is decorative, so it is hidden from assistive tech.
 */
export function StatusBadge({
  status,
  label,
}: {
  status: Status;
  label?: string;
}) {
  const c = config[status];
  return (
    <span
      className={`border-line bg-surface inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium ${c.colour}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-4 fill-none stroke-current stroke-2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {c.icon}
      </svg>
      {label ?? c.label}
    </span>
  );
}
