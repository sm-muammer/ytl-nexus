import type {
  ColumnType,
  Generated,
  Insertable,
  Selectable,
  Updateable,
} from "kysely";

// Typed view of the `ytl_nexus` database. Keep it in step with the migrations in
// ./migrations. Timestamps are stored in UTC (DATETIME(3)); the connection
// returns them as Date objects.

type Timestamp = ColumnType<Date, Date | string | undefined, Date | string>;
type CreatedAt = ColumnType<Date, Date | string | undefined, never>;
type Id = Generated<number>;

export const AUDIT_RESULTS = [
  "success",
  "failure",
  "refused",
  "denied",
  "rejected",
] as const;
export type AuditResult = (typeof AUDIT_RESULTS)[number];

export const ROLES = ["viewer", "member", "operator", "admin"] as const;
export type DbRole = (typeof ROLES)[number];

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

export const CHECK_STATES = ["healthy", "degraded", "down"] as const;
export type CheckState = (typeof CHECK_STATES)[number];

export const INCIDENT_STATES = [
  "open",
  "investigating",
  "monitoring",
  "resolved",
] as const;
export type IncidentState = (typeof INCIDENT_STATES)[number];

export const SEVERITIES = ["info", "low", "medium", "high"] as const;
export type Severity = (typeof SEVERITIES)[number];

export const ASSET_CATEGORIES = [
  "server",
  "switch",
  "router",
  "firewall",
  "access-point",
  "ups",
  "storage",
  "other",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_STATUSES = ["active", "maintenance", "retired"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const SITE_KINDS = [
  "data-centre",
  "exchange",
  "office",
  "tower",
] as const;
export type SiteKind = (typeof SITE_KINDS)[number];

export const TICKET_PRIORITIES = ["low", "medium", "high"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];

export const TICKET_STATUSES = [
  "open",
  "scheduled",
  "in-progress",
  "done",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const CHUNK_AUDIENCES = [
  "public",
  "viewer",
  "member",
  "operator",
  "admin",
] as const;
export type ChunkAudience = (typeof CHUNK_AUDIENCES)[number];

export interface AuditEventsTable {
  id: Id;
  ts: Timestamp;
  actor_id: string | null;
  role: DbRole | null;
  action: string;
  target: string;
  result: AuditResult;
  source_ip: string;
}

export interface ServicesTable {
  id: Id;
  slug: string;
  name: string;
  kind: ServiceKind;
  runbook_slug: string | null;
  unit: string | null;
  created_at: CreatedAt;
}

export interface ServiceDependenciesTable {
  service_id: number;
  depends_on_id: number;
}

export interface ServiceChecksTable {
  id: Id;
  service_id: number;
  checked_at: Timestamp;
  state: CheckState;
  latency_ms: number | null;
  detail: string | null;
}

export interface IncidentsTable {
  id: Id;
  ticket_no: string;
  service_id: number;
  title: string;
  state: Generated<IncidentState>;
  opened_at: Timestamp;
  resolved_at: Timestamp | null;
  opened_by: string | null;
}

export interface IncidentUpdatesTable {
  id: Id;
  incident_id: number;
  ts: Timestamp;
  author_id: string | null;
  body: string;
}

export interface BackupRunsTable {
  id: Id;
  started_at: Timestamp;
  completed_at: Timestamp;
  status: "ok" | "failed";
  /** JSON text: `[{ name, sizeBytes, sha256 }]`. */
  components_json: string;
}

export interface RestoreTestsTable {
  id: Id;
  tested_at: Timestamp;
  component: string;
  result: "ok" | "failed";
  detail: string | null;
}

export interface ShieldFindingsTable {
  id: Id;
  scan_id: string;
  check_id: string;
  severity: Severity;
  evidence: string;
  remediation: string;
  seen_at: Timestamp;
}

export interface DataSitesTable {
  id: Id;
  code: string;
  name: string;
  city: string;
  state: string;
  kind: SiteKind;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, never, never>;
}

export interface DataAssetsTable {
  id: Id;
  asset_tag: string;
  name: string;
  category: AssetCategory;
  site_id: number;
  status: Generated<AssetStatus>;
  vendor: string;
  model: string;
  purchased_on: ColumnType<
    string | null,
    string | null | undefined,
    string | null
  >;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, never, never>;
}

export interface DataTicketsTable {
  id: Id;
  ticket_no: string;
  title: string;
  asset_id: number | null;
  site_id: number;
  priority: Generated<TicketPriority>;
  status: Generated<TicketStatus>;
  scheduled_for: ColumnType<
    string | null,
    string | null | undefined,
    string | null
  >;
  description: string;
  created_at: CreatedAt;
  updated_at: ColumnType<Date, never, never>;
}

export interface AiChunksTable {
  id: Id;
  source: string;
  chunk_index: Generated<number>;
  audience: ChunkAudience;
  text: string;
  /** Float32 vector bytes, searched in memory. */
  embedding: Buffer;
  updated_at: ColumnType<Date, never, never>;
}

export interface AiConversationsTable {
  id: Id;
  user_id: string;
  title: string;
  /** JSON text of the message list. */
  messages_json: string;
  updated_at: ColumnType<Date, never, never>;
}

/** Better Auth owns the next five tables. Its adapter reads and writes them with its own column names. */
export interface AuthUserTable {
  id: string;
  name: string;
  email: string;
  emailVerified: Generated<number>;
  image: string | null;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string>;
  role: Generated<DbRole>;
  banned: Generated<number>;
  banReason: string | null;
  banExpires: Timestamp | null;
  twoFactorEnabled: Generated<number>;
}

export interface AuthSessionTable {
  id: string;
  expiresAt: Timestamp;
  token: string;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string>;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string;
  impersonatedBy: string | null;
  /** Time of the last password plus TOTP check (Step_Up). */
  stepUpAt: Timestamp | null;
}

export interface AuthAccountTable {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Timestamp | null;
  refreshTokenExpiresAt: Timestamp | null;
  scope: string | null;
  /** Password hash for the "credential" provider. Never leaves the server. */
  password: string | null;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface AuthVerificationTable {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Timestamp;
  createdAt: ColumnType<Date, Date | string | undefined, Date | string>;
  updatedAt: ColumnType<Date, Date | string | undefined, Date | string>;
}

export interface AuthTwoFactorTable {
  id: string;
  /** Encrypted with BETTER_AUTH_SECRET. */
  secret: string;
  backupCodes: string;
  userId: string;
  verified: Generated<number>;
  failedVerificationCount: Generated<number>;
  lockedUntil: Timestamp | null;
}

export interface AuthFailuresTable {
  id: Id;
  /** "account:<lower-case email>" or "ip:<address>". */
  subject: string;
  failed_at: Timestamp;
}

export interface Database {
  user: AuthUserTable;
  session: AuthSessionTable;
  account: AuthAccountTable;
  verification: AuthVerificationTable;
  twoFactor: AuthTwoFactorTable;
  auth_failures: AuthFailuresTable;
  audit_events: AuditEventsTable;
  services: ServicesTable;
  service_dependencies: ServiceDependenciesTable;
  service_checks: ServiceChecksTable;
  incidents: IncidentsTable;
  incident_updates: IncidentUpdatesTable;
  backup_runs: BackupRunsTable;
  restore_tests: RestoreTestsTable;
  shield_findings: ShieldFindingsTable;
  data_sites: DataSitesTable;
  data_assets: DataAssetsTable;
  data_tickets: DataTicketsTable;
  ai_chunks: AiChunksTable;
  ai_conversations: AiConversationsTable;
}

/** Every application table, parents before children. */
export const APPLICATION_TABLES = [
  "user",
  "session",
  "account",
  "verification",
  "twoFactor",
  "auth_failures",
  "audit_events",
  "services",
  "service_dependencies",
  "service_checks",
  "incidents",
  "incident_updates",
  "backup_runs",
  "restore_tests",
  "shield_findings",
  "data_sites",
  "data_assets",
  "data_tickets",
  "ai_chunks",
  "ai_conversations",
] as const satisfies readonly (keyof Database)[];

export type DataAsset = Selectable<DataAssetsTable>;
export type NewDataAsset = Insertable<DataAssetsTable>;
export type DataAssetUpdate = Updateable<DataAssetsTable>;
