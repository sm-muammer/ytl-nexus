import { Suspense } from "react";
import {
  CommandFrame,
  CommandLoading,
} from "@/components/command/command-frame";
import { pageMetadata } from "@/components/layout/module-page";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import {
  formatBytes,
  formatDuration,
  formatPercent,
  formatRate,
} from "@/lib/monitoring/snapshot";
import { getAdapters } from "@/lib/server/adapters";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command/core-01");

const text = (v: string | null) => v ?? "No data";
const num = (v: number | null, digits = 2) =>
  v === null ? "No data" : v.toFixed(digits);

function Group({ title, rows }: { title: string; rows: [string, string][] }) {
  const id = `g-${title.toLowerCase().replace(/\W+/g, "-")}`;
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-heading-3 font-semibold">
        {title}
      </h2>
      <dl className="text-data mt-3 grid grid-cols-[auto_1fr] gap-x-8 gap-y-3">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted">{k}</dt>
            <dd className="tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

async function Detail() {
  const { prometheus } = getAdapters();
  const [snapshot, host] = await Promise.all([
    prometheus.snapshot(),
    prometheus.host(),
  ]);
  const m = snapshot.metrics;
  return (
    <div className="grid gap-x-16 gap-y-10 px-(--spacing-gutter) py-8 lg:grid-cols-2">
      <div className="flex flex-wrap items-center gap-4 lg:col-span-2">
        <LiveDemoLabel source={snapshot.source} />
        {!snapshot.reachable ? (
          <span role="status" className="text-muted text-data">
            Prometheus does not answer, so no readings are shown.
          </span>
        ) : null}
      </div>
      <Group
        title="Identity"
        rows={[
          ["Name", "Nexus Core 01"],
          ["Role", "Application, database, mail, file transfer and AI host"],
          ["Operating system", text(host.os)],
          ["Kernel", text(host.kernel)],
          ["Architecture", text(host.arch)],
          ["Uptime", formatDuration(m.uptimeSeconds)],
        ]}
      />
      <Group
        title="Hardware"
        rows={[
          ["CPU cores", host.cores === null ? "No data" : String(host.cores)],
          ["Memory", formatBytes(host.memTotalBytes)],
          ["Root disk", formatBytes(host.diskTotalBytes)],
        ]}
      />
      <Group
        title="Processor and memory"
        rows={[
          ["CPU in use", formatPercent(m.cpuPct)],
          ["Load, 1 min", num(m.load1)],
          ["Load, 5 min", num(m.load5)],
          ["Load, 15 min", num(m.load15)],
          ["Memory in use", formatPercent(m.memPct)],
          ["Swap in use", formatPercent(m.swapPct)],
        ]}
      />
      <Group
        title="Disk and network"
        rows={[
          ["Root disk in use", formatPercent(m.diskPct)],
          ["Disk read", formatRate(m.diskReadBps)],
          ["Disk write", formatRate(m.diskWriteBps)],
          ["Network in", formatRate(m.netRxBps)],
          ["Network out", formatRate(m.netTxBps)],
        ]}
      />
    </div>
  );
}

export default async function Core01Page() {
  await requirePage("/command/core-01");
  return (
    <CommandFrame path="/command/core-01">
      <Suspense fallback={<CommandLoading what="the server details" />}>
        <Detail />
      </Suspense>
    </CommandFrame>
  );
}
