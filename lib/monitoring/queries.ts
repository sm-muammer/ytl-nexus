import { TRACKED_UNITS } from "./services.ts";

// The PromQL allowlist (CMD-02). Callers pass a query ID, never PromQL text.
// Every expression is fixed here; the only interpolated value is the list of
// tracked unit names, which is also fixed in this repository.

const unitPattern = TRACKED_UNITS.map((u) => u.replace(/\./g, "\\\\.")).join(
  "|",
);

const NOT_VIRTUAL_IFACE = 'device!~"lo|veth.*|docker.*|br-.*|virbr.*"';
const ROOT_FS = 'mountpoint="/",fstype!~"tmpfs|rootfs|overlay"';

export const QUERIES = {
  cpu_used_pct:
    '100 * (1 - avg(rate(node_cpu_seconds_total{mode="idle"}[2m])))',
  load1: "node_load1",
  load5: "node_load5",
  load15: "node_load15",
  mem_used_pct:
    "100 * (1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)",
  swap_used_pct:
    "100 * (1 - node_memory_SwapFree_bytes / node_memory_SwapTotal_bytes)",
  disk_used_pct: `100 * (1 - node_filesystem_avail_bytes{${ROOT_FS}} / node_filesystem_size_bytes{${ROOT_FS}})`,
  disk_read_bps: "sum(rate(node_disk_read_bytes_total[2m]))",
  disk_write_bps: "sum(rate(node_disk_written_bytes_total[2m]))",
  net_rx_bps: `sum(rate(node_network_receive_bytes_total{${NOT_VIRTUAL_IFACE}}[2m]))`,
  net_tx_bps: `sum(rate(node_network_transmit_bytes_total{${NOT_VIRTUAL_IFACE}}[2m]))`,
  uptime_s: "time() - node_boot_time_seconds",
  cores: 'count(count by (cpu) (node_cpu_seconds_total{mode="idle"}))',
  mem_total_bytes: "node_memory_MemTotal_bytes",
  disk_total_bytes: `node_filesystem_size_bytes{${ROOT_FS}}`,
  unit_states: `node_systemd_unit_state{name=~"${unitPattern}"} == 1`,
  host_kernel: "node_uname_info",
  host_os: "node_os_info",
  node_up: 'up{job="node"}',
  systemd_collector: 'node_scrape_collector_success{collector="systemd"}',
} as const;

export type QueryId = keyof typeof QUERIES;

/** Own-property test, so "toString" and "__proto__" are never IDs. */
export function isQueryId(value: unknown): value is QueryId {
  return typeof value === "string" && Object.hasOwn(QUERIES, value);
}

/** The series that have a range chart on /command/metrics. */
export const RANGE_QUERY_IDS = [
  "cpu_used_pct",
  "mem_used_pct",
  "load1",
  "disk_used_pct",
  "disk_read_bps",
  "disk_write_bps",
  "net_rx_bps",
  "net_tx_bps",
] as const satisfies readonly QueryId[];

export type RangeQueryId = (typeof RANGE_QUERY_IDS)[number];

export function isRangeQueryId(value: unknown): value is RangeQueryId {
  return (
    typeof value === "string" &&
    (RANGE_QUERY_IDS as readonly string[]).includes(value)
  );
}

export const RANGES = {
  "1h": { label: "1 hour", seconds: 3600, stepSeconds: 30 },
  "6h": { label: "6 hours", seconds: 6 * 3600, stepSeconds: 180 },
  "24h": { label: "24 hours", seconds: 24 * 3600, stepSeconds: 600 },
  "7d": { label: "7 days", seconds: 7 * 24 * 3600, stepSeconds: 3600 },
} as const;

export type RangeId = keyof typeof RANGES;

export const RANGE_IDS = Object.keys(RANGES) as RangeId[];

export function isRangeId(value: unknown): value is RangeId {
  return typeof value === "string" && Object.hasOwn(RANGES, value);
}
