import { z } from "zod";
import type { Role } from "@/lib/roles";
import type { AuditResult } from "@/lib/server/db/schema";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { getMode } from "@/lib/server/mode";
import { demoAuditEvents } from "@/lib/fixtures/audit";

export type AuditEventDto = {
  id: number;
  ts: string;
  actorId: string | null;
  role: Role | null;
  action: string;
  target: string;
  result: AuditResult;
  sourceIp: string;
};

export const auditFiltersSchema = z.object({
  actorId: z.string().trim().optional(),
  action: z.string().trim().optional(),
  target: z.string().trim().optional(),
  result: z
    .enum(["success", "failure", "refused", "denied", "rejected"])
    .optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
});

export type AuditFilters = z.infer<typeof auditFiltersSchema>;

/**
 * Escapes a single CSV cell value according to RFC 4180 and protects against
 * formula injection (CSV injection). If the value begins with =, +, -, @, \t, or \r,
 * it is prefixed with a backtick to disarm spreadsheet formula execution.
 */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);

  // Formula injection prevention: disarm dangerous leading characters
  if (/^[=+\-@\t\r]/.test(str)) {
    str = "`" + str;
  }

  // RFC 4180 escaping: wrap in quotes and escape inner quotes if containing quotes, commas or newlines
  if (/[",\r\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
}

/** Formats an array of audit events into an RFC 4180 CSV document. */
export function auditEventsToCsv(events: readonly AuditEventDto[]): string {
  const headers = [
    "id",
    "ts",
    "actor_id",
    "role",
    "action",
    "target",
    "result",
    "source_ip",
  ];
  const rows = events.map((e) =>
    [
      escapeCsvCell(e.id),
      escapeCsvCell(e.ts),
      escapeCsvCell(e.actorId ?? ""),
      escapeCsvCell(e.role ?? ""),
      escapeCsvCell(e.action),
      escapeCsvCell(e.target),
      escapeCsvCell(e.result),
      escapeCsvCell(e.sourceIp),
    ].join(","),
  );
  return [headers.join(","), ...rows].join("\n") + "\n";
}

/**
 * Lists audit events with optional filtering for actor, action, target, result,
 * and date range. Administrator-only in live mode, or fixture data in demo mode.
 */
export async function listAuditEvents(
  filters: AuditFilters = {},
  limit = 100,
): Promise<AuditEventDto[]> {
  if (getMode() === "demo") {
    let items = [...demoAuditEvents];
    if (filters.action) {
      const q = filters.action.toLowerCase();
      items = items.filter((e) => e.action.toLowerCase().includes(q));
    }
    if (filters.actorId) {
      const q = filters.actorId.toLowerCase();
      items = items.filter((e) => e.actorId?.toLowerCase().includes(q));
    }
    if (filters.target) {
      const q = filters.target.toLowerCase();
      items = items.filter((e) => e.target.toLowerCase().includes(q));
    }
    if (filters.result) {
      items = items.filter((e) => e.result === filters.result);
    }
    return items.slice(0, Math.min(limit, 500));
  }

  const rt = getAuthRuntime();
  let query = rt.db
    .selectFrom("audit_events")
    .selectAll()
    .orderBy("ts", "desc")
    .limit(Math.min(limit, 500));

  if (filters.action) {
    query = query.where("action", "like", `%${filters.action}%`);
  }
  if (filters.actorId) {
    query = query.where("actor_id", "like", `%${filters.actorId}%`);
  }
  if (filters.target) {
    query = query.where("target", "like", `%${filters.target}%`);
  }
  if (filters.result) {
    query = query.where("result", "=", filters.result);
  }
  if (filters.from) {
    const fromDate = new Date(filters.from);
    if (!Number.isNaN(fromDate.getTime())) {
      query = query.where("ts", ">=", fromDate);
    }
  }
  if (filters.to) {
    const toDate = new Date(filters.to);
    if (!Number.isNaN(toDate.getTime())) {
      query = query.where("ts", "<=", toDate);
    }
  }

  const rows = await query.execute();
  return rows.map((r) => ({
    id: Number(r.id),
    ts: new Date(r.ts).toISOString(),
    actorId: r.actor_id,
    role: r.role as Role | null,
    action: r.action,
    target: r.target,
    result: r.result,
    sourceIp: r.source_ip,
  }));
}
