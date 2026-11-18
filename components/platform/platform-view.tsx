import Link from "next/link";
import { Rise } from "@/components/motion/reveal";
import { StatusBadge } from "@/components/ui/status-badge";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { RelatedModules } from "@/components/layout/related-modules";
import { MODULES, type ModuleInfo } from "@/lib/navigation/modules";
import { accessLabel } from "@/lib/roles";
import type { AdapterName, AdapterStatus } from "@/lib/server/adapters/types";

export type SubsystemStatusItem = {
  key: AdapterName;
  name: string;
  status: AdapterStatus;
};

const serviceLabels: Record<AdapterName, { title: string; role: string }> = {
  db: {
    title: "MariaDB Relational Store",
    role: "5 isolated logical databases (ytl_nexus, wordpress, roundcube, sftpgo, mail)",
  },
  auth: {
    title: "Authentication Engine",
    role: "Better Auth session management, TOTP 2FA, and RBAC enforcement",
  },
  wordpress: {
    title: "Nexus Studio & Content API",
    role: "Headless WordPress REST API, webhook revalidation, runbook store",
  },
  prometheus: {
    title: "Prometheus Telemetry",
    role: "Time-series collection from node_exporter and service endpoints",
  },
  ollama: {
    title: "Ollama Local AI Inference",
    role: "Local Gemma and TinyLlama inference on CPU, embeddings, RAG pipeline",
  },
  sftpgo: {
    title: "SFTPGo Transfer Engine",
    role: "SFTP on port 2022, WebClient, WebAdmin, and user provisioning API",
  },
  ops: {
    title: "Nexus Operations Agent",
    role: "Privilege-separated Unix socket daemon with polkit restart rules",
  },
  mail: {
    title: "Virtual Mail Subsystem",
    role: "Postfix submission (587), Dovecot IMAPS (993), and Roundcube webmail",
  },
};

const trustBoundaries = [
  {
    id: "boundary-network",
    title: "Network & Ingress",
    subtitle: "Firewall & Port Isolation",
    badge: "Boundary 1",
    principle: "Strict Port Allowlist",
    description:
      "Only 6 firewall ports are open to external or office traffic: 22 (SSH), 80 (HTTP redirect), 443 (HTTPS TLS), 2022 (SFTP), 587 (Mail Submission), and 993 (IMAPS). All databases, AI models, metrics listeners, and ops daemons are strictly bound to loopback 127.0.0.1 or Unix sockets.",
    tech: ["firewalld", "127.0.0.1", "ens3 interface", "fail2ban"],
  },
  {
    id: "boundary-gateway",
    title: "Reverse Proxy & Gateway",
    subtitle: "Apache 2.4 SSL Termination",
    badge: "Boundary 2",
    principle: "Single Web Entrypoint",
    description:
      "Apache is the sole public web gateway. It terminates TLS using internal CA SAN certificates, enforces modern security headers (strict CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff), and performs path-based routing to internal loopback daemons.",
    tech: ["Apache 2.4", "mod_ssl", "mod_proxy_http", "PHP-FPM Unix Sockets"],
  },
  {
    id: "boundary-auth",
    title: "Application Authorization",
    subtitle: "Server-Side Verification",
    badge: "Boundary 3",
    principle: "Zero Trust Navigation",
    description:
      "Every single Next.js page, Route Handler, and Server Action independently invokes requireRole() and validates payload schemas with Zod. Navigation links merely guide the user interface; access control is never delegated to hidden URLs or client-side checks.",
    tech: [
      "Server Components",
      "requireRole()",
      "Zod Validation",
      "Better Auth",
    ],
  },
  {
    id: "boundary-ops",
    title: "System Operations",
    subtitle: "Privilege Separation",
    badge: "Boundary 4",
    principle: "No Web Shell Access",
    description:
      "The web application has no sudo rights and no interactive shell access. Host operations execute via a dedicated nexus-ops daemon on a protected Unix socket with HMAC-SHA256 signatures, bounded timestamps, nonces, and Linux polkit rules allowing restarts only for an explicit unit allowlist.",
    tech: [
      "Unix Domain Socket",
      "HMAC Signatures",
      "polkit rules",
      "C/Go Daemon",
    ],
  },
  {
    id: "boundary-data",
    title: "Data Isolation",
    subtitle: "Multi-Tenant Schemas",
    badge: "Boundary 5",
    principle: "Segregated Credentials",
    description:
      "MariaDB 10.5 hosts five isolated databases (ytl_nexus, nexus_wordpress, nexus_roundcube, nexus_sftpgo, nexus_mail). Each subsystem connects using distinct least-privilege credentials read from protected /etc/ytl-nexus/*.env files, preventing cross-database access.",
    tech: [
      "MariaDB 10.5",
      "Kysely Migrations",
      "Strict Grants",
      "Protected .env",
    ],
  },
  {
    id: "boundary-scans",
    title: "Root Timers & Scans",
    subtitle: "Unidirectional Reporting",
    badge: "Boundary 6",
    principle: "Read-Only Web Consumer",
    description:
      "Automated backups, weekly verification restore drills into scratch databases, and comprehensive security posture scans run under isolated systemd root timers. They write tamper-evident JSON reports or INSERT-only audit entries that the unprivileged web application can only read.",
    tech: [
      "systemd.timer",
      "mariadb-dump",
      "nexus-shield-scan",
      "Scratch DB Drills",
    ],
  },
];

const runtimeServices = [
  {
    name: "nexus-web",
    unit: "nexus-web.service",
    user: "nexus",
    listen: "127.0.0.1:3000",
    role: "Next.js 16.3.5 web application, React 19 Server Components, App Router, and Tailwind CSS v4 design system.",
    category: "Application",
  },
  {
    name: "nexus-worker",
    unit: "nexus-worker.service",
    user: "nexus",
    listen: "Internal daemon",
    role: "Background worker handling AI document chunking, embeddings, scheduled health polling, and security report ingestion.",
    category: "Application",
  },
  {
    name: "nexus-ops",
    unit: "nexus-ops.service",
    user: "nexus-ops",
    listen: "/run/nexus-ops/ops.sock",
    role: "Privilege-separated operations agent executing allowlisted unit restarts, bounded logs, and pre-defined health probes.",
    category: "Operations",
  },
  {
    name: "httpd (Apache)",
    unit: "httpd.service",
    user: "apache",
    listen: "0.0.0.0:80, :443",
    role: "Public reverse proxy, TLS termination with SAN certificates, path-based routing to Next.js, WordPress, and Roundcube.",
    category: "Gateway",
  },
  {
    name: "MariaDB",
    unit: "mariadb.service",
    user: "mysql",
    listen: "127.0.0.1:3306",
    role: "Relational storage across 5 segregated databases with parameterized queries and transactional safety.",
    category: "Data",
  },
  {
    name: "Prometheus & Exporters",
    unit: "prometheus.service",
    user: "prometheus",
    listen: "127.0.0.1:9090",
    role: "Time-series metrics engine scraping node_exporter (127.0.0.1:9100) and SFTPGo (127.0.0.1:10000) with 15-day retention.",
    category: "Observability",
  },
  {
    name: "Ollama Local AI",
    unit: "ollama.service",
    user: "ollama",
    listen: "127.0.0.1:11434",
    role: "Grounded local AI inference running Gemma and TinyLlama models on CPU with cosine vector search.",
    category: "Intelligence",
  },
  {
    name: "SFTPGo",
    unit: "sftpgo.service",
    user: "sftpgo",
    listen: "0.0.0.0:2022, 127.0.0.1:8090/8091",
    role: "Secure file transfer daemon on port 2022, WebClient at /files, and REST API for user filesystem provisioning.",
    category: "Transfer",
  },
  {
    name: "Postfix & Dovecot",
    unit: "postfix.service, dovecot.service",
    user: "postfix / dovecot",
    listen: "0.0.0.0:587, :993",
    role: "Virtual mail domain (ytl-nexus.internal), LMTP mail delivery, authenticated submission, and IMAPS storage.",
    category: "Mail",
  },
  {
    name: "PHP-FPM Pools",
    unit: "php-fpm.service",
    user: "wordpress / roundcube",
    listen: "Unix domain sockets",
    role: "Isolated FastCGI execution pools powering headless WordPress (/studio) and Roundcube Webmail (/webmail).",
    category: "Services",
  },
  {
    name: "Root Timers",
    unit: "nexus-backup.timer, nexus-shield-scan.timer",
    user: "root",
    listen: "systemd scheduled",
    role: "Automated daily backups, weekly database restore drills, and 12-factor security posture scans.",
    category: "Governance",
  },
];

const topologyLayers = [
  {
    layer: "Client & Ingress Layer",
    description:
      "External clients and office networks connect exclusively through protected ports",
    nodes: [
      {
        name: "Public HTTPS & HTTP",
        port: "Ports 80 & 443",
        target: "Apache Reverse Proxy",
        protocol: "TLS 1.3 / HTTP/2",
        note: "Port 80 permanently redirects to HTTPS with strict HSTS",
      },
      {
        name: "Secure SFTP",
        port: "Port 2022",
        target: "SFTPGo Daemon",
        protocol: "SSH / SFTP",
        note: "Virtual user accounts with chrooted storage on /srv/nexus-transfer",
      },
      {
        name: "Authenticated Mail",
        port: "Ports 587 & 993",
        target: "Postfix & Dovecot",
        protocol: "Submission & IMAPS",
        note: "Encrypted virtual mail delivery for ytl-nexus.internal",
      },
    ],
  },
  {
    layer: "Gateway & Routing Layer",
    description:
      "Apache 2.4 terminates SSL and proxies traffic based on path prefixes",
    nodes: [
      {
        name: "/* (Platform & APIs)",
        port: "127.0.0.1:3000",
        target: "nexus-web (Next.js)",
        protocol: "Reverse Proxy",
        note: "All 16 Nexus modules, Server Functions, and REST endpoints",
      },
      {
        name: "/studio (Nexus Studio)",
        port: "unix:/run/php-fpm/wordpress.sock",
        target: "WordPress CMS",
        protocol: "FastCGI / PHP 8.3",
        note: "Headless content authoring with signed revalidation webhooks",
      },
      {
        name: "/webmail (Nexus Webmail)",
        port: "unix:/run/php-fpm/roundcube.sock",
        target: "Roundcube Webmail",
        protocol: "FastCGI / PHP 8.3",
        note: "Roundcube Elastic webmail skin with IMAPS loopback backend",
      },
      {
        name: "/files (Web Transfer)",
        port: "127.0.0.1:8090",
        target: "SFTPGo WebClient",
        protocol: "Reverse Proxy",
        note: "Browser-based file manager backed by SFTPGo REST API",
      },
    ],
  },
  {
    layer: "Loopback Core Services (127.0.0.1)",
    description:
      "All persistent databases, metrics, AI inference, and ops daemons listen exclusively on loopback",
    nodes: [
      {
        name: "MariaDB Relational Store",
        port: "127.0.0.1:3306",
        target: "ytl_nexus + 4 databases",
        protocol: "MySQL Native",
        note: "5 isolated schemas with parameterized queries and strict credentials",
      },
      {
        name: "Prometheus & Node Exporter",
        port: "127.0.0.1:9090 & :9100",
        target: "Host & App Metrics",
        protocol: "PromQL / SSE",
        note: "15-day time-series telemetry fanned out via Server-Sent Events",
      },
      {
        name: "Ollama Local AI Inference",
        port: "127.0.0.1:11434",
        target: "Gemma & TinyLlama",
        protocol: "REST / Stream",
        note: "On-device CPU inference with in-memory cosine vector search",
      },
      {
        name: "Nexus Operations Agent",
        port: "unix:/run/nexus-ops/ops.sock",
        target: "Linux polkit rules",
        protocol: "HMAC Unix Socket",
        note: "Allowlisted service restarts, bounded log tailing, health checks",
      },
    ],
  },
];

const moduleCategories: {
  category: string;
  description: string;
  slugs: string[];
}[] = [
  {
    category: "Explore",
    description: "Showcase, portfolio, and public orientation modules",
    slugs: ["platform", "tour", "story", "library"],
  },
  {
    category: "Operate",
    description:
      "Server metrics, real-time observability, and live dependency topology",
    slugs: ["command", "atlas", "data", "status"],
  },
  {
    category: "Services",
    description:
      "Content publishing, local artificial intelligence, mail, and file transfers",
    slugs: ["studio", "transfer", "mail", "ai", "yes"],
  },
  {
    category: "Govern",
    description:
      "Automated resilience drills, security posture audits, and platform administration",
    slugs: ["shield", "continuity", "control"],
  },
];

export function PlatformView({
  statuses,
}: {
  statuses: SubsystemStatusItem[];
}) {
  return (
    <div className="space-y-20 px-(--spacing-gutter) py-12">
      {/* Narrative Framing */}
      <section
        aria-labelledby="platform-framing-heading"
        className="border-border-strong border-l-2 pl-6"
      >
        <Rise>
          <div className="flex flex-wrap items-center gap-3">
            <span className="bg-accent-ink/10 text-accent-ink border-accent-ink/20 rounded-full border px-3 py-1 font-mono text-xs font-semibold tracking-wide uppercase">
              Nexus Core 01 Topology
            </span>
            <span className="text-muted text-sm">
              Rocky Linux 9 &bull; One Server &bull; 16 Modules
            </span>
          </div>
          <h2
            id="platform-framing-heading"
            className="text-heading-2 font-display text-ink mt-4 font-semibold tracking-tight text-balance"
          >
            One Hardened Host. Six Protective Boundaries. Complete Systems
            Integration.
          </h2>
          <p className="text-muted text-lead mt-4 max-w-4xl text-pretty">
            YTL Nexus demonstrates how modern web architecture, headless CMS
            publishing, internal mail, secure file exchange, local AI inference,
            and real-time server telemetry can co-exist safely on a single
            production host without messy interdependencies or security
            compromises.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            <a
              href="#topology-section"
              className="border-border-strong hover:bg-surface-raised inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors"
            >
              Explore Topology
            </a>
            <a
              href="#trust-boundaries-section"
              className="border-border-strong hover:bg-surface-raised inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors"
            >
              Trust Boundaries
            </a>
            <a
              href="#subsystems-health-section"
              className="border-border-strong hover:bg-surface-raised inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors"
            >
              Live Health
            </a>
            <a
              href="#modules-section"
              className="border-border-strong hover:bg-surface-raised inline-flex min-h-11 items-center rounded-full border px-5 text-sm font-medium transition-colors"
            >
              16 Modules
            </a>
          </div>
        </Rise>
      </section>

      {/* System Architecture Topology */}
      <section
        id="topology-section"
        role="region"
        aria-labelledby="topology-heading"
        className="space-y-8"
      >
        <Rise>
          <div>
            <span className="text-accent-ink text-xs font-semibold tracking-wider uppercase">
              System Architecture
            </span>
            <h2
              id="topology-heading"
              className="text-heading-2 font-display text-ink mt-2 font-semibold tracking-tight"
            >
              Network Topology & Ingress Flow
            </h2>
            <p className="text-muted mt-2 max-w-3xl text-sm">
              How requests enter Nexus Core 01 from external or LAN clients,
              terminate at the Apache TLS gateway, and route securely into
              isolated loopback listeners.
            </p>
          </div>
        </Rise>

        <div className="grid gap-8 lg:grid-cols-3">
          {topologyLayers.map((layer, idx) => (
            <Rise key={layer.layer} delay={idx * 0.1}>
              <div className="border-line bg-surface/70 flex h-full flex-col justify-between rounded-2xl border p-6 shadow-sm backdrop-blur-xs">
                <div>
                  <div className="flex items-center justify-between border-b border-white/5 pb-4">
                    <span className="bg-surface-raised text-muted border-line rounded-md border px-2.5 py-1 font-mono text-xs font-medium">
                      Tier {idx + 1}
                    </span>
                    <span className="text-muted text-xs font-semibold uppercase">
                      {idx === 0
                        ? "Public Perimeter"
                        : idx === 1
                          ? "Web Gateway"
                          : "Loopback Only"}
                    </span>
                  </div>
                  <h3 className="text-ink mt-4 text-lg font-semibold">
                    {layer.layer}
                  </h3>
                  <p className="text-muted mt-1 text-xs">{layer.description}</p>

                  <div className="mt-6 space-y-4">
                    {layer.nodes.map((node) => (
                      <div
                        key={node.name}
                        className="border-line bg-canvas/60 rounded-xl border p-4 transition-all hover:border-white/20"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-ink text-sm font-semibold">
                            {node.name}
                          </span>
                          <span className="rounded bg-sky-500/10 px-2 py-0.5 font-mono text-[11px] font-medium text-sky-400">
                            {node.port}
                          </span>
                        </div>
                        <div className="text-muted mt-2 flex items-center justify-between text-xs">
                          <span>Target:</span>
                          <span className="text-ink font-mono font-medium">
                            {node.target}
                          </span>
                        </div>
                        <p className="text-muted mt-2 border-t border-white/5 pt-2 text-[11px] leading-relaxed">
                          {node.note}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4 text-center">
                  <span className="text-muted font-mono text-[11px]">
                    {idx < 2
                      ? "↓ Proxies to internal layer"
                      : "Strict 127.0.0.1 bound"}
                  </span>
                </div>
              </div>
            </Rise>
          ))}
        </div>
      </section>

      {/* Trust Boundaries */}
      <section
        id="trust-boundaries-section"
        role="region"
        aria-labelledby="trust-boundaries-heading"
        className="space-y-8"
      >
        <Rise>
          <div>
            <span className="text-accent-ink text-xs font-semibold tracking-wider uppercase">
              Zero Trust Design
            </span>
            <h2
              id="trust-boundaries-heading"
              className="text-heading-2 font-display text-ink mt-2 font-semibold tracking-tight"
            >
              The Six Core Trust Boundaries
            </h2>
            <p className="text-muted mt-2 max-w-3xl text-sm">
              Each boundary protects against a specific failure mode. Even if
              one subsystem experiences degraded behavior, defensive isolation
              prevents lateral movement or privilege escalation.
            </p>
          </div>
        </Rise>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {trustBoundaries.map((b, idx) => (
            <Rise key={b.id} delay={idx * 0.05}>
              <article
                className="border-line bg-surface/60 hover:bg-surface flex h-full flex-col justify-between rounded-xl border p-6 transition-all duration-200"
                aria-labelledby={`tb-title-${b.id}`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="bg-accent-ink/10 text-accent-ink border-accent-ink/20 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold">
                      {b.badge}
                    </span>
                    <span className="text-muted font-mono text-xs">
                      {b.principle}
                    </span>
                  </div>
                  <h3
                    id={`tb-title-${b.id}`}
                    className="text-ink mt-4 text-base font-semibold"
                  >
                    {b.title}
                  </h3>
                  <p className="text-muted mt-0.5 font-mono text-xs">
                    {b.subtitle}
                  </p>
                  <p className="text-muted mt-4 text-xs leading-relaxed">
                    {b.description}
                  </p>
                </div>

                <div className="mt-6 border-t border-white/5 pt-4">
                  <div className="flex flex-wrap gap-1.5">
                    {b.tech.map((t) => (
                      <span
                        key={t}
                        className="bg-surface-raised text-muted border-line rounded px-2 py-0.5 text-[10px] font-medium"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            </Rise>
          ))}
        </div>
      </section>

      {/* Subsystems Live Status */}
      <section
        id="subsystems-health-section"
        role="region"
        aria-labelledby="subsystem-health-heading"
        className="space-y-6"
      >
        <Rise>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="text-accent-ink text-xs font-semibold tracking-wider uppercase">
                Active Telemetry
              </span>
              <h2
                id="subsystem-health-heading"
                className="text-heading-2 font-display text-ink mt-2 font-semibold tracking-tight"
              >
                Subsystem Health & Live Adapters
              </h2>
              <p className="text-muted mt-2 max-w-2xl text-sm">
                Real-time status probes for all eight backing adapters. In live
                production on Nexus Core 01, these query local daemons over
                loopback; in demo mode, they read validated deterministic
                fixtures.
              </p>
            </div>
            {statuses[0] && (
              <div className="mt-2 sm:mt-0">
                <LiveDemoLabel source={statuses[0].status.source} />
              </div>
            )}
          </div>
        </Rise>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {statuses.map((item, idx) => {
            const meta = serviceLabels[item.key] ?? {
              title: item.name,
              role: "Subsystem adapter",
            };
            return (
              <Rise key={item.key} delay={idx * 0.04}>
                <div className="border-line bg-surface/60 flex h-full flex-col justify-between rounded-xl border p-5">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-ink truncate text-sm font-semibold">
                        {meta.title}
                      </span>
                      <StatusBadge
                        status={item.status.state}
                        label={item.status.label}
                      />
                    </div>
                    <p className="text-muted mt-3 text-xs leading-relaxed">
                      {item.status.detail}
                    </p>
                  </div>
                  <div className="text-muted mt-4 flex items-center justify-between border-t border-white/5 pt-3 text-[11px]">
                    <span className="font-mono text-xs">{item.key}</span>
                    <LiveDemoLabel source={item.status.source} short />
                  </div>
                </div>
              </Rise>
            );
          })}
        </div>
      </section>

      {/* Runtime Services Inventory */}
      <section
        id="runtime-services-section"
        role="region"
        aria-labelledby="runtime-services-heading"
        className="space-y-6"
      >
        <Rise>
          <div>
            <span className="text-accent-ink text-xs font-semibold tracking-wider uppercase">
              Host Environment
            </span>
            <h2
              id="runtime-services-heading"
              className="text-heading-2 font-display text-ink mt-2 font-semibold tracking-tight"
            >
              Runtime Services Inventory
            </h2>
            <p className="text-muted mt-2 max-w-3xl text-sm">
              All daemons and systemd background units executing on Rocky Linux
              Nexus Core 01, with unprivileged service accounts, socket
              bindings, and operational roles.
            </p>
          </div>
        </Rise>

        <div className="border-line bg-surface/50 overflow-hidden rounded-xl border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-line bg-surface text-muted border-b text-xs uppercase">
                <tr>
                  <th scope="col" className="px-6 py-4 font-semibold">
                    Service / Unit
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold">
                    System User
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold">
                    Listen Address
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold">
                    Category
                  </th>
                  <th scope="col" className="px-6 py-4 font-semibold">
                    Responsibility
                  </th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y text-xs">
                {runtimeServices.map((svc) => (
                  <tr
                    key={svc.name}
                    className="hover:bg-surface/60 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="text-ink font-semibold">{svc.name}</div>
                      <div className="text-muted font-mono text-[11px]">
                        {svc.unit}
                      </div>
                    </td>
                    <td className="text-muted px-6 py-4 font-mono">
                      {svc.user}
                    </td>
                    <td className="px-6 py-4 font-mono text-sky-400">
                      {svc.listen}
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-surface-raised text-muted border-line rounded px-2 py-0.5 text-[10px] font-medium uppercase">
                        {svc.category}
                      </span>
                    </td>
                    <td className="text-muted max-w-md px-6 py-4 leading-relaxed">
                      {svc.role}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 16 Unified Modules Ecosystem */}
      <section
        id="modules-section"
        role="region"
        aria-labelledby="unified-modules-heading"
        className="space-y-8"
      >
        <Rise>
          <div>
            <span className="text-accent-ink text-xs font-semibold tracking-wider uppercase">
              Modular Architecture
            </span>
            <h2
              id="unified-modules-heading"
              className="text-heading-2 font-display text-ink mt-2 font-semibold tracking-tight"
            >
              The 16 Unified Platform Modules
            </h2>
            <p className="text-muted mt-2 max-w-3xl text-sm">
              All 16 functional modules share a unified design system,
              centralized session management, and coordinated security controls
              across four operational tiers.
            </p>
          </div>
        </Rise>

        <div className="space-y-12">
          {moduleCategories.map((cat) => {
            const categoryModules = cat.slugs
              .map((slug) => MODULES.find((m) => m.slug === slug))
              .filter(Boolean) as ModuleInfo[];

            return (
              <div key={cat.category} className="space-y-4">
                <div className="border-b border-white/5 pb-2">
                  <h3 className="text-ink text-lg font-semibold">
                    {cat.category}
                  </h3>
                  <p className="text-muted mt-0.5 text-xs">{cat.description}</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {categoryModules.map((m) => {
                    const isApache = m.apacheServed;
                    const cardContent = (
                      <div className="border-line bg-surface/60 hover:bg-surface flex h-full flex-col justify-between rounded-xl border p-5 transition-all hover:border-white/20">
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-ink group-hover:text-accent-ink text-sm font-semibold">
                              {m.name}
                            </span>
                            <span className="rounded bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300 uppercase">
                              {accessLabel(m.minRole)}
                            </span>
                          </div>
                          <p className="text-muted mt-1 font-mono text-[11px]">
                            {m.href}
                          </p>
                          <p className="text-muted mt-3 text-xs leading-relaxed">
                            {m.summary}
                          </p>
                        </div>

                        <div className="text-muted mt-5 flex items-center justify-between border-t border-white/5 pt-3 text-xs">
                          <span className="font-mono text-[11px]">
                            Task {m.task}
                          </span>
                          <span className="text-ink inline-flex min-h-11 items-center font-medium group-hover:underline">
                            Open &rarr;
                          </span>
                        </div>
                      </div>
                    );

                    return isApache ? (
                      <a key={m.slug} href={m.href} className="group block">
                        {cardContent}
                      </a>
                    ) : (
                      <Link key={m.slug} href={m.href} className="group block">
                        {cardContent}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Connected Subsystems Navigation */}
      <section aria-label="Connected Subsystems" className="pt-6">
        <RelatedModules
          slugs={["tour", "story", "command", "atlas", "status"]}
          title="Related Modules & Exploration"
        />
      </section>
    </div>
  );
}
