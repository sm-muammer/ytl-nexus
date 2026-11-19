import type { Health, UptimeSummary } from "./health.ts";

// Shapes the Nexus Status data layer hands to pages. Pure types plus the one
// function that strips detail for a Visitor. Client-safe.

export type DataSource = "live" | "demo";

export type IncidentState =
  "open" | "investigating" | "monitoring" | "resolved";
export const INCIDENT_STATES: readonly IncidentState[] = [
  "open",
  "investigating",
  "monitoring",
  "resolved",
];

export const HEALTH_TEXT: Record<Health, string> = {
  healthy: "Operational",
  degraded: "Degraded",
  down: "Down",
  stale: "Stale",
  unknown: "Unknown",
};

/** One half-hour of a 24-hour strip: the worst state seen, or none. */
export type HistoryBucket = {
  /** Start of the bucket, milliseconds since the epoch. */
  t: number;
  state: "healthy" | "degraded" | "down" | null;
};

/** What a Visitor sees: a name and a state, nothing else (STA-03). */
export type PublicServiceStatus = {
  slug: string;
  name: string;
  health: Health;
};

/** What a Viewer and above see (STA-04). No host, address or raw error text. */
export type ServiceStatus = PublicServiceStatus & {
  latencyMs: number | null;
  /** Short fixed phrase from the last non-healthy check, or null. */
  detail: string | null;
  lastCheckedAt: number | null;
  uptime: UptimeSummary;
  history: HistoryBucket[];
};

export type IncidentUpdateDto = { id: number; ts: number; body: string };

export type IncidentDto = {
  id: number;
  ticketNo: string;
  serviceSlug: string;
  serviceName: string;
  title: string;
  state: IncidentState;
  openedAt: number;
  resolvedAt: number | null;
  updates: IncidentUpdateDto[];
};

export type IncidentLookupView = {
  source: DataSource;
  takenAt: number;
  incident: IncidentDto | null;
};

export type MaintenanceNotice = {
  slug: string;
  title: string;
  excerpt: string;
  modified: string;
};

export type PublicStatus = {
  kind: "public";
  source: DataSource;
  takenAt: number;
  services: PublicServiceStatus[];
};

export type FullStatus = {
  kind: "full";
  source: DataSource;
  takenAt: number;
  services: ServiceStatus[];
  incidents: IncidentDto[];
};

export type StatusView = PublicStatus | FullStatus;

/** The Visitor view of a service: only the fields the public may see. */
export function toPublicService(s: PublicServiceStatus): PublicServiceStatus {
  return { slug: s.slug, name: s.name, health: s.health };
}

export function overallStatus(
  services: readonly PublicServiceStatus[],
): "operational" | "degraded" | "outage" | "unknown" {
  const known = services.filter(
    (s) => s.health !== "unknown" && s.health !== "stale",
  );
  if (known.length === 0) return "unknown";
  if (known.some((s) => s.health === "down")) return "outage";
  if (services.some((s) => s.health === "degraded" || s.health === "stale")) {
    return "degraded";
  }
  return "operational";
}
