import type { ContentItem } from "@/lib/content/types";
import type { Accent } from "@/lib/navigation/modules";
import type { Role } from "@/lib/roles";

export const TOUR_CHAPTERS = [
  "Overview",
  "Operate",
  "Services",
  "Assure",
  "Govern",
  "Showcase",
] as const;

export type TourChapter = (typeof TOUR_CHAPTERS)[number];

export type TourVisualPreview =
  | {
      kind: "architecture";
      badge: string;
      tiers: readonly { tag: string; title: string; detail: string }[];
      footerStats: readonly { label: string; value: string }[];
    }
  | {
      kind: "telemetry";
      badge: string;
      metrics: readonly {
        label: string;
        value: string;
        note: string;
        status?: "ok" | "warn";
      }[];
      series: readonly number[];
      seriesLabel: string;
      caption: string;
    }
  | {
      kind: "topology";
      badge: string;
      hub: string;
      nodes: readonly {
        id: string;
        label: string;
        group: "data" | "edge" | "ops";
        status: string;
      }[];
      footnote: string;
    }
  | {
      kind: "conversation";
      badge: string;
      header: string;
      entries: readonly {
        label: string;
        text: string;
        meta?: string;
        tone?: "user" | "assistant" | "tag";
      }[];
      chips: readonly string[];
    }
  | {
      kind: "records";
      badge: string;
      columns: readonly [string, string, string];
      rows: readonly {
        col1: string;
        col2: string;
        col3: string;
        state?: "ok" | "neutral";
      }[];
      meter?: { label: string; percent: number; valueText: string };
    }
  | {
      kind: "assurance";
      badge: string;
      summary: string;
      checks: readonly {
        label: string;
        state: "verified" | "tracked" | "enforced";
        detail: string;
      }[];
      footnote: string;
    };

export type TourSlideMeta = {
  slug: string;
  chapter: TourChapter;
  accent: Accent;
  minRole: Role | null;
  moduleHref: string | null;
  moduleLabel: string | null;
  hiddenNote?: string;
  highlights: readonly [string, string, string];
  preview: TourVisualPreview;
};

const SLIDE_META_BY_SLUG: Record<string, TourSlideMeta> = {
  "tour-01-welcome": {
    slug: "tour-01-welcome",
    chapter: "Overview",
    accent: "pink",
    minRole: null,
    moduleHref: "/platform",
    moduleLabel: "Explore architecture",
    highlights: [
      "Unifies infrastructure, AI, SFTP, mail, data and content on one Rocky Linux server",
      "Enforces server-side RBAC, Zod validation and audit logging on every mutation",
      "Runs identically on live infrastructure or deterministic offline demo fixtures",
    ],
    preview: {
      kind: "architecture",
      badge: "3-Tier Single-Host Stack",
      tiers: [
        {
          tag: "Tier 1 · Edge",
          title: "Apache TLS Reverse Proxy",
          detail:
            "Terminates HTTPS on 443 and path-routes Next.js, /studio, /webmail and /files.",
        },
        {
          tag: "Tier 2 · Core",
          title: "Next.js 16 + Better Auth",
          detail:
            "Server Components, per-request CSP nonces and requireRole() boundary checks.",
        },
        {
          tag: "Tier 3 · Loopback",
          title: "Isolated Host Daemons",
          detail:
            "MariaDB, Prometheus, Ollama, SFTPGo, Postfix/Dovecot and nexus-ops socket.",
        },
      ],
      footerStats: [
        { label: "Modules", value: "15" },
        { label: "Host", value: "Nexus Core 01" },
        { label: "Modes", value: "Live / Demo" },
      ],
    },
  },
  "tour-02-command": {
    slug: "tour-02-command",
    chapter: "Operate",
    accent: "blue",
    minRole: "viewer",
    moduleHref: "/command",
    moduleLabel: "Open Nexus Command",
    highlights: [
      "Streams CPU, memory, disk I/O and network throughput via Prometheus telemetry",
      "Provides 1h, 6h, 24h and 7d time-range charts paired with accessible data tables",
      "Powers a health-reactive particle field summarizing service readiness at a glance",
    ],
    preview: {
      kind: "telemetry",
      badge: "Host Telemetry Snapshot",
      metrics: [
        {
          label: "CPU Load",
          value: "18.4%",
          note: "4 vCPU · steady",
          status: "ok",
        },
        {
          label: "Memory",
          value: "6.2 / 16 GB",
          note: "Page cache warm",
          status: "ok",
        },
        {
          label: "Disk Root",
          value: "41%",
          note: "sdb mounted noexec",
          status: "ok",
        },
        {
          label: "Services",
          value: "9 / 9",
          note: "Loopback bound",
          status: "ok",
        },
      ],
      series: [24, 21, 19, 22, 26, 20, 18, 17, 19, 21, 18, 18],
      seriesLabel: "Sample CPU trend (last 60 min)",
      caption: "Prometheus node_exporter + systemd probes on loopback",
    },
  },
  "tour-03-atlas": {
    slug: "tour-03-atlas",
    chapter: "Operate",
    accent: "blue",
    minRole: "viewer",
    moduleHref: "/command/atlas",
    moduleLabel: "Open Nexus Atlas",
    highlights: [
      "Maps upstream dependencies and downstream blast radius across 9 host services",
      "Pairs live health states with plain-language impact explanations for operators",
      "Links every service node directly to its Library runbook and Status history",
    ],
    preview: {
      kind: "topology",
      badge: "Service Dependency Graph",
      hub: "nexus-web · Next.js 16",
      nodes: [
        { id: "db", label: "MariaDB", group: "data", status: "Healthy" },
        { id: "prom", label: "Prometheus", group: "ops", status: "Healthy" },
        { id: "ollama", label: "Ollama AI", group: "ops", status: "Healthy" },
        { id: "sftp", label: "SFTPGo", group: "edge", status: "Healthy" },
        { id: "wp", label: "WordPress", group: "data", status: "Healthy" },
        { id: "mail", label: "Mail Stack", group: "edge", status: "Healthy" },
      ],
      footnote: "Directed edges reveal impact before any service restart",
    },
  },
  "tour-04-status": {
    slug: "tour-04-status",
    chapter: "Operate",
    accent: "blue",
    minRole: null,
    moduleHref: "/status",
    moduleLabel: "Open Nexus Status",
    highlights: [
      "Publishes a sanitized public summary without exposing hostnames, IPs or logs",
      "Tracks 30-day rolling uptime records alongside incident timeline updates",
      "Grants Operators audited incident creation, status updates and resolution flows",
    ],
    preview: {
      kind: "telemetry",
      badge: "30-Day Availability & Notices",
      metrics: [
        {
          label: "Public View",
          value: "Operational",
          note: "Sanitized summary",
          status: "ok",
        },
        {
          label: "30d Uptime",
          value: "99.95%",
          note: "Probe interval 60s",
          status: "ok",
        },
        {
          label: "Open Incidents",
          value: "0",
          note: "Operator managed",
          status: "ok",
        },
        {
          label: "Notices",
          value: "Active",
          note: "Synced from Studio",
          status: "ok",
        },
      ],
      series: [98, 100, 100, 99, 100, 100, 100, 97, 100, 100, 100, 100],
      seriesLabel: "30-day check pass rate",
      caption: "Public visitors see status only; Viewers+ see full timeline",
    },
  },
  "tour-05-ai": {
    slug: "tour-05-ai",
    chapter: "Services",
    accent: "violet",
    minRole: "member",
    moduleHref: "/ai",
    moduleLabel: "Open Nexus AI",
    highlights: [
      "Runs locally via Ollama (Gemma 3) with zero external AI data egress",
      "Filters indexed Library chunks by audience before ranking so visitors stay isolated",
      "Streams answers with verifiable runbook citations and Explain mode integration",
    ],
    preview: {
      kind: "conversation",
      badge: "Grounded Local RAG",
      header: "Nexus AI · Gemma 3 (CPU Loopback)",
      entries: [
        {
          label: "Member",
          text: "How should an operator safely restart nexus-web?",
          tone: "user",
        },
        {
          label: "Nexus AI",
          text: "Use Nexus Command Services or Nexus Control, confirm the allowlisted unit restart, then verify health checks within 60 seconds.",
          meta: "Source: restart-the-web-application · Audience: internal",
          tone: "assistant",
        },
      ],
      chips: [
        "Audience-filtered retrieval",
        "No tool execution",
        "Streaming SSE",
      ],
    },
  },
  "tour-06-transfer": {
    slug: "tour-06-transfer",
    chapter: "Services",
    accent: "blue",
    minRole: "member",
    moduleHref: "/transfer",
    moduleLabel: "Open Nexus Transfer",
    highlights: [
      "Serves encrypted SFTP on port 2022 and browser file access behind /files/",
      "Enforces isolated home directories, storage quotas and SSH ED25519 key auth",
      "Mounts storage with nosuid, nodev, noexec and fail2ban brute-force protection",
    ],
    preview: {
      kind: "records",
      badge: "SFTPGo Portal & Quotas",
      columns: ["Directory", "Protocol", "Policy"],
      rows: [
        {
          col1: "/uploads/handover",
          col2: "SFTP :2022",
          col3: "Key + Quota",
          state: "ok",
        },
        {
          col1: "/shared/runbooks",
          col2: "WebClient /files/",
          col3: "Virtual Chroot",
          state: "ok",
        },
        {
          col1: "/archives/exports",
          col2: "HTTPS TLS",
          col3: "noexec mount",
          state: "ok",
        },
      ],
      meter: {
        label: "Sample workspace quota",
        percent: 34,
        valueText: "3.4 GB / 10 GB",
      },
    },
  },
  "tour-07-mail": {
    slug: "tour-07-mail",
    chapter: "Services",
    accent: "pink",
    minRole: "member",
    moduleHref: "/mail",
    moduleLabel: "Open Nexus Mail",
    highlights: [
      "Combines Postfix (port 587) and Dovecot IMAPS (port 993) for internal pilot mail",
      "Ships Roundcube Webmail at /webmail/ styled in a matching dark Nexus skin",
      "Hashes virtual mailbox secrets with SHA-512 crypt and rejects external relay abuse",
    ],
    preview: {
      kind: "conversation",
      badge: "Internal Pilot Mail",
      header: "Roundcube Webmail · TLS Submission & IMAPS",
      entries: [
        {
          label: "ops@ytl-nexus.internal",
          text: "Weekly continuity drill verified — all 5 databases restored cleanly.",
          meta: "IMAPS :993 · Internal CA TLS",
          tone: "user",
        },
        {
          label: "nexus-mail",
          text: "Submission authenticated on port 587; external internet relay strictly disabled by policy.",
          meta: "Separate credentials from platform sign-in",
          tone: "assistant",
        },
      ],
      chips: ["Submission :587", "IMAPS :993", "Zero open relay"],
    },
  },
  "tour-08-data": {
    slug: "tour-08-data",
    chapter: "Operate",
    accent: "blue",
    minRole: "viewer",
    moduleHref: "/data",
    moduleLabel: "Open Nexus Data",
    highlights: [
      "Queries real MariaDB tables through parameterized Kysely data-access helpers",
      "Supports search, filters, pagination and CSV export across sites, assets and tickets",
      "Enforces Operator+ guards on record creation while letting Viewers inspect safely",
    ],
    preview: {
      kind: "records",
      badge: "MariaDB Asset Inventory",
      columns: ["Code", "Asset Type", "Status"],
      rows: [
        {
          col1: "KUL-5G-014",
          col2: "gNodeB Site",
          col3: "Active",
          state: "ok",
        },
        {
          col1: "CORE-SW-02",
          col2: "Aggregation Switch",
          col3: "Active",
          state: "ok",
        },
        {
          col1: "MNT-2026-08",
          col2: "Maintenance Ticket",
          col3: "Scheduled",
          state: "neutral",
        },
      ],
      meter: {
        label: "Query security",
        percent: 100,
        valueText: "Zod + Parameterized SQL",
      },
    },
  },
  "tour-09-library": {
    slug: "tour-09-library",
    chapter: "Services",
    accent: "blue",
    minRole: null,
    moduleHref: "/library",
    moduleLabel: "Open Nexus Library",
    highlights: [
      "Separates Public documentation from Internal runbooks strictly on the server",
      "Sanitizes rich WordPress HTML through an explicit allowlist before rendering",
      "Indexes approved text into Nexus AI so answers stay aligned with team docs",
    ],
    preview: {
      kind: "conversation",
      badge: "Audience-Separated Knowledge",
      header: "Nexus Library · Runbooks & FAQs",
      entries: [
        {
          label: "Public",
          text: "Platform overview, health verification steps and Demo data explanations.",
          meta: "Available to Visitors without sign-in",
          tone: "tag",
        },
        {
          label: "Internal",
          text: "Release rollback procedure, restart playbook and mail client ports.",
          meta: "Requires Viewer+ session · Never cached publicly",
          tone: "assistant",
        },
      ],
      chips: ["Runbooks", "FAQs", "Signed webhook refresh"],
    },
  },
  "tour-10-studio": {
    slug: "tour-10-studio",
    chapter: "Services",
    accent: "blue",
    minRole: "operator",
    moduleHref: "/library",
    moduleLabel: "Browse published Library",
    highlights: [
      "Runs WordPress strictly headless at /studio/ with frontend requests redirected away",
      "Protects authoring behind two-factor authentication and 10.x IP allowlisting",
      "Triggers signed POST /api/revalidate webhooks so edits publish immediately",
    ],
    preview: {
      kind: "architecture",
      badge: "Headless Authoring Pipeline",
      tiers: [
        {
          tag: "Authoring · /studio/",
          title: "WordPress + nexus-content Plugin",
          detail:
            "Editors draft Runbooks, FAQs, Story Chapters and Tour Steps with 2FA.",
        },
        {
          tag: "Revalidation · Signed POST",
          title: "HMAC Cache Invalidation",
          detail:
            "Publishing dispatches a signed webhook to /api/revalidate on Next.js.",
        },
        {
          tag: "Delivery · Next.js RSC",
          title: "Sanitized Typed Rendering",
          detail:
            "Content is sanitized server-side and split by public vs internal audience.",
        },
      ],
      footerStats: [
        { label: "Post types", value: "8" },
        { label: "HTML", value: "Allowlisted" },
        { label: "Auth", value: "2FA + IP" },
      ],
    },
  },
  "tour-11-continuity": {
    slug: "tour-11-continuity",
    chapter: "Assure",
    accent: "blue",
    minRole: "operator",
    moduleHref: "/continuity",
    moduleLabel: "Open Nexus Continuity",
    highlights: [
      "Automates daily dumps of all 5 MariaDB databases and service configs with SHA-256",
      "Executes automated weekly restore drills into scratch schemas to prove recovery",
      "Reports freshness badges (<26h) and provides a clear off-box rsync runbook",
    ],
    preview: {
      kind: "assurance",
      badge: "Verified Backup & Restore Drills",
      summary: "Recovery is proven by automated test restores, never assumed.",
      checks: [
        {
          label: "Nightly Database & Config Snapshot",
          state: "verified",
          detail: "All 5 schemas checksummed by root systemd timer",
        },
        {
          label: "Weekly Scratch Restore Drill",
          state: "verified",
          detail: "9/9 monitored platform components validated",
        },
        {
          label: "Off-Box Archive Readiness",
          state: "enforced",
          detail: "Encrypted env keys + CA bundle parity documented",
        },
      ],
      footnote: "Web layer reads continuity reports; only root timers write",
    },
  },
  "tour-12-shield": {
    slug: "tour-12-shield",
    chapter: "Assure",
    accent: "blue",
    minRole: "operator",
    moduleHref: "/shield",
    moduleLabel: "Open Nexus Shield",
    highlights: [
      "Evaluates 11 host security benchmarks via a read-only systemd timer",
      "Verifies TLS expiry, firewall port allowlists, loopback bindings and fail2ban jails",
      "Reports tracked pilot exceptions honestly with prioritized remediation steps",
    ],
    preview: {
      kind: "assurance",
      badge: "Read-Only Security Posture",
      summary:
        "Audits host posture daily without granting web shell or write privileges.",
      checks: [
        {
          label: "Firewall & Loopback Isolation",
          state: "enforced",
          detail: "Only 6 public ports open; DB, AI & metrics bound local",
        },
        {
          label: "Internal CA TLS & Security Headers",
          state: "verified",
          detail: "Nonce CSP, X-Frame-Options DENY, nosniff active",
        },
        {
          label: "Tracked Pilot Risks (Lockout Safe)",
          state: "tracked",
          detail: "SELinux & root SSH flags surfaced openly for IT action",
        },
      ],
      footnote: "Reports posture transparently; never modifies host files",
    },
  },
  "tour-13-story": {
    slug: "tour-13-story",
    chapter: "Showcase",
    accent: "pink",
    minRole: null,
    moduleHref: "/story",
    moduleLabel: "Read Project Story",
    highlights: [
      "Chronicles the transition from fragile legacy drafts to a greenfield pilot",
      "Explains key architecture trade-offs: single-host IPC, dual-mode adapters and RBAC",
      "Acknowledges mentors Logesh, Azlin and Sonu with clear internship attribution",
    ],
    preview: {
      kind: "architecture",
      badge: "6-Chapter Case Study",
      tiers: [
        {
          tag: "Chapters 1 – 2",
          title: "Audit & Cohesive Architecture",
          detail:
            "Verified backup before cleanup, then Next.js 16 + dual-mode adapters.",
        },
        {
          tag: "Chapters 3 – 4",
          title: "Hardened IPC & Security First",
          detail:
            "HMAC Unix socket operations, least-privilege DB grants and Shield scans.",
        },
        {
          tag: "Chapters 5 – 6",
          title: "Engineering Growth & Handover",
          detail:
            "TDD discipline, WCAG 2.2 AA compliance and team handover ownership.",
        },
      ],
      footerStats: [
        { label: "Chapters", value: "6" },
        { label: "Scope", value: "Internship" },
        { label: "Source", value: "WordPress" },
      ],
    },
  },
  "tour-14-control": {
    slug: "tour-14-control",
    chapter: "Govern",
    accent: "blue",
    minRole: "admin",
    moduleHref: null,
    moduleLabel: null,
    hiddenNote: "Hidden control plane · Administrator only",
    highlights: [
      "Protected as a hidden route: unauthenticated visitors receive a standard 404",
      "Requires step-up TOTP 2FA for user lifecycle, role approvals and SFTP/mail creation",
      "Delegates allowlisted systemd restarts through HMAC-signed nexus-ops + polkit",
    ],
    preview: {
      kind: "assurance",
      badge: "Administrator Control Plane",
      summary:
        "Zero-trust governance backed by step-up TOTP, Zod schemas and audit_events.",
      checks: [
        {
          label: "Hidden Route & Step-Up 2FA Gate",
          state: "enforced",
          detail: "Non-session requests rewrite to 404; Admins verify TOTP",
        },
        {
          label: "Unified User, SFTP & Mail Provisioning",
          state: "verified",
          detail: "Stage 1–3 promotion queue + single-view initial passwords",
        },
        {
          label: "Allowlisted nexus-ops + CSV Audit Trail",
          state: "enforced",
          detail: "No arbitrary shell; every mutation logged append-only",
        },
      ],
      footnote: "Deliberately unlinked on public pages (Requirement 6.11)",
    },
  },
  "tour-15-yes": {
    slug: "tour-15-yes",
    chapter: "Showcase",
    accent: "pink",
    minRole: null,
    moduleHref: "/yes",
    moduleLabel: "Open Yes Experience",
    highlights: [
      "Brings the Yes website redesign cleanly inside the unified YTL Nexus shell",
      "Features 5G mobile/broadband plans, interactive coverage lookup and support flows",
      "Includes a public Yes 5G assistant strictly scoped to public product info",
    ],
    preview: {
      kind: "telemetry",
      badge: "Yes 5G Brand Showcase",
      metrics: [
        {
          label: "Plans View",
          value: "5G & Fibre",
          note: "Responsive catalog",
          status: "ok",
        },
        {
          label: "Coverage",
          value: "Interactive",
          note: "Demo lookup tool",
          status: "ok",
        },
        {
          label: "Assistant",
          value: "Public Scope",
          note: "Zero internal docs",
          status: "ok",
        },
        {
          label: "Motion",
          value: "Reduced-Safe",
          note: "Petal art direction",
          status: "ok",
        },
      ],
      series: [45, 58, 66, 74, 82, 88, 91, 94, 96, 98, 99, 100],
      seriesLabel: "Illustrative 5G showcase signal curve",
      caption: "Runs inside Nexus layout with official YTL / Yes brand assets",
    },
  },
  "tour-16-summary": {
    slug: "tour-16-summary",
    chapter: "Showcase",
    accent: "pink",
    minRole: null,
    moduleHref: "/story",
    moduleLabel: "Read Project Story",
    highlights: [
      "All 15 modules run from one codebase in both Live server mode and offline Demo mode",
      "Switch demo personas in All modules to test Viewer, Member, Operator and Admin views",
      "Full runbooks, backup drills and handover guides equip the IT Infrastructure team",
    ],
    preview: {
      kind: "architecture",
      badge: "15 Unified Modules · 4 Pillars",
      tiers: [
        {
          tag: "Explore & Showcase",
          title: "Platform · Status · Library · Tour · Story · Yes",
          detail:
            "Public storytelling, sanitized health summary and brand experience.",
        },
        {
          tag: "Operate & Services",
          title: "Command · Atlas · Data · AI · Transfer · Mail",
          detail:
            "Authenticated telemetry, dependency map, DB records, RAG, SFTP & webmail.",
        },
        {
          tag: "Assure & Govern",
          title: "Continuity · Shield · Studio · Control",
          detail:
            "Verified backup drills, security posture, headless CMS and RBAC admin.",
        },
      ],
      footerStats: [
        { label: "Tests", value: "Automated" },
        { label: "Handover", value: "Documented" },
        { label: "Status", value: "Complete" },
      ],
    },
  },
};

const CHAPTER_FALLBACK_ORDER: readonly TourChapter[] = [
  "Overview",
  "Operate",
  "Services",
  "Assure",
  "Govern",
  "Showcase",
];

function buildFallbackMeta(step: ContentItem, index: number): TourSlideMeta {
  const chapter =
    CHAPTER_FALLBACK_ORDER[index % CHAPTER_FALLBACK_ORDER.length] ?? "Overview";

  return {
    slug: step.slug,
    chapter,
    accent: "blue",
    minRole: null,
    moduleHref: "/platform",
    moduleLabel: "Explore platform architecture",
    highlights: [
      step.excerpt.trim().length > 0
        ? step.excerpt
        : `Guided walkthrough for ${step.title}`,
      step.relatedService
        ? `Connected backing subsystem: ${step.relatedService}`
        : "Integrated into the unified YTL Nexus Next.js shell",
      "Supports Obsidian, Blueprint and Daylight themes with full keyboard control",
    ],
    preview: {
      kind: "architecture",
      badge: "Module Walkthrough",
      tiers: [
        {
          tag: `Slide ${String(index + 1).padStart(2, "0")}`,
          title: step.title,
          detail:
            step.excerpt.trim().length > 0
              ? step.excerpt
              : "Authored via WordPress tour_step content.",
        },
      ],
      footerStats: [
        {
          label: "Service",
          value: step.relatedService ?? "nexus-web",
        },
        { label: "Audience", value: "Public" },
      ],
    },
  };
}

export function getTourSlideMeta(
  step: ContentItem,
  index: number,
): TourSlideMeta {
  return SLIDE_META_BY_SLUG[step.slug] ?? buildFallbackMeta(step, index);
}

/** Parses a 1-based `?step=` query parameter into a clamped 0-based index. */
export function parseInitialTourStep(
  raw: string | string[] | undefined,
  total: number,
): number {
  if (total <= 0) return 0;
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  if (typeof candidate !== "string") return 0;
  const trimmed = candidate.trim();
  if (!/^-?\d+$/.test(trimmed)) return 0;
  const parsed = Number.parseInt(trimmed, 10);
  if (Number.isNaN(parsed) || parsed <= 1) return 0;
  if (parsed > total) return total - 1;
  return parsed - 1;
}
