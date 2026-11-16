"use client";

import { useState } from "react";
import type { AuditEventDto } from "@/lib/server/audit";
import type { AuditResult } from "@/lib/server/db/schema";
import { ROLE_LABEL, type Role } from "@/lib/roles";

function resultBadge(result: AuditResult) {
  switch (result) {
    case "success":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          success
        </span>
      );
    case "failure":
    case "denied":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/40 bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-300">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          {result}
        </span>
      );
    case "refused":
    case "rejected":
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-300">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          {result}
        </span>
      );
  }
}

export function ControlAudit({
  events,
  demo = false,
}: {
  events: readonly AuditEventDto[];
  demo?: boolean;
}) {
  const [filterAction, setFilterAction] = useState("");
  const [filterResult, setFilterResult] = useState<string>("all");
  const [filterTarget, setFilterTarget] = useState("");

  const filtered = events.filter((e) => {
    if (
      filterAction &&
      !e.action.toLowerCase().includes(filterAction.toLowerCase())
    ) {
      return false;
    }
    if (filterResult !== "all" && e.result !== filterResult) {
      return false;
    }
    if (
      filterTarget &&
      !e.target.toLowerCase().includes(filterTarget.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const exportUrl = `/api/control/audit/export${
    filterAction || filterResult !== "all" || filterTarget
      ? `?${new URLSearchParams({
          ...(filterAction ? { action: filterAction } : {}),
          ...(filterResult !== "all" ? { result: filterResult } : {}),
          ...(filterTarget ? { target: filterTarget } : {}),
        }).toString()}`
      : ""
  }`;

  return (
    <div className="flex flex-col gap-6">
      {/* Controls & Filter Bar */}
      {demo ? (
        <p className="text-muted text-xs">
          Demo session: audit records below are realistic demonstration events.
        </p>
      ) : null}
      <div className="border-line bg-surface-elevated rounded-xl border p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="audit-filter-action"
              className="text-xs font-medium"
            >
              Filter by action
            </label>
            <input
              id="audit-filter-action"
              type="text"
              placeholder="e.g. control., auth., ops."
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="border-line bg-surface rounded-md border px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="audit-filter-result"
              className="text-xs font-medium"
            >
              Filter by result
            </label>
            <select
              id="audit-filter-result"
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="border-line bg-surface rounded-md border px-3 py-1.5 text-xs"
            >
              <option value="all">All results</option>
              <option value="success">Success only</option>
              <option value="failure">Failure only</option>
              <option value="denied">Denied only</option>
              <option value="refused">Refused only</option>
              <option value="rejected">Rejected only</option>
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="audit-filter-target"
              className="text-xs font-medium"
            >
              Filter by target
            </label>
            <input
              id="audit-filter-target"
              type="text"
              placeholder="e.g. user:, unit:, sftp:"
              value={filterTarget}
              onChange={(e) => setFilterTarget(e.target.value)}
              className="border-line bg-surface rounded-md border px-3 py-1.5 text-xs"
            />
          </div>

          <div className="flex items-end gap-2">
            <a
              href={exportUrl}
              download
              className="border-line hover:border-ink hover:bg-surface inline-flex h-8 items-center justify-center rounded-md border px-4 text-xs font-medium transition-colors"
            >
              Export CSV
            </a>
            {(filterAction || filterResult !== "all" || filterTarget) && (
              <button
                type="button"
                onClick={() => {
                  setFilterAction("");
                  setFilterResult("all");
                  setFilterTarget("");
                }}
                className="text-muted hover:text-ink text-xs underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="border-line overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-xs">
          <thead className="border-line bg-surface-elevated/70 border-b font-medium text-slate-300">
            <tr>
              <th className="px-4 py-3">Timestamp (UTC)</th>
              <th className="px-4 py-3">Actor & Role</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Result</th>
              <th className="px-4 py-3">Source IP</th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-muted px-4 py-8 text-center">
                  No audit events found matching the active filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-surface-elevated/40 transition-colors"
                  data-audit-row
                >
                  <td className="text-muted px-4 py-3 font-mono whitespace-nowrap">
                    {item.ts.replace("T", " ").slice(0, 19)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">
                      {item.actorId ?? "System / Anonymous"}
                    </div>
                    {item.role ? (
                      <div className="text-muted text-[11px]">
                        {ROLE_LABEL[item.role as Role] ?? item.role}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-sky-300">
                    {item.action}
                  </td>
                  <td className="text-muted max-w-xs truncate px-4 py-3 font-mono">
                    {item.target}
                  </td>
                  <td className="px-4 py-3">{resultBadge(item.result)}</td>
                  <td className="text-muted px-4 py-3 font-mono">
                    {item.sourceIp}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-muted text-xs">
        Showing {filtered.length} of {events.length} loaded events. The
        underlying audit log is append-only and retains all authorization and
        mutation events.
      </p>
    </div>
  );
}
