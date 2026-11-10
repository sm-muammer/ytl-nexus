import "server-only";
import { type QueryId } from "@/lib/monitoring/queries";
import { TRACKED_SERVICES } from "@/lib/monitoring/services";
import {
  EMPTY_METRICS,
  type HostInfo,
  type Metrics,
  type Snapshot,
  type UnitState,
} from "@/lib/monitoring/snapshot";
import {
  PrometheusUnavailableError,
  type PrometheusClient,
  type Sample,
} from "@/lib/server/prometheus";

// Turns Prometheus answers into the Snapshot the UI uses. A query that fails
// leaves its value null; only when nothing at all can be read is the poll
// treated as a failure, so one missing collector never blanks the dashboard.

const SCALARS: Record<keyof Metrics, QueryId> = {
  cpuPct: "cpu_used_pct",
  load1: "load1",
  load5: "load5",
  load15: "load15",
  memPct: "mem_used_pct",
  swapPct: "swap_used_pct",
  diskPct: "disk_used_pct",
  diskReadBps: "disk_read_bps",
  diskWriteBps: "disk_write_bps",
  netRxBps: "net_rx_bps",
  netTxBps: "net_tx_bps",
  uptimeSeconds: "uptime_s",
};

const first = (samples: Sample[] | undefined): number | null =>
  samples?.[0]?.value ?? null;

const KNOWN_STATES: readonly UnitState[] = [
  "active",
  "inactive",
  "failed",
  "activating",
  "deactivating",
];

export async function collectSnapshot(
  client: PrometheusClient,
  now: number,
  intervalMs: number,
): Promise<Snapshot> {
  const ids = [
    ...Object.values(SCALARS),
    "unit_states",
    "systemd_collector",
  ] as const;
  const settled = await Promise.allSettled(ids.map((id) => client.instant(id)));
  const byId = new Map<string, Sample[]>();
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") byId.set(ids[i] as string, r.value);
  });
  if (byId.size === 0) throw new PrometheusUnavailableError();

  const metrics: Metrics = { ...EMPTY_METRICS };
  for (const [key, id] of Object.entries(SCALARS)) {
    metrics[key as keyof Metrics] = first(byId.get(id));
  }

  const collectorOk = first(byId.get("systemd_collector")) === 1;
  const states = new Map<string, UnitState>();
  for (const s of byId.get("unit_states") ?? []) {
    const unit = s.labels.name;
    const state = s.labels.state as UnitState | undefined;
    if (unit && state && KNOWN_STATES.includes(state)) states.set(unit, state);
  }

  return {
    source: "live",
    takenAt: now,
    intervalMs,
    reachable: true,
    metrics,
    services: TRACKED_SERVICES.map((s) => ({
      id: s.id,
      name: s.name,
      unit: s.unit,
      state: states.get(s.unit) ?? (collectorOk ? "absent" : "unknown"),
    })),
  };
}

export async function collectHost(client: PrometheusClient): Promise<HostInfo> {
  const ids = [
    "host_kernel",
    "host_os",
    "cores",
    "mem_total_bytes",
    "disk_total_bytes",
  ] as const;
  const settled = await Promise.allSettled(ids.map((id) => client.instant(id)));
  const get = (i: number): Sample[] | undefined => {
    const r = settled[i];
    return r?.status === "fulfilled" ? r.value : undefined;
  };
  const kernel = get(0)?.[0]?.labels;
  return {
    os: get(1)?.[0]?.labels.pretty_name ?? null,
    kernel: kernel?.release ?? null,
    arch: kernel?.machine ?? null,
    cores: first(get(2)),
    memTotalBytes: first(get(3)),
    diskTotalBytes: first(get(4)),
  };
}
