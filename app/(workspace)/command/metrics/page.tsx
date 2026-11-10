import Link from "next/link";
import { Suspense } from "react";
import {
  CommandFrame,
  CommandLoading,
} from "@/components/command/command-frame";
import { RangeChart, type ChartSeries } from "@/components/command/range-chart";
import { pageMetadata } from "@/components/layout/module-page";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import {
  RANGES,
  RANGE_IDS,
  isRangeId,
  type RangeId,
  type RangeQueryId,
} from "@/lib/monitoring/queries";
import { formatBytes, formatPercent } from "@/lib/monitoring/snapshot";
import { getAdapters } from "@/lib/server/adapters";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command/metrics");

const rate = (v: number) => `${formatBytes(v)}/s`;
const pct = (v: number) => formatPercent(v).replace(".0%", "%");

async function Charts({ range }: { range: RangeId }) {
  const { prometheus } = getAdapters();
  const ids: RangeQueryId[] = [
    "cpu_used_pct",
    "mem_used_pct",
    "load1",
    "disk_used_pct",
    "disk_read_bps",
    "disk_write_bps",
    "net_rx_bps",
    "net_tx_bps",
  ];
  const results = await Promise.all(
    ids.map((id) => prometheus.range(id, range)),
  );
  const get = (id: RangeQueryId) => results[ids.indexOf(id)] ?? [];
  const withDate = range === "7d" || range === "24h";
  const series = (
    name: string,
    id: RangeQueryId,
    colour: ChartSeries["colour"] = "accent",
    style: ChartSeries["style"] = "solid",
  ): ChartSeries => ({ name, points: get(id), colour, style });

  return (
    <div className="grid gap-x-12 gap-y-10 lg:grid-cols-2">
      <RangeChart
        id="cpu"
        title="CPU in use"
        withDate={withDate}
        fixedMax={100}
        format={pct}
        series={[series("CPU", "cpu_used_pct")]}
      />
      <RangeChart
        id="memory"
        title="Memory in use"
        withDate={withDate}
        fixedMax={100}
        format={pct}
        series={[series("Memory", "mem_used_pct")]}
      />
      <RangeChart
        id="load"
        title="Load average (1 minute)"
        withDate={withDate}
        format={(v) => v.toFixed(2)}
        series={[series("Load", "load1")]}
      />
      <RangeChart
        id="disk"
        title="Root disk in use"
        withDate={withDate}
        fixedMax={100}
        format={pct}
        series={[series("Disk", "disk_used_pct")]}
      />
      <RangeChart
        id="disk-io"
        title="Disk read and write"
        withDate={withDate}
        format={rate}
        series={[
          series("Read", "disk_read_bps"),
          series("Write", "disk_write_bps", "pink", "dashed"),
        ]}
      />
      <RangeChart
        id="network"
        title="Network in and out"
        withDate={withDate}
        format={rate}
        series={[
          series("In", "net_rx_bps"),
          series("Out", "net_tx_bps", "pink", "dashed"),
        ]}
      />
    </div>
  );
}

async function Source() {
  const status = await getAdapters().prometheus.status();
  return <LiveDemoLabel source={status.source} />;
}

export default async function MetricsPage({
  searchParams,
}: PageProps<"/command/metrics">) {
  await requirePage("/command/metrics");
  const raw = (await searchParams).range;
  const range: RangeId = isRangeId(raw) ? raw : "1h";

  return (
    <CommandFrame path="/command/metrics">
      <div className="px-(--spacing-gutter) py-8">
        <nav
          aria-label="Time range"
          className="flex flex-wrap items-center gap-2"
        >
          {RANGE_IDS.map((id) => (
            <Link
              key={id}
              href={
                id === "1h"
                  ? "/command/metrics"
                  : `/command/metrics?range=${id}`
              }
              aria-current={id === range ? "true" : undefined}
              className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors duration-(--duration-fast) ${
                id === range
                  ? "border-accent-ink text-accent-ink bg-surface"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {RANGES[id].label}
            </Link>
          ))}
          <span className="ml-2">
            <Suspense fallback={null}>
              <Source />
            </Suspense>
          </span>
        </nav>
        <div className="mt-6">
          <Suspense fallback={<CommandLoading what="the charts" />}>
            <Charts range={range} />
          </Suspense>
        </div>
      </div>
    </CommandFrame>
  );
}
