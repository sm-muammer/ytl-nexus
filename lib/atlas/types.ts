import type { AtlasEdge } from "./graph.ts";
import type {
  ServiceStatus,
  IncidentDto,
  DataSource,
} from "../status/types.ts";

// What the Atlas page receives. Client-safe. Nothing here holds a host,
// address, account id or raw log text.

export const SERVICE_KINDS = [
  "web",
  "database",
  "mail",
  "storage",
  "ai",
  "monitoring",
  "proxy",
  "system",
] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const KIND_LABEL: Record<ServiceKind, string> = {
  web: "Web",
  database: "Database",
  mail: "Mail",
  storage: "Storage",
  ai: "AI",
  monitoring: "Monitoring",
  proxy: "Proxy",
  system: "System",
};

/** One past operator action on a service. No account and no address. */
export type AtlasAuditEntry = {
  ts: number;
  /** For example `ops.restart` or `ops.health`. */
  action: string;
  result: "success" | "failure" | "refused" | "denied" | "rejected";
  role: string | null;
};

export type AtlasRunbook = { slug: string; title: string };

export type AtlasNode = ServiceStatus & {
  kind: ServiceKind;
  runbook: AtlasRunbook | null;
  /** Newest first, at most three. */
  incidents: IncidentDto[];
  /** Newest first, at most five. */
  audit: AtlasAuditEntry[];
};

export type AtlasData = {
  source: DataSource;
  takenAt: number;
  nodes: AtlasNode[];
  edges: AtlasEdge[];
};
