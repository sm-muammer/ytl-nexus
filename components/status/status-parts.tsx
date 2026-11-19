import Link from "next/link";
import { HealthBadge } from "@/components/command/health-badge";
import { CopyTicketButton } from "@/components/status/ticket-controls";
import { formatUptime, UPTIME_WINDOWS } from "@/lib/status/health";
import { formatTime, badgeHealth } from "@/lib/status/format";
import { incidentTrackingPath } from "@/lib/status/tickets";
import {
  HEALTH_TEXT,
  INCIDENT_STATES,
  overallStatus,
  type HistoryBucket,
  type IncidentDto,
  type IncidentState,
  type MaintenanceNotice,
  type PublicServiceStatus,
  type ServiceStatus,
} from "@/lib/status/types";

// Server-rendered pieces of /status. No client state, so the page works without
// JavaScript. Colour is never the only signal: every state has a word and a shape.

const OVERALL: Record<ReturnType<typeof overallStatus>, string> = {
  operational: "All monitored services are operational",
  degraded: "Some services are degraded or have no recent data",
  outage: "At least one service is down",
  unknown: "No health data yet",
};

export function OverallBanner({
  services,
}: {
  services: readonly PublicServiceStatus[];
}) {
  const overall = overallStatus(services);
  const health =
    overall === "operational"
      ? "healthy"
      : overall === "outage"
        ? "down"
        : overall === "degraded"
          ? "degraded"
          : "unknown";
  return (
    <p data-overall={overall} className="text-heading-3 font-semibold">
      <HealthBadge health={badgeHealth(health)} label={OVERALL[overall]} />
    </p>
  );
}

export function MaintenanceNotices({
  notices,
}: {
  notices: readonly MaintenanceNotice[];
}) {
  if (notices.length === 0) return null;
  return (
    <section aria-labelledby="notices-title" data-notices>
      <h2 id="notices-title" className="text-heading-3 font-semibold">
        Maintenance notices
      </h2>
      <ul className="divide-line border-line mt-4 divide-y border-y">
        {notices.map((n) => (
          <li key={n.slug} className="py-4">
            <p className="font-medium">{n.title}</p>
            <p className="text-muted text-data mt-1 max-w-(--spacing-prose)">
              {n.excerpt}
            </p>
            <p className="text-muted text-data mt-1">
              Posted {formatTime(Date.parse(n.modified))}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The Visitor list: a service name and its state, nothing else. */
export function PublicServiceList({
  services,
}: {
  services: readonly PublicServiceStatus[];
}) {
  return (
    <ul className="divide-line border-line divide-y border-y" data-public-list>
      {services.map((s) => (
        <li
          key={s.slug}
          data-service={s.slug}
          className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 py-3"
        >
          <span className="font-medium">{s.name}</span>
          <HealthBadge
            health={badgeHealth(s.health)}
            label={HEALTH_TEXT[s.health]}
          />
        </li>
      ))}
    </ul>
  );
}

const BAR: Record<NonNullable<HistoryBucket["state"]> | "none", string> = {
  healthy: "bg-ok-ink h-3",
  degraded: "bg-warn-ink h-4",
  down: "bg-bad-ink h-5",
  none: "bg-line h-1",
};

export function HistoryStrip({
  buckets,
}: {
  buckets: readonly HistoryBucket[];
}) {
  return (
    <span aria-hidden="true" className="flex h-5 items-end gap-px">
      {buckets.map((b) => (
        <span
          key={b.t}
          className={`${BAR[b.state ?? "none"]} w-1 shrink-0 rounded-[1px]`}
        />
      ))}
    </span>
  );
}

/** Viewer and above: state, latest check, uptime and the last 24 hours. */
export function ServiceHistoryTable({
  services,
}: {
  services: readonly ServiceStatus[];
}) {
  return (
    <div
      className="overflow-x-auto"
      data-history
      role="region"
      aria-label="Service history"
      tabIndex={0}
    >
      <table className="text-data w-full border-collapse text-left">
        <caption className="sr-only">
          Service state, uptime and the last 24 hours of checks
        </caption>
        <thead>
          <tr className="border-line border-b">
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              Service
            </th>
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              State
            </th>
            {UPTIME_WINDOWS.map((w) => (
              <th
                key={w.id}
                scope="col"
                className="text-muted py-2 pr-4 font-medium"
              >
                Uptime {w.id}
              </th>
            ))}
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              Last 24 hours
            </th>
            <th scope="col" className="text-muted py-2 font-medium">
              Last check
            </th>
          </tr>
        </thead>
        <tbody>
          {services.map((s) => (
            <tr
              key={s.slug}
              data-service={s.slug}
              className="border-line border-b"
            >
              <th scope="row" className="py-3 pr-4 font-medium">
                {s.name}
              </th>
              <td className="py-3 pr-4">
                <HealthBadge
                  health={badgeHealth(s.health)}
                  label={HEALTH_TEXT[s.health]}
                />
                {s.detail ? (
                  <span className="text-muted ml-2">{s.detail}</span>
                ) : null}
              </td>
              {UPTIME_WINDOWS.map((w) => (
                <td key={w.id} className="py-3 pr-4 tabular-nums">
                  {formatUptime(s.uptime[w.id])}
                </td>
              ))}
              <td className="py-3 pr-4">
                <HistoryStrip buckets={s.history} />
              </td>
              <td className="text-muted py-3 whitespace-nowrap">
                {s.lastCheckedAt === null
                  ? "Never"
                  : `${formatTime(s.lastCheckedAt)}${s.latencyMs === null ? "" : `, ${s.latencyMs} ms`}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const INCIDENT_STATE_TEXT: Record<IncidentState, string> = {
  open: "Open",
  investigating: "Investigating",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

const INCIDENT_STATE_STYLE: Record<
  IncidentState,
  { colour: string; icon: React.ReactNode }
> = {
  open: {
    colour: "text-bad-ink border-bad-ink/40",
    icon: (
      <>
        <circle cx="8" cy="8" r="6" />
        <path d="M8 5v3.5M8 11v.01" />
      </>
    ),
  },
  investigating: {
    colour: "text-warn-ink border-warn-ink/40",
    icon: (
      <>
        <circle cx="7" cy="7" r="4.5" />
        <path d="m10.5 10.5 3 3" />
      </>
    ),
  },
  monitoring: {
    colour: "text-accent-ink border-accent-ink/40",
    icon: (
      <>
        <path d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8Z" />
        <circle cx="8" cy="8" r="1.75" />
      </>
    ),
  },
  resolved: {
    colour: "text-ok-ink border-ok-ink/40",
    icon: <path d="m3.5 8.5 3 3 6-7" />,
  },
};

export function IncidentStateBadge({ state }: { state: IncidentState }) {
  const style = INCIDENT_STATE_STYLE[state];
  return (
    <span
      data-incident-state={state}
      className={`bg-surface inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${style.colour}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0 fill-none stroke-current stroke-[1.8]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {style.icon}
      </svg>
      <span>{INCIDENT_STATE_TEXT[state]}</span>
    </span>
  );
}

export function IncidentProgressSteps({ state }: { state: IncidentState }) {
  const activeIndex = INCIDENT_STATES.indexOf(state);
  return (
    <ol
      aria-label="Incident progress"
      className="grid grid-cols-2 gap-2 sm:grid-cols-4"
    >
      {INCIDENT_STATES.map((step, index) => {
        const isCurrent = step === state;
        const isDone = state === "resolved" ? true : index < activeIndex;
        const tone = isCurrent
          ? step === "resolved"
            ? "border-ok-ink bg-surface-raised text-ok-ink"
            : "border-accent-ink bg-surface-raised text-ink"
          : isDone
            ? "border-ok-ink/40 bg-surface text-ok-ink"
            : "border-line bg-surface/50 text-muted";
        return (
          <li
            key={step}
            aria-current={isCurrent ? "step" : undefined}
            className={`rounded-md border px-3 py-2 text-xs ${tone}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] opacity-80">
                0{index + 1}
              </span>
              {isDone && !isCurrent ? (
                <span aria-hidden="true" className="text-[11px]">
                  ✓
                </span>
              ) : isCurrent ? (
                <span className="font-mono text-[10px] uppercase">Current</span>
              ) : null}
            </div>
            <p className="mt-1 font-medium">{INCIDENT_STATE_TEXT[step]}</p>
          </li>
        );
      })}
    </ol>
  );
}

export function IncidentList({
  incidents,
  renderActions,
}: {
  incidents: readonly IncidentDto[];
  /** Slot for the Operator update form of one incident. */
  renderActions?: (incident: IncidentDto) => React.ReactNode;
}) {
  if (incidents.length === 0) {
    return <p className="text-muted">No incidents in the last 30 days.</p>;
  }
  return (
    <ul className="divide-line border-line divide-y border-y" data-incidents>
      {incidents.map((i) => {
        const trackPath = incidentTrackingPath(i.ticketNo);
        return (
          <li
            key={i.id}
            data-incident={i.id}
            data-ticket={i.ticketNo}
            className="py-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={trackPath}
                  className="border-line bg-surface text-accent-ink hover:border-accent-ink inline-flex min-h-11 items-center rounded-full border px-3.5 font-mono text-xs font-semibold transition-colors"
                >
                  {i.ticketNo}
                </Link>
                <h3 className="font-semibold">{i.title}</h3>
              </div>
              <IncidentStateBadge state={i.state} />
            </div>
            <p className="text-muted text-data mt-2">
              {i.serviceName}. Opened {formatTime(i.openedAt)}
              {i.resolvedAt === null
                ? ""
                : `, resolved ${formatTime(i.resolvedAt)}`}
              .
            </p>
            <ol className="mt-3 flex flex-col gap-2">
              {i.updates.map((u) => (
                <li key={u.id} className="text-data max-w-(--spacing-prose)">
                  <span className="text-muted">{formatTime(u.ts)}</span>
                  <span className="mx-2" aria-hidden="true">
                    ·
                  </span>
                  {u.body}
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href={trackPath}
                className="border-border-strong bg-surface text-ink hover:bg-surface-raised inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-medium transition-colors"
              >
                Track status
              </Link>
              <CopyTicketButton ticketNo={i.ticketNo} />
              <Link
                href={`/ai?explain=${encodeURIComponent(`Explain incident ${i.ticketNo}: "${i.title}" on service ${i.serviceName} (state: ${i.state}).`)}`}
                className="border-accent-ink/40 bg-surface text-accent-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors"
              >
                <span aria-hidden="true">✨</span>
                <span>Explain with Nexus AI</span>
              </Link>
              {renderActions ? renderActions(i) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
