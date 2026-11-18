import { MODULES } from "@/lib/navigation/modules";

export type ConfigBinding = {
  name: string;
  protocol: string;
  address: string;
  exposure: "Loopback only" | "Internal reverse-proxy" | "Public (TLS)";
  purpose: string;
};

const BINDINGS: ConfigBinding[] = [
  {
    name: "Next.js Application",
    protocol: "HTTP/1.1",
    address: "127.0.0.1:3000",
    exposure: "Internal reverse-proxy",
    purpose: "YTL Nexus frontend, server functions and API route handlers",
  },
  {
    name: "MariaDB Database",
    protocol: "MySQL",
    address: "127.0.0.1:3306",
    exposure: "Loopback only",
    purpose: "Primary relational storage (ytl_nexus, mail, sftpgo, wordpress)",
  },
  {
    name: "Ollama LLM Engine",
    protocol: "HTTP",
    address: "127.0.0.1:11434",
    exposure: "Loopback only",
    purpose: "Local Gemma 3 inference and vector embeddings",
  },
  {
    name: "SFTPGo Web Admin",
    protocol: "HTTP",
    address: "127.0.0.1:8080",
    exposure: "Loopback only",
    purpose: "Internal SFTP account management API",
  },
  {
    name: "SFTP File Service",
    protocol: "SSH / SFTP",
    address: "0.0.0.0:2022",
    exposure: "Public (TLS)",
    purpose: "External secure file drop and client access",
  },
  {
    name: "Prometheus Metrics",
    protocol: "HTTP",
    address: "127.0.0.1:9090",
    exposure: "Loopback only",
    purpose: "Telemetry scraper and metric time-series store",
  },
  {
    name: "Node Exporter",
    protocol: "HTTP",
    address: "127.0.0.1:9100",
    exposure: "Loopback only",
    purpose: "Server hardware and OS telemetry provider",
  },
  {
    name: "Postfix SMTP",
    protocol: "SMTP / STARTTLS",
    address: "127.0.0.1:587",
    exposure: "Public (TLS)",
    purpose: "Mail transfer agent for Nexus pilot accounts",
  },
  {
    name: "Dovecot IMAP",
    protocol: "IMAP / TLS",
    address: "127.0.0.1:993",
    exposure: "Public (TLS)",
    purpose: "Secure mailbox delivery and retrieval",
  },
  {
    name: "Roundcube Webmail",
    protocol: "HTTP (PHP-FPM)",
    address: "127.0.0.1:8082",
    exposure: "Internal reverse-proxy",
    purpose: "Webmail portal under /webmail/",
  },
  {
    name: "WordPress / Nexus Studio",
    protocol: "HTTP (PHP-FPM)",
    address: "127.0.0.1:8081",
    exposure: "Internal reverse-proxy",
    purpose: "Headless content management under /studio/",
  },
  {
    name: "Nexus Ops Agent",
    protocol: "HTTP (Unix Socket / Loopback)",
    address: "127.0.0.1:9099",
    exposure: "Loopback only",
    purpose: "Controlled systemd restart and health operations allowlist",
  },
];

export function ControlConfig({ mode }: { mode: "live" | "demo" }) {
  return (
    <div className="flex flex-col gap-8">
      {/* Platform & Host Metadata */}
      <div className="border-line bg-surface-elevated grid gap-6 rounded-xl border p-6 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <span className="text-muted text-xs tracking-wider uppercase">
            Host Node
          </span>
          <p className="text-ink mt-1 text-base font-semibold">Nexus Core 01</p>
          <p className="text-muted text-xs">Rocky Linux 9.5 (Blue Onyx)</p>
        </div>

        <div>
          <span className="text-muted text-xs tracking-wider uppercase">
            Runtime Stack
          </span>
          <p className="text-ink mt-1 text-base font-semibold">
            Next.js 16.3.5 / Node {process.version}
          </p>
          <p className="text-muted text-xs">React 19, TypeScript Strict</p>
        </div>

        <div>
          <span className="text-muted text-xs tracking-wider uppercase">
            Platform Mode
          </span>
          <p className="text-ink mt-1 text-base font-semibold">
            {mode === "demo" ? "Demo Mode (Mock Fixtures)" : "Live Production"}
          </p>
          <p className="text-muted text-xs">
            {mode === "demo"
              ? "Zero outbound network calls"
              : "Connected to local systemd daemons"}
          </p>
        </div>

        <div>
          <span className="text-muted text-xs tracking-wider uppercase">
            Domain & IP
          </span>
          <p className="text-ink mt-1 text-base font-semibold">
            ytl-nexus.ytlcomms.my
          </p>
          <p className="text-muted text-xs">10.26.64.164 (Intranet)</p>
        </div>
      </div>

      {/* Security Principles Notice (Non-Secret Assurance) */}
      <div className="border-line bg-surface-elevated rounded-xl border p-5">
        <h3 className="text-ink text-sm font-semibold">
          Non-Secret Policy & Zero-Exposure Guarantee
        </h3>
        <p className="text-muted mt-2 text-xs leading-relaxed">
          In strict compliance with requirement <strong>CTL-06</strong>, this
          configuration viewer displays only operational topology, software
          versions, and network bindings. Secret keys (database credentials,
          HMAC secrets, and TLS private keys) reside exclusively in isolated{" "}
          <code className="text-ink font-mono">/etc/ytl-nexus/*.env</code> files
          with 0600 root permissions on Nexus Core 01. Secrets can be rotated on
          the host, but are never exposed in browser views or API payloads.
        </p>
      </div>

      {/* Network Bindings & Daemons */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">Service Bindings & Ports</h3>
          <span className="text-muted text-xs">
            All database & backend endpoints loopback-isolated (127.0.0.1)
          </span>
        </div>

        <div
          tabIndex={0}
          role="region"
          aria-label="Service Bindings and Ports"
          className="border-line overflow-x-auto rounded-xl border"
        >
          <table className="w-full text-left text-xs">
            <thead className="border-line bg-surface-elevated/70 border-b font-medium text-slate-300">
              <tr>
                <th className="px-4 py-3">Service Name</th>
                <th className="px-4 py-3">Protocol</th>
                <th className="px-4 py-3">Binding Address</th>
                <th className="px-4 py-3">Network Exposure</th>
                <th className="px-4 py-3">Role / Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {BINDINGS.map((b) => (
                <tr
                  key={b.name}
                  className="hover:bg-surface-elevated/40 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-slate-200">
                    {b.name}
                  </td>
                  <td className="text-muted px-4 py-3 font-mono">
                    {b.protocol}
                  </td>
                  <td className="px-4 py-3 font-mono text-sky-300">
                    {b.address}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        b.exposure === "Loopback only"
                          ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : b.exposure === "Internal reverse-proxy"
                            ? "border border-sky-500/30 bg-sky-500/10 text-sky-300"
                            : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                      }`}
                    >
                      {b.exposure}
                    </span>
                  </td>
                  <td className="text-muted max-w-sm px-4 py-3">{b.purpose}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enabled Modules Directory */}
      <div className="flex flex-col gap-3">
        <h3 className="text-base font-semibold">Registered Platform Modules</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((m) => (
            <div
              key={m.slug}
              className="border-line bg-surface-elevated/40 rounded-lg border p-3 text-xs"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-200">{m.name}</p>
                <span className="text-muted text-[10px] font-bold uppercase">
                  {m.minRole ?? "Public"}
                </span>
              </div>
              <p className="text-muted mt-1 line-clamp-1 text-[11px]">
                {m.subtitle}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
