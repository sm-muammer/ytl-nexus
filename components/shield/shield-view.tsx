"use client";

import { ModuleHero } from "@/components/layout/module-hero";
import { RelatedModules } from "@/components/layout/related-modules";
import { PageTransition } from "@/components/motion/page-transition";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { pageInfo } from "@/lib/navigation/modules";
import {
  SHIELD_CHECKS,
  type ShieldCheckId,
  type ShieldSummaryDto,
} from "@/lib/shield/model";
import type { Severity } from "@/lib/server/db/schema";
import { useState } from "react";

function severityBadge(sev: Severity) {
  switch (sev) {
    case "high":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/40 bg-rose-500/10 px-2.5 py-0.5 text-xs font-semibold text-rose-300 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
          High
        </span>
      );
    case "medium":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Medium
        </span>
      );
    case "low":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-xs font-semibold text-sky-300 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />
          Low
        </span>
      );
    case "info":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 uppercase">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          Info
        </span>
      );
  }
}

function checkMeta(id: ShieldCheckId) {
  return (
    SHIELD_CHECKS.find((c) => c.id === id) || {
      id,
      name: id,
      category: "system" as const,
      description: "",
    }
  );
}

export function ShieldView({
  shield,
  mode,
}: {
  shield: ShieldSummaryDto;
  mode: "live" | "demo";
}) {
  const page = pageInfo("/shield");
  const [filter, setFilter] = useState<Severity | "all">("all");

  const filteredFindings =
    filter === "all"
      ? shield.findings
      : shield.findings.filter((f) => f.severity === filter);

  const scannedAtStr = shield.scannedAt
    ? `${shield.scannedAt.toISOString().replace("T", " ").slice(0, 19)} UTC`
    : "Never";

  return (
    <PageTransition>
      <div className="space-y-12">
        <ModuleHero page={page} register="workspace" />
        <div className="flex items-center gap-3">
          <LiveDemoLabel source={mode === "demo" ? "demo" : "live"} />
        </div>

        {/* Security Posture Status Banner */}
        <section
          aria-labelledby="shield-posture-title"
          className="border-line bg-surface rounded-xl border p-6"
        >
          <div className="border-line flex flex-wrap items-center justify-between gap-4 border-b pb-6">
            <div>
              <h2
                id="shield-posture-title"
                className="text-heading-2 text-ink font-bold tracking-tight"
              >
                Security Posture & Compliance
              </h2>
              <p className="text-muted mt-1 text-sm">
                Root scanner inspects system state across 11 security domains.
                Reports only; no automated modification or lockout actions.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                data-testid="posture-indicator"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase ${
                  shield.highCount > 0
                    ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
                    : shield.mediumCount > 0
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                      : "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    shield.highCount > 0
                      ? "animate-pulse bg-rose-400"
                      : shield.mediumCount > 0
                        ? "bg-amber-400"
                        : "bg-emerald-400"
                  }`}
                />
                {shield.highCount > 0
                  ? "Action Required (High)"
                  : shield.mediumCount > 0
                    ? "Attention Needed"
                    : "Posture Healthy"}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <button
              type="button"
              onClick={() => setFilter(filter === "high" ? "all" : "high")}
              className={`rounded-lg border p-4 text-left transition ${
                filter === "high"
                  ? "border-rose-500 bg-rose-500/10"
                  : "border-line bg-surface-elevated hover:border-line-strong"
              }`}
            >
              <span className="text-muted font-mono text-xs uppercase">
                High Risk
              </span>
              <p className="mt-1 text-2xl font-bold text-rose-400">
                {shield.highCount}
              </p>
              <span className="text-muted text-xs">Immediate review</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter(filter === "medium" ? "all" : "medium")}
              className={`rounded-lg border p-4 text-left transition ${
                filter === "medium"
                  ? "border-amber-500 bg-amber-500/10"
                  : "border-line bg-surface-elevated hover:border-line-strong"
              }`}
            >
              <span className="text-muted font-mono text-xs uppercase">
                Medium Risk
              </span>
              <p className="mt-1 text-2xl font-bold text-amber-400">
                {shield.mediumCount}
              </p>
              <span className="text-muted text-xs">Known risks & updates</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter(filter === "low" ? "all" : "low")}
              className={`rounded-lg border p-4 text-left transition ${
                filter === "low"
                  ? "border-sky-500 bg-sky-500/10"
                  : "border-line bg-surface-elevated hover:border-line-strong"
              }`}
            >
              <span className="text-muted font-mono text-xs uppercase">
                Low Risk
              </span>
              <p className="mt-1 text-2xl font-bold text-sky-400">
                {shield.lowCount}
              </p>
              <span className="text-muted text-xs">Recommended fixes</span>
            </button>

            <button
              type="button"
              onClick={() => setFilter(filter === "info" ? "all" : "info")}
              className={`rounded-lg border p-4 text-left transition ${
                filter === "info"
                  ? "border-emerald-500 bg-emerald-500/10"
                  : "border-line bg-surface-elevated hover:border-line-strong"
              }`}
            >
              <span className="text-muted font-mono text-xs uppercase">
                Healthy (Info)
              </span>
              <p className="mt-1 text-2xl font-bold text-emerald-400">
                {shield.infoCount}
              </p>
              <span className="text-muted text-xs">Passing controls</span>
            </button>
          </div>

          <div className="border-line mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4 text-xs">
            <span className="text-muted">
              Scan ID:{" "}
              <code className="text-ink font-mono">
                {shield.scanId || "None"}
              </code>
            </span>
            <span className="text-muted">
              Last Scan Completed:{" "}
              <span className="text-ink font-mono">{scannedAtStr}</span>
            </span>
            {filter !== "all" && (
              <button
                type="button"
                onClick={() => setFilter("all")}
                className="text-accent hover:underline"
              >
                Clear filter (showing {filter})
              </button>
            )}
          </div>
        </section>

        {/* Security Findings List */}
        <section aria-labelledby="shield-findings-title" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2
              id="shield-findings-title"
              className="text-heading-3 text-ink font-semibold"
            >
              Security Findings ({filteredFindings.length})
            </h2>
            <span className="text-muted text-xs">
              Ordered by severity · Showing{" "}
              {filter === "all" ? "all 11 checks" : filter}
            </span>
          </div>

          <div className="space-y-4" data-testid="findings-list">
            {filteredFindings.length === 0 ? (
              <div className="border-line bg-surface rounded-xl border p-8 text-center">
                <p className="text-muted text-sm">
                  No findings match the selected filter.
                </p>
              </div>
            ) : (
              filteredFindings.map((finding) => {
                const meta = checkMeta(finding.check_id);
                return (
                  <article
                    key={`${finding.scan_id}-${finding.check_id}`}
                    data-testid={`finding-${finding.check_id}`}
                    className="border-line bg-surface hover:border-line-strong rounded-xl border p-6 transition"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted font-mono text-xs font-semibold">
                            {finding.check_id}
                          </span>
                          <span className="text-muted">·</span>
                          <span className="text-muted text-xs tracking-wider uppercase">
                            {meta.category}
                          </span>
                        </div>
                        <h3 className="text-ink mt-1 text-base font-semibold">
                          {meta.name}
                        </h3>
                      </div>
                      <div className="flex items-center gap-3">
                        {severityBadge(finding.severity)}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <div className="border-line bg-surface-elevated rounded-lg border p-3">
                        <span className="text-muted block font-mono text-xs uppercase">
                          Observed Evidence
                        </span>
                        <p className="text-ink mt-1 font-mono text-sm leading-relaxed">
                          {finding.evidence}
                        </p>
                      </div>

                      <div className="border-accent/20 bg-accent/5 rounded-lg border p-3">
                        <span className="text-accent block font-mono text-xs font-semibold uppercase">
                          Remediation Guidance
                        </span>
                        <p className="text-ink mt-1 text-sm leading-relaxed">
                          {finding.remediation}
                        </p>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        {/* Security Principles & Lockout Prevention Notice */}
        <section
          aria-labelledby="lockout-notice-title"
          className="border-line bg-surface-elevated rounded-xl border p-6"
        >
          <h2
            id="lockout-notice-title"
            className="text-ink text-base font-semibold"
          >
            Lockout Prevention & Hardening Policy
          </h2>
          <p className="text-muted mt-2 text-sm leading-relaxed">
            In accordance with requirement <strong>SHD-22 and SHD-23</strong>,
            Nexus Shield reports posture without automatic remediation.
            Sensitive operational flags (such as{" "}
            <code className="text-ink font-mono">PermitRootLogin</code> and{" "}
            <code className="text-ink font-mono">PasswordAuthentication</code>)
            represent intentional deployment choices that must only be changed
            with verified non-root sudo access to prevent catastrophic operator
            lockout.
          </p>
        </section>

        <RelatedModules
          slugs={["continuity", "atlas", "control"]}
          className="mt-8"
        />
      </div>
    </PageTransition>
  );
}
