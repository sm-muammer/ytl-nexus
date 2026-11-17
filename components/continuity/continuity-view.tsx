import Link from "next/link";
import { ModuleHero } from "@/components/layout/module-hero";
import { RelatedModules } from "@/components/layout/related-modules";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";
import type { ComponentItemView, ContinuityDto } from "@/lib/continuity/model";

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatIso(iso?: string | null): string {
  if (!iso) return "Never";
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}

export function ContinuityView({
  continuity,
  mode: _mode,
}: {
  continuity: ContinuityDto;
  mode: "live" | "demo";
}) {
  const page = pageInfo("/continuity");
  const isFresh = continuity.freshness === "fresh";
  const { summary, roleDetail, components } = continuity;

  return (
    <PageTransition>
      <div className="space-y-12">
        <ModuleHero page={page} register="workspace" />

        {/* Global Freshness & Verification Banner */}
        <section
          aria-labelledby="continuity-status-title"
          className="border-line bg-surface rounded-xl border p-6"
        >
          <div className="border-line flex flex-wrap items-center justify-between gap-4 border-b pb-6">
            <div>
              <h2
                id="continuity-status-title"
                className="text-heading-2 text-ink font-bold tracking-tight"
              >
                System Continuity Status
              </h2>
              <p className="text-muted mt-1 text-sm">
                Backups are generated daily by root systemd timers and tested
                weekly in isolated scratch databases.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                data-testid="freshness-indicator"
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold tracking-wider uppercase ${
                  isFresh
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-amber-500/40 bg-amber-500/10 text-amber-300"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    isFresh ? "bg-emerald-400" : "animate-pulse bg-amber-400"
                  }`}
                />
                {isFresh ? "Backups Fresh (<26h)" : "Backups Stale (>26h)"}
              </span>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="border-line bg-surface-elevated rounded-lg border p-4">
              <span className="text-muted font-mono text-xs uppercase">
                Last Backup Run
              </span>
              <p className="text-ink mt-1 text-lg font-semibold">
                {formatIso(continuity.lastBackupAt)}
              </p>
              <span
                className={`text-xs ${
                  continuity.lastBackupStatus === "ok"
                    ? "text-emerald-400"
                    : continuity.lastBackupStatus === "failed"
                      ? "font-semibold text-rose-400"
                      : "text-muted"
                }`}
              >
                Status: {continuity.lastBackupStatus.toUpperCase()}
              </span>
            </div>

            <div className="border-line bg-surface-elevated rounded-lg border p-4">
              <span className="text-muted font-mono text-xs uppercase">
                Verified Restores
              </span>
              <p className="mt-1 text-lg font-semibold text-emerald-400">
                {summary.verifiedComponents} / {summary.totalComponents}{" "}
                verified
              </p>
              <span className="text-muted text-xs">
                Weekly isolated restore drills
              </span>
            </div>

            <div className="border-line bg-surface-elevated rounded-lg border p-4">
              <span className="text-muted font-mono text-xs uppercase">
                Retention Policy
              </span>
              <p className="text-ink mt-1 text-lg font-semibold">
                7 Daily · 4 Weekly
              </p>
              <span className="text-muted text-xs">
                SHA-256 verified in /var/backups/nexus
              </span>
            </div>
          </div>

          {!isFresh && (
            <div
              data-testid="stale-alert"
              className="mt-6 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200"
            >
              <span className="text-lg">⚠️</span>
              <div className="text-sm">
                <strong className="font-semibold">Stale Backup Alert:</strong>{" "}
                No successful backup has been recorded within the last 26 hours.
                This finding is escalated to{" "}
                <Link
                  href="/status"
                  className="font-medium underline hover:text-white"
                >
                  Nexus Status
                </Link>{" "}
                and{" "}
                <Link
                  href="/shield"
                  className="font-medium underline hover:text-white"
                >
                  Nexus Shield
                </Link>
                .
              </div>
            </div>
          )}
        </section>

        {/* Component Inventory Table / Cards */}
        <section aria-labelledby="components-list-title" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3
                id="components-list-title"
                className="text-heading-3 text-ink font-semibold"
              >
                Monitored Components
              </h3>
              <p className="text-muted text-sm">
                {roleDetail
                  ? "Operator view: includes compressed archive sizes, SHA-256 digests, and disaster recovery procedures."
                  : "Viewer view: health and recovery verification summary."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {components.map((comp) => (
              <ComponentCard
                key={comp.key}
                comp={comp}
                roleDetail={roleDetail}
              />
            ))}
          </div>
        </section>

        {/* Off-Box Copy & Procedures Guide */}
        <section
          aria-labelledby="disaster-recovery-title"
          className="border-line bg-surface rounded-xl border p-6"
        >
          <h3
            id="disaster-recovery-title"
            className="text-heading-3 text-ink font-semibold"
          >
            Disaster Recovery & Off-Box Copy
          </h3>
          <p className="text-muted mt-2 text-sm">
            Nexus web services operate in read-only mode regarding system
            backups. Backups and verification drills are executed exclusively by
            root systemd units.
          </p>

          <div className="border-line bg-surface-elevated text-ink mt-4 space-y-2 rounded-lg border p-4 font-mono text-xs">
            <div className="text-muted">
              # Off-box backup sync to secure local storage:
            </div>
            <div className="text-emerald-400">
              rsync -avz --progress -e ssh root@10.26.64.164:/var/backups/nexus/
              ~/ytl-nexus-backups/
            </div>
            <div className="text-muted"># Verify off-site checksums:</div>
            <div className="text-emerald-400">
              cd ~/ytl-nexus-backups/&lt;timestamp&gt; &amp;&amp; sha256sum -c
              SHA256SUMS
            </div>
          </div>

          <p className="text-muted mt-4 text-xs">
            Detailed recovery runbooks:{" "}
            <code className="text-ink">docs/operations/backup-restore.md</code>
          </p>
        </section>

        <RelatedModules slugs={["shield", "status", "data"]} className="mt-8" />
      </div>
    </PageTransition>
  );
}

function ComponentCard({
  comp,
  roleDetail,
}: {
  comp: ComponentItemView;
  roleDetail: boolean;
}) {
  const isVerified = comp.lastVerifiedRestore?.result === "ok";

  return (
    <article
      data-component-card={comp.key}
      className="border-line bg-surface hover:border-line-strong flex flex-col justify-between rounded-xl border p-5 transition-colors"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-muted font-mono text-[10px] tracking-wider uppercase">
              {comp.category}
            </span>
            <h4 className="text-ink text-base font-semibold">{comp.name}</h4>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium ${
              isVerified
                ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                : "border-line bg-surface-elevated text-muted border"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isVerified ? "bg-emerald-400" : "bg-muted"
              }`}
            />
            {isVerified ? "Verified" : "Pending drill"}
          </span>
        </div>

        {/* Verification result line */}
        <div className="text-ink mt-3 text-xs">
          <span className="text-muted">Last restore test: </span>
          {comp.lastVerifiedRestore ? (
            <span>
              {formatIso(comp.lastVerifiedRestore.testedAt)} (
              <span
                className={
                  comp.lastVerifiedRestore.result === "ok"
                    ? "text-emerald-400"
                    : "text-rose-400"
                }
              >
                {comp.lastVerifiedRestore.result.toUpperCase()}
              </span>
              )
            </span>
          ) : (
            <span className="text-muted">No test logged</span>
          )}
        </div>

        {/* Operator detail: size, digest, and restore steps */}
        {roleDetail && (
          <div
            data-operator-detail
            className="border-line mt-4 space-y-2 border-t pt-3"
          >
            <div className="flex justify-between text-xs">
              <span className="text-muted">Archive Size:</span>
              <span className="text-ink font-mono">
                {formatBytes(comp.sizeBytes)}
              </span>
            </div>

            {comp.lastBackupAgeHours !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-muted">Backup Age:</span>
                <span className="text-ink font-mono">
                  {comp.lastBackupAgeHours} h ago
                </span>
              </div>
            )}

            {comp.sha256 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted">SHA-256:</span>
                <span
                  className="text-ink max-w-[200px] truncate font-mono text-[11px]"
                  title={comp.sha256}
                >
                  {comp.sha256.slice(0, 16)}…
                </span>
              </div>
            )}

            {comp.lastVerifiedRestore?.detail && (
              <div className="border-line bg-surface-elevated text-muted rounded border p-2 text-[11px]">
                <span className="text-ink font-medium">Drill outcome: </span>
                {comp.lastVerifiedRestore.detail}
              </div>
            )}

            {comp.restoreSteps && comp.restoreSteps.length > 0 && (
              <div className="mt-2 pt-2">
                <span className="text-muted font-mono text-[10px] uppercase">
                  Restore Procedure:
                </span>
                <ol className="border-line bg-surface-elevated mt-1 space-y-1 rounded border p-2 font-mono text-[11px] text-emerald-400">
                  {comp.restoreSteps.map((step, idx) => (
                    <li key={idx} className="truncate">
                      {idx + 1}. {step}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
