// Contracts for the eight server adapters (DEMO-01). Each has a `live` and a
// `demo` implementation; one set is chosen from NEXUS_MODE. Task 3 defines the
// shared baseline (identity plus a status probe). The task that builds each
// module extends its own interface with the real operations.

import type { RangeId, RangeQueryId } from "@/lib/monitoring/queries";
import type {
  HostInfo,
  SeriesPoint,
  Snapshot,
} from "@/lib/monitoring/snapshot";
import type { Actor } from "@/lib/roles";

export const ADAPTER_NAMES = [
  "db",
  "auth",
  "wordpress",
  "prometheus",
  "ollama",
  "sftpgo",
  "ops",
  "mail",
] as const;

export type AdapterName = (typeof ADAPTER_NAMES)[number];

/** Where a value comes from. Shown to users as "Live" or "Demo data". */
export type DataSource = "live" | "demo";

export type AdapterStatus = {
  name: AdapterName;
  source: DataSource;
  state: "ok" | "warn" | "bad";
  /** Short text shown next to the status icon. */
  label: string;
  /** One plain sentence. Never contains a host, path, credential or stack trace. */
  detail: string;
};

export interface ServiceAdapter {
  readonly name: AdapterName;
  readonly source: DataSource;
  status(): Promise<AdapterStatus>;
}

export type DbAdapter = ServiceAdapter;
export type WordPressAdapter = ServiceAdapter;
export interface PrometheusAdapter extends ServiceAdapter {
  /** One reading of the host and the tracked services. Never throws: an unreachable Prometheus gives `reachable: false`. */
  snapshot(): Promise<Snapshot>;
  /** A range series for a chart, or null when Prometheus cannot be reached. */
  range(id: RangeQueryId, range: RangeId): Promise<SeriesPoint[] | null>;
  /** Server identity and size, or null fields when unknown. */
  host(): Promise<HostInfo>;
}
export type OllamaAdapter = ServiceAdapter;
export type SftpgoAdapter = ServiceAdapter;
export type OpsAdapter = ServiceAdapter;
export type MailAdapter = ServiceAdapter;

export interface AuthAdapter extends ServiceAdapter {
  /** The signed-in user, or null for a Visitor. */
  getActor(): Promise<Actor>;
}

export interface Adapters {
  db: DbAdapter;
  auth: AuthAdapter;
  wordpress: WordPressAdapter;
  prometheus: PrometheusAdapter;
  ollama: OllamaAdapter;
  sftpgo: SftpgoAdapter;
  ops: OpsAdapter;
  mail: MailAdapter;
}

/** Inputs that differ between a request and a test. */
export type AdapterDeps = {
  /** Raw value of the demo session cookie, or undefined when absent. */
  readDemoRole: () => Promise<string | undefined>;
};
