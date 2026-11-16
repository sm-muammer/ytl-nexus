"use client";

import { useActionState, useState } from "react";
import { healthAction, restartAction } from "@/lib/server/ops-actions";
import { SubmitButton } from "@/components/auth/form-parts";

const ALLOWLISTED_UNITS = [
  {
    unit: "nexus-web",
    name: "Next.js Web Service",
    desc: "Main Node.js frontend and application server",
  },
  {
    unit: "nexus-worker",
    name: "Nexus Background Worker",
    desc: "Telemetry ingestion, shield posture scanner & sync",
  },
  {
    unit: "nexus-ops",
    name: "Nexus Operations Agent",
    desc: "Authenticated systemctl operations daemon",
  },
  {
    unit: "mariadb",
    name: "MariaDB SQL Engine",
    desc: "Core relational database",
  },
  {
    unit: "sftpgo",
    name: "SFTPGo Daemon",
    desc: "SFTP server and transfer storage backend",
  },
  {
    unit: "postfix",
    name: "Postfix Mail Server",
    desc: "SMTP mail transfer agent",
  },
  {
    unit: "dovecot",
    name: "Dovecot IMAP Server",
    desc: "Secure mailbox retrieval daemon",
  },
  {
    unit: "roundcube",
    name: "Roundcube Webmail",
    desc: "Webmail portal backend",
  },
  {
    unit: "wordpress",
    name: "WordPress (Studio)",
    desc: "Headless CMS publishing layer",
  },
  {
    unit: "prometheus",
    name: "Prometheus Telemetry",
    desc: "Time-series monitoring collector",
  },
  {
    unit: "node_exporter",
    name: "Node Exporter",
    desc: "Linux kernel and system performance metrics",
  },
  {
    unit: "ollama",
    name: "Ollama Assistant Engine",
    desc: "Local LLM model host",
  },
] as const;

function ServiceCard({
  item,
  demo = false,
}: {
  item: (typeof ALLOWLISTED_UNITS)[number];
  demo?: boolean;
}) {
  const [restartState, runRestart] = useActionState(restartAction, null);
  const [healthState, runHealth] = useActionState(healthAction, null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div
      className="border-line bg-surface-elevated flex flex-col justify-between rounded-xl border p-4 text-xs"
      data-service-card={item.unit}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="font-semibold text-slate-200">{item.name}</p>
          <code className="text-muted font-mono text-[11px]">{item.unit}</code>
        </div>
        <p className="text-muted mt-1 text-[11px] leading-relaxed">
          {item.desc}
        </p>
      </div>

      <div className="border-line mt-4 flex flex-col gap-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <form action={runHealth}>
            <input type="hidden" name="check" value={item.unit} />
            <SubmitButton variant="quiet" pendingLabel="Checking...">
              Check health
            </SubmitButton>
          </form>

          {!confirming ? (
            <button
              type="button"
              disabled={demo}
              onClick={() => setConfirming(true)}
              className="border-line hover:border-ink rounded-md border px-2.5 py-1 text-xs font-medium transition-colors"
            >
              Restart unit
            </button>
          ) : (
            <form action={runRestart} className="flex items-center gap-2">
              <input type="hidden" name="unit" value={item.unit} />
              <SubmitButton pendingLabel="Restarting...">
                {`Confirm restart ${item.unit}`}
              </SubmitButton>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-muted hover:text-ink text-xs underline"
              >
                Cancel
              </button>
            </form>
          )}
        </div>

        {/* Results */}
        <div role="status" aria-live="polite" className="text-[11px]">
          {healthState && "error" in healthState ? (
            <span className="text-bad-ink">{healthState.error}</span>
          ) : null}
          {healthState &&
          "done" in healthState &&
          healthState.done === "health" ? (
            <span
              className={
                healthState.state === "healthy"
                  ? "font-medium text-emerald-400"
                  : "font-medium text-amber-400"
              }
            >
              Health: {healthState.state} ({healthState.latencyMs}ms)
            </span>
          ) : null}

          {restartState && "error" in restartState ? (
            <span className="text-bad-ink">{restartState.error}</span>
          ) : null}
          {restartState &&
          "done" in restartState &&
          restartState.done === "restart" ? (
            <span className="font-medium text-emerald-400">
              Restart requested for {restartState.unit}.
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ControlServices({ demo = false }: { demo?: boolean }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="border-line bg-surface-elevated rounded-xl border p-4 text-xs">
        <h3 className="font-semibold text-slate-200">
          Nexus Ops Agent Allowlist (CTL-05)
        </h3>
        <p className="text-muted mt-1 leading-relaxed">
          Operational service actions are restricted to the validated allowlist
          below. Actions communicate with the local{" "}
          <code className="text-ink font-mono">nexus-ops</code> daemon using
          cryptographic HMAC-SHA256 request signatures with single-use nonces
          and 30-second clock-skew limits. Every operation is logged to the
          audit trail.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ALLOWLISTED_UNITS.map((item) => (
          <ServiceCard key={item.unit} item={item} demo={demo} />
        ))}
      </div>
    </div>
  );
}
