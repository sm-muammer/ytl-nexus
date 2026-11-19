"use client";

import type { Accent } from "@/lib/navigation/modules";
import type { TourChapter, TourVisualPreview } from "@/lib/tour/slides";

const ACCENT_TEXT: Record<Accent, string> = {
  blue: "text-accent-ink",
  pink: "text-pink-ink",
  violet: "text-violet-ink",
};

const ACCENT_BORDER: Record<Accent, string> = {
  blue: "border-accent-ink/35",
  pink: "border-pink-ink/35",
  violet: "border-violet-ink/35",
};

const ACCENT_BG: Record<Accent, string> = {
  blue: "bg-accent-ink",
  pink: "bg-pink-ink",
  violet: "bg-violet-ink",
};

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={className ?? "size-3.5 shrink-0 fill-none stroke-current"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="8" r="6" />
      <path d="m5.5 8 1.75 1.75L10.75 6.25" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={className ?? "size-3.5 shrink-0 fill-none stroke-current"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2 13 4.2v3.6c0 3-2.1 5.2-5 6.2-2.9-1-5-3.2-5-6.2V4.2L8 2Z" />
      <path d="m6 8.2 1.4 1.4L10.2 6.8" />
    </svg>
  );
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={className ?? "size-3.5 shrink-0 fill-none stroke-current"}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 2.5 14 13H2L8 2.5Z" />
      <path d="M8 6.5v3" />
      <circle cx="8" cy="11.2" r="0.5" className="fill-current" />
    </svg>
  );
}

function ArchitecturePreview({
  preview,
  accent,
}: {
  preview: Extract<TourVisualPreview, { kind: "architecture" }>;
  accent: Accent;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {preview.tiers.map((tier, idx) => (
          <div key={tier.tag} className="flex flex-col gap-2">
            <div className="border-line bg-surface-raised/70 rounded-lg border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`font-mono text-xs font-semibold ${ACCENT_TEXT[accent]}`}
                >
                  {tier.tag}
                </span>
              </div>
              <p className="text-ink mt-1 text-sm font-semibold">
                {tier.title}
              </p>
              <p className="text-muted mt-0.5 text-xs leading-relaxed">
                {tier.detail}
              </p>
            </div>
            {idx < preview.tiers.length - 1 ? (
              <div
                aria-hidden="true"
                className="text-muted flex justify-center font-mono text-xs leading-none"
              >
                ↓
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <dl className="border-line grid grid-cols-3 gap-2 border-t pt-3">
        {preview.footerStats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-muted truncate font-mono text-[11px]">
              {stat.label}
            </dt>
            <dd className="text-ink mt-0.5 truncate text-xs font-semibold">
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TelemetryPreview({
  preview,
  accent,
}: {
  preview: Extract<TourVisualPreview, { kind: "telemetry" }>;
  accent: Accent;
}) {
  const values = preview.series.length > 0 ? preview.series : [0];
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.25, 4);
  const min = lo - pad;
  const max = hi + pad;
  const span = Math.max(max - min, 1);
  const width = 240;
  const height = 52;
  const padY = 6;

  const points = preview.series
    .map((val, idx) => {
      const x =
        preview.series.length > 1
          ? (idx / (preview.series.length - 1)) * width
          : width / 2;
      const y = height - padY - ((val - min) / span) * (height - padY * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-2 gap-2.5">
        {preview.metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-line bg-surface-raised/70 rounded-lg border p-3"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-muted font-mono text-[11px]">
                {metric.label}
              </span>
              {metric.status === "ok" ? (
                <span className="text-ok-ink inline-flex items-center gap-1 font-mono text-[11px] font-medium">
                  <CheckIcon className="size-3 shrink-0 fill-none stroke-current" />
                  <span className="sr-only">OK</span>
                </span>
              ) : metric.status === "warn" ? (
                <span className="text-warn-ink inline-flex items-center gap-1 font-mono text-[11px] font-medium">
                  <WarnIcon className="size-3 shrink-0 fill-none stroke-current" />
                  <span className="sr-only">Warning</span>
                </span>
              ) : null}
            </div>
            <p className="font-display text-ink mt-1 text-base font-semibold tabular-nums">
              {metric.value}
            </p>
            <p className="text-muted mt-0.5 text-[11px]">{metric.note}</p>
          </div>
        ))}
      </div>

      <div className="border-line bg-surface-raised/50 rounded-lg border p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-ink text-xs font-medium">
            {preview.seriesLabel}
          </span>
          <span className={`font-mono text-[11px] ${ACCENT_TEXT[accent]}`}>
            Sample curve
          </span>
        </div>
        <svg
          aria-hidden="true"
          viewBox={`0 0 ${width} ${height}`}
          className={`h-13 w-full overflow-visible ${ACCENT_TEXT[accent]}`}
        >
          <polyline
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
        <p className="text-muted mt-1.5 text-[11px]">{preview.caption}</p>
      </div>
    </div>
  );
}

function TopologyPreview({
  preview,
  accent,
}: {
  preview: Extract<TourVisualPreview, { kind: "topology" }>;
  accent: Accent;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={`bg-surface-raised rounded-lg border px-3.5 py-2.5 text-center ${ACCENT_BORDER[accent]}`}
      >
        <span className={`font-mono text-[11px] ${ACCENT_TEXT[accent]}`}>
          Primary Runtime Hub
        </span>
        <p className="text-ink mt-0.5 font-mono text-sm font-semibold">
          {preview.hub}
        </p>
      </div>

      <div
        aria-hidden="true"
        className="text-muted flex justify-center font-mono text-xs leading-none"
      >
        ↓ depends on ↓
      </div>

      <div className="grid grid-cols-2 gap-2">
        {preview.nodes.map((node) => (
          <div
            key={node.id}
            className="border-line bg-surface-raised/70 flex flex-col justify-between gap-1 rounded-lg border p-2.5"
          >
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-ink text-xs font-semibold">
                {node.label}
              </span>
              <span className="border-line bg-surface text-muted rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase">
                {node.group}
              </span>
            </div>
            <span className="text-ok-ink inline-flex items-center gap-1 font-mono text-[11px]">
              <CheckIcon className="size-3 shrink-0 fill-none stroke-current" />
              {node.status}
            </span>
          </div>
        ))}
      </div>

      <p className="text-muted border-line border-t pt-2.5 text-xs">
        {preview.footnote}
      </p>
    </div>
  );
}

function ConversationPreview({
  preview,
  accent,
}: {
  preview: Extract<TourVisualPreview, { kind: "conversation" }>;
  accent: Accent;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="border-line border-b pb-2">
        <p className="text-ink text-xs font-semibold">{preview.header}</p>
      </div>

      <div className="flex flex-col gap-2.5">
        {preview.entries.map((entry) => {
          const isAssistant = entry.tone === "assistant";
          const isTag = entry.tone === "tag";
          return (
            <div
              key={`${entry.label}-${entry.text.slice(0, 16)}`}
              className={`rounded-lg border p-3 ${
                isAssistant
                  ? `bg-surface ${ACCENT_BORDER[accent]}`
                  : isTag
                    ? "border-pink-ink/35 bg-surface-raised/60"
                    : "border-line bg-surface-raised/75"
              }`}
            >
              <span
                className={`font-mono text-[11px] font-semibold ${
                  isAssistant
                    ? ACCENT_TEXT[accent]
                    : isTag
                      ? "text-pink-ink"
                      : "text-muted"
                }`}
              >
                {entry.label}
              </span>
              <p className="text-ink mt-1 text-xs leading-relaxed">
                {entry.text}
              </p>
              {entry.meta ? (
                <p className="text-muted mt-1.5 font-mono text-[11px]">
                  {entry.meta}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 pt-1">
        {preview.chips.map((chip) => (
          <span
            key={chip}
            className="border-line bg-surface-raised text-muted rounded-full border px-2.5 py-0.5 font-mono text-[11px]"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function RecordsPreview({
  preview,
  accent,
}: {
  preview: Extract<TourVisualPreview, { kind: "records" }>;
  accent: Accent;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <div className="border-line overflow-hidden rounded-lg border">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-line bg-surface-raised/80 border-b">
              <th
                scope="col"
                className="text-muted px-3 py-2 font-mono text-[11px] font-medium"
              >
                {preview.columns[0]}
              </th>
              <th
                scope="col"
                className="text-muted px-3 py-2 font-mono text-[11px] font-medium"
              >
                {preview.columns[1]}
              </th>
              <th
                scope="col"
                className="text-muted px-3 py-2 font-mono text-[11px] font-medium"
              >
                {preview.columns[2]}
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {preview.rows.map((row) => (
              <tr key={row.col1} className="bg-surface/60">
                <td className="text-ink px-3 py-2.5 font-mono text-[11px] font-medium tabular-nums">
                  {row.col1}
                </td>
                <td className="text-muted px-3 py-2.5">{row.col2}</td>
                <td className="px-3 py-2.5">
                  {row.state === "ok" ? (
                    <span className="text-ok-ink inline-flex items-center gap-1 font-medium">
                      <CheckIcon className="size-3 shrink-0 fill-none stroke-current" />
                      {row.col3}
                    </span>
                  ) : (
                    <span className="text-ink font-medium">{row.col3}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {preview.meter ? (
        <div className="border-line bg-surface-raised/60 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className="text-muted">{preview.meter.label}</span>
            <span className="text-ink font-mono font-semibold tabular-nums">
              {preview.meter.valueText}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={preview.meter.label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={preview.meter.percent}
            className="bg-surface border-line mt-2 h-2 w-full overflow-hidden rounded-full border"
          >
            <div
              className={`h-full rounded-full ${ACCENT_BG[accent]}`}
              style={{ width: `${preview.meter.percent}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssurancePreview({
  preview,
}: {
  preview: Extract<TourVisualPreview, { kind: "assurance" }>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-xs leading-relaxed">{preview.summary}</p>

      <div className="flex flex-col gap-2">
        {preview.checks.map((check) => {
          const badge =
            check.state === "verified" ? (
              <span className="text-ok-ink inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold">
                <CheckIcon className="size-3.5 shrink-0 fill-none stroke-current" />
                Verified
              </span>
            ) : check.state === "enforced" ? (
              <span className="text-accent-ink inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold">
                <ShieldIcon className="size-3.5 shrink-0 fill-none stroke-current" />
                Enforced
              </span>
            ) : (
              <span className="text-warn-ink inline-flex shrink-0 items-center gap-1 font-mono text-[11px] font-semibold">
                <WarnIcon className="size-3.5 shrink-0 fill-none stroke-current" />
                Tracked
              </span>
            );

          return (
            <div
              key={check.label}
              className="border-line bg-surface-raised/70 rounded-lg border p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-ink text-xs font-semibold">
                  {check.label}
                </span>
                {badge}
              </div>
              <p className="text-muted mt-1 text-xs leading-relaxed">
                {check.detail}
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-muted border-line border-t pt-2.5 text-xs">
        {preview.footnote}
      </p>
    </div>
  );
}

export function TourSlideVisual({
  preview,
  slideNumber,
  chapter,
  accent,
  presenterMode,
}: {
  preview: TourVisualPreview;
  slideNumber: number;
  chapter: TourChapter;
  accent: Accent;
  presenterMode: boolean;
}) {
  const padded = String(slideNumber).padStart(2, "0");

  return (
    <aside
      data-tour-visual
      data-visual-kind={preview.kind}
      aria-label={`${preview.badge} visual preview`}
      className={`border-line bg-surface/85 shadow-raised flex flex-col justify-between rounded-xl border ${
        presenterMode ? "p-6 sm:p-7" : "p-5"
      }`}
    >
      <div className="border-line mb-4 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          <span
            className={`font-mono text-xs font-semibold tabular-nums ${ACCENT_TEXT[accent]}`}
          >
            {padded} / {chapter.toUpperCase()}
          </span>
          <span className="text-muted font-mono text-xs">
            · {preview.badge}
          </span>
        </div>

        <span className="text-pink-ink inline-flex items-center gap-1.5 font-mono text-[11px] font-medium">
          <svg
            aria-hidden="true"
            viewBox="0 0 8 8"
            className="size-2 shrink-0 fill-current"
          >
            <rect x="1" y="1" width="6" height="6" rx="1" />
          </svg>
          Illustrative · Demo
        </span>
      </div>

      {preview.kind === "architecture" ? (
        <ArchitecturePreview preview={preview} accent={accent} />
      ) : preview.kind === "telemetry" ? (
        <TelemetryPreview preview={preview} accent={accent} />
      ) : preview.kind === "topology" ? (
        <TopologyPreview preview={preview} accent={accent} />
      ) : preview.kind === "conversation" ? (
        <ConversationPreview preview={preview} accent={accent} />
      ) : preview.kind === "records" ? (
        <RecordsPreview preview={preview} accent={accent} />
      ) : (
        <AssurancePreview preview={preview} />
      )}
    </aside>
  );
}
