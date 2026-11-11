import { HealthBadge } from "@/components/command/health-badge";
import { formatUptime, UPTIME_WINDOWS } from "@/lib/status/health";
import { formatTime, badgeHealth } from "@/lib/status/format";
import {
  HEALTH_TEXT,
  overallStatus,
  type HistoryBucket,
  type IncidentDto,
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

function HistoryStrip({ buckets }: { buckets: readonly HistoryBucket[] }) {
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

const INCIDENT_STATE_TEXT: Record<IncidentDto["state"], string> = {
  open: "Open",
  investigating: "Investigating",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

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
      {incidents.map((i) => (
        <li key={i.id} data-incident={i.id} className="py-5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h3 className="font-semibold">{i.title}</h3>
            <span className="text-data font-medium">
              {INCIDENT_STATE_TEXT[i.state]}
            </span>
          </div>
          <p className="text-muted text-data mt-1">
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
          {renderActions ? (
            <div className="mt-4">{renderActions(i)}</div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
