"use client";

import Link from "next/link";
import { useMemo } from "react";
import {
  formatDuration,
  formatPercent,
  formatRate,
  overallHealth,
  percentLevel,
  serviceHealth,
  type MetricLevel,
  type Snapshot,
} from "@/lib/monitoring/snapshot";
import { HealthBadge } from "./health-badge";
import { ParticleField } from "./particle-field";
import { ServiceTable } from "./service-list";
import { useMetricsStream } from "./use-metrics-stream";

const levelColour: Record<MetricLevel, string> = {
  ok: "bg-ok-ink",
  warn: "bg-warn-ink",
  bad: "bg-bad-ink",
  unknown: "bg-border-strong",
};

const levelWord: Record<MetricLevel, string> = {
  ok: "Normal",
  warn: "High",
  bad: "Critical",
  unknown: "No data",
};

function Gauge({
  label,
  value,
  stale,
  warnAt,
  badAt,
}: {
  label: string;
  value: number | null;
  stale: boolean;
  warnAt?: number;
  badAt?: number;
}) {
  const level = stale ? "unknown" : percentLevel(value, warnAt, badAt);
  const width = value === null ? 0 : Math.min(100, Math.max(0, value));
  return (
    <div data-gauge={label} className="border-line border-t pt-3">
      <dt className="text-muted text-data">{label}</dt>
      <dd>
        <span className="mt-1 block text-2xl font-semibold tabular-nums">
          {formatPercent(value)}
        </span>
        <span
          aria-hidden="true"
          className="bg-line mt-2 block h-1.5 w-full overflow-hidden rounded-full"
        >
          <span
            className={`${levelColour[level]} block h-full rounded-full transition-[width] duration-(--duration-slow)`}
            style={{ width: `${width}%` }}
          />
        </span>
        <span className="text-muted text-data mt-1 block">
          {stale ? "No recent data" : levelWord[level]}
        </span>
      </dd>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-line border-t pt-3">
      <dt className="text-muted text-data">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * The Nexus Command overview: health summary, particle field, key figures
 * and the changes seen since the page opened. Starts from the reading the
 * server rendered and follows /api/stream/metrics.
 */
export function CommandDashboard({ initial }: { initial: Snapshot }) {
  const { snapshot, status, events, age, stale } = useMetricsStream(initial);
  const m = snapshot.metrics;
  const now = snapshot.takenAt + (age ?? 0);
  const overall = overallHealth(snapshot, now);
  const unreachable = !snapshot.reachable;
  const dim = stale || unreachable;

  const clusters = useMemo(
    () =>
      snapshot.services.map((s) => ({
        id: s.id,
        name: s.name,
        health: serviceHealth(s.state, dim),
      })),
    [snapshot.services, dim],
  );

  const running = snapshot.services.filter((s) => s.state === "active").length;
  const failed = snapshot.services.filter((s) => s.state === "failed").length;

  return (
    <div
      data-command-dashboard
      data-stale={dim ? "true" : "false"}
      className="px-(--spacing-gutter) py-8"
    >
      <section aria-labelledby="summary-title" className="grid gap-4">
        <h2 id="summary-title" className="text-heading-3 font-semibold">
          Nexus Core 01
        </h2>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <HealthBadge
            health={overall}
            label={
              overall === "ok"
                ? "All clear"
                : overall === "stale"
                  ? "No recent data"
                  : overall === "bad"
                    ? "Needs attention"
                    : "Watch"
            }
          />
          <span className="text-muted text-data" role="status">
            {dim
              ? unreachable
                ? "Prometheus does not answer. Showing the last readings."
                : "Readings are out of date."
              : status === "open"
                ? "Updating live."
                : status === "reconnecting"
                  ? "Reconnecting."
                  : "Connecting."}
            {age !== null && !dim
              ? ` Last reading ${Math.round(age / 1000)} s ago.`
              : ""}
          </span>
        </div>
        <p className="text-muted text-data">
          {running} of {snapshot.services.length} tracked services running
          {failed > 0 ? `, ${failed} failed` : ""}.
        </p>
      </section>

      <section
        aria-labelledby="field-title"
        className="border-line mt-6 border-y"
      >
        <h2 id="field-title" className="sr-only">
          Service clusters
        </h2>
        <ParticleField clusters={clusters} />
      </section>

      <section aria-labelledby="figures-title" className="mt-8">
        <h2 id="figures-title" className="text-heading-3 font-semibold">
          Key figures
        </h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Gauge
            label="CPU"
            value={m.cpuPct}
            stale={dim}
            warnAt={90}
            badAt={98}
          />
          <Gauge label="Memory" value={m.memPct} stale={dim} />
          <Gauge
            label="Disk (root)"
            value={m.diskPct}
            stale={dim}
            warnAt={85}
            badAt={95}
          />
          <Figure label="Uptime" value={formatDuration(m.uptimeSeconds)} />
          <Figure label="Network in" value={formatRate(m.netRxBps)} />
          <Figure label="Network out" value={formatRate(m.netTxBps)} />
          <Figure label="Disk read" value={formatRate(m.diskReadBps)} />
          <Figure label="Disk write" value={formatRate(m.diskWriteBps)} />
        </dl>
      </section>

      <section aria-labelledby="services-title" className="mt-8">
        <h2 id="services-title" className="text-heading-3 font-semibold">
          Services
        </h2>
        <ServiceTable
          snapshot={snapshot}
          stale={dim}
          caption="Tracked services and their state"
        />
      </section>

      <section aria-labelledby="events-title" className="mt-8">
        <h2 id="events-title" className="text-heading-3 font-semibold">
          Recent events
        </h2>
        {events.length === 0 ? (
          <p className="text-muted mt-2">
            No service changed state since you opened this page.
          </p>
        ) : (
          <ul className="divide-line border-line mt-2 divide-y border-y">
            {events.map((e, i) => (
              <li key={`${e.at}-${i}`} className="py-3">
                <span className="font-medium">{e.service}</span>{" "}
                <span className="text-muted">
                  changed from {e.from} to {e.to}.
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-muted text-data mt-3">
          Only changes seen on this page are listed. The history with incidents
          is on the{" "}
          <Link href="/status" className="underline underline-offset-4">
            Status page
          </Link>
          , and dependencies are on{" "}
          <Link href="/command/atlas" className="underline underline-offset-4">
            Atlas
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
