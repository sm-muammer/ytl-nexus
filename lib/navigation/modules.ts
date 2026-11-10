// The single registry of modules, routes and navigation. Navigation, stub
// pages, the footer and the route tests all read from here, so a module is
// described once. Names and subtitles match docs/product.md section 2; routes
// match section 4. Pure data and functions, safe in client components.

import type { AdapterName } from "@/lib/server/adapters/types";
import { meetsRole, type Actor, type Role } from "@/lib/roles";

export type NavGroup = "explore" | "operate" | "services" | "assure" | "manage";

export const NAV_GROUPS: readonly NavGroup[] = [
  "explore",
  "operate",
  "services",
  "assure",
  "manage",
];

export const NAV_GROUP_LABEL: Record<NavGroup, string> = {
  explore: "Explore",
  operate: "Operate",
  services: "Services",
  assure: "Assure",
  manage: "Manage",
};

/** Sub-brand accent used in heroes. Status colours are never used here. */
export type Accent = "blue" | "pink" | "violet";

type PageCopy = {
  title: string;
  subtitle: string;
  /** What the finished page will do, in one sentence. */
  summary: string;
  /** Plan task (docs/spec/implementation-plan.md) that delivers the real page. */
  task: number;
  /** Adapter whose live or demo status the stub page shows. */
  backing: AdapterName | null;
};

export type ChildPage = PageCopy & { href: string };

export type ModuleInfo = {
  slug: string;
  name: string;
  subtitle: string;
  summary: string;
  href: string;
  minRole: Role | null;
  group: NavGroup;
  accent: Accent;
  task: number;
  backing: AdapterName | null;
  /** Slugs of related modules, linked from the module page. */
  related: readonly string[];
  /**
   * Served by Apache, not Next.js, on Nexus Core 01 (WordPress, Roundcube,
   * SFTPGo). Links to it are plain anchors that load the whole page. The
   * Next.js route at the same path is a fallback for local and demo use that
   * Apache never forwards in production.
   */
  apacheServed?: boolean;
  /**
   * Its existence is not announced: it is left out of the home page and of
   * "related modules" lists unless the viewer is allowed to open it. Nexus
   * Control is the one hidden module (requirement 6.11).
   */
  hidden?: boolean;
  /** Contextual navigation shown on every page of a module with child routes. */
  subNav?: readonly { label: string; href: string }[];
  /** Extra Next.js routes this module owns. */
  pages?: readonly ChildPage[];
};

export const MODULES: readonly ModuleInfo[] = [
  {
    slug: "command",
    name: "Nexus Command",
    subtitle: "Infrastructure dashboard (Core 01, metrics, services)",
    summary:
      "Live health of Nexus Core 01: CPU, memory, disk, network and every monitored service, with a particle field that reflects real health.",
    href: "/command",
    minRole: "viewer",
    group: "operate",
    accent: "blue",
    task: 8,
    backing: "prometheus",
    related: ["atlas", "status", "ai"],
    subNav: [
      { label: "Overview", href: "/command" },
      { label: "Core 01", href: "/command/core-01" },
      { label: "Atlas", href: "/command/atlas" },
      { label: "Metrics", href: "/command/metrics" },
      { label: "Services", href: "/command/services" },
    ],
    pages: [
      {
        href: "/command/core-01",
        title: "Core 01",
        subtitle: "Server detail",
        summary:
          "Hardware, operating system, uptime and resource detail for the Rocky Linux server that runs YTL Nexus.",
        task: 8,
        backing: "prometheus",
      },
      {
        href: "/command/metrics",
        title: "Metrics",
        subtitle: "Time-range charts",
        summary:
          "CPU, memory, disk and network charts for the last hour, 6 hours, 24 hours and 7 days, each with a data table alternative.",
        task: 8,
        backing: "prometheus",
      },
      {
        href: "/command/services",
        title: "Services",
        subtitle: "Service list and health",
        summary:
          "Every monitored systemd service with its current state, recent checks and a link to its module.",
        task: 8,
        backing: "prometheus",
      },
    ],
  },
  {
    slug: "atlas",
    name: "Nexus Atlas",
    subtitle: "Service dependency map",
    summary:
      "An interactive map of which services depend on which, so the effect of a failure is visible before it happens.",
    href: "/command/atlas",
    minRole: "viewer",
    group: "operate",
    accent: "blue",
    task: 10,
    backing: "db",
    related: ["command", "status", "shield"],
  },
  {
    slug: "status",
    name: "Nexus Status",
    subtitle: "Health history, incidents and maintenance notices",
    summary:
      "A public summary of platform health with a full history, incidents and planned maintenance for signed-in viewers.",
    href: "/status",
    minRole: null,
    group: "explore",
    accent: "blue",
    task: 9,
    backing: "db",
    related: ["command", "continuity", "atlas"],
  },
  {
    slug: "ai",
    name: "Nexus AI",
    subtitle: "Local knowledge and operations assistant",
    summary:
      "A chat assistant that runs on the server, answers from the team's own runbooks and cites its sources.",
    href: "/ai",
    minRole: "member",
    group: "services",
    accent: "violet",
    task: 14,
    backing: "ollama",
    related: ["library", "command", "data"],
  },
  {
    slug: "transfer",
    name: "Nexus Transfer",
    subtitle: "Secure SFTP and browser file portal",
    summary:
      "Your SFTP status, keys and quota, with a guide to the browser file portal.",
    href: "/transfer",
    minRole: "member",
    group: "services",
    accent: "blue",
    task: 12,
    backing: "sftpgo",
    related: ["mail", "continuity", "shield"],
  },
  {
    slug: "mail",
    name: "Nexus Mail",
    subtitle: "Secure webmail",
    summary:
      "Internal webmail for the pilot, with an entry page that shows service status and setup help.",
    href: "/mail",
    minRole: "member",
    group: "services",
    accent: "pink",
    task: 13,
    backing: "mail",
    related: ["transfer", "library", "status"],
  },
  {
    slug: "data",
    name: "Nexus Data",
    subtitle: "MariaDB demonstration records",
    summary:
      "Generic infrastructure assets, sites and maintenance tickets stored in MariaDB, to show the database working with real queries.",
    href: "/data",
    minRole: "viewer",
    group: "operate",
    accent: "blue",
    task: 11,
    backing: "db",
    related: ["atlas", "continuity", "ai"],
  },
  {
    slug: "library",
    name: "Nexus Library",
    subtitle: "Runbooks, FAQs and architecture notes",
    summary:
      "Runbooks, FAQs and architecture notes written in Nexus Studio. Public items are open to everyone; internal items need a sign-in.",
    href: "/library",
    minRole: null,
    group: "explore",
    accent: "blue",
    task: 7,
    backing: "wordpress",
    related: ["studio", "ai", "status"],
  },
  {
    slug: "studio",
    name: "Nexus Studio",
    subtitle: "WordPress content management",
    summary:
      "Where editors write Library, Story and Tour content. On Nexus Core 01 it is headless WordPress served by Apache at /studio/; where Apache is absent (local and demo) this page stands in for it.",
    href: "/studio/",
    minRole: "operator",
    group: "manage",
    accent: "blue",
    task: 7,
    backing: "wordpress",
    related: ["library", "story", "tour"],
    apacheServed: true,
  },
  {
    slug: "continuity",
    name: "Nexus Continuity",
    subtitle: "Backups and restore verification",
    summary:
      "Backup runs and restore tests with their results, so recovery is proven and not assumed.",
    href: "/continuity",
    minRole: "operator",
    group: "assure",
    accent: "blue",
    task: 16,
    backing: "db",
    related: ["shield", "status", "data"],
  },
  {
    slug: "shield",
    name: "Nexus Shield",
    subtitle: "Read-only security posture",
    summary:
      "Findings from scheduled security scans of Nexus Core 01. It reports and never changes anything.",
    href: "/shield",
    minRole: "operator",
    group: "assure",
    accent: "blue",
    task: 17,
    backing: "db",
    related: ["continuity", "atlas", "control"],
  },
  {
    slug: "tour",
    name: "Nexus Tour",
    subtitle: "Guided sanitized presentation",
    summary:
      "A guided walk through every module using demo data only, with a presenter mode for talks.",
    href: "/tour",
    minRole: null,
    group: "explore",
    accent: "pink",
    task: 18,
    backing: null,
    related: ["story", "library", "yes"],
  },
  {
    slug: "story",
    name: "Project Story",
    subtitle: "The internship case study",
    summary:
      "The story of YTL Nexus as an internship project: where it started, the decisions, the challenges and the lessons.",
    href: "/story",
    minRole: null,
    group: "explore",
    accent: "pink",
    task: 18,
    backing: "wordpress",
    related: ["tour", "library", "yes"],
  },
  {
    slug: "control",
    name: "Nexus Control",
    subtitle: "Hidden administration",
    summary:
      "Administrator tools for users, roles, SFTP and mail accounts, keys, quotas, configuration and the audit log.",
    href: "/control",
    minRole: "admin",
    group: "manage",
    accent: "blue",
    task: 19,
    backing: "auth",
    related: ["shield", "transfer", "mail"],
    hidden: true,
  },
  {
    slug: "yes",
    name: "Yes Experience",
    subtitle: "Yes website redesign",
    summary:
      "A redesign of the Yes website with its own cherry-blossom art direction, shown inside the Nexus shell.",
    href: "/yes",
    minRole: null,
    group: "explore",
    accent: "pink",
    task: 15,
    backing: null,
    related: ["story", "tour", "library"],
  },
];

/** The modules the home page lists: everything except hidden areas. */
export const PUBLIC_MODULES: readonly ModuleInfo[] = MODULES.filter(
  (m) => !m.hidden,
);

export type NavItem = {
  label: string;
  href: string;
  subtitle: string;
  minRole: Role | null;
  group: NavGroup;
  apacheServed?: boolean;
  children?: readonly NavItem[];
};

const platformItem: NavItem = {
  label: "Platform",
  href: "/platform",
  subtitle: "How YTL Nexus fits together",
  minRole: null,
  group: "explore",
};

function toNavItem(m: ModuleInfo): NavItem {
  return {
    label: m.name,
    href: m.href,
    subtitle: m.subtitle,
    minRole: m.minRole,
    group: m.group,
    ...(m.apacheServed ? { apacheServed: true } : {}),
    ...(m.subNav
      ? {
          children: m.subNav.map((s) => ({
            label: s.label,
            href: s.href,
            subtitle: m.subtitle,
            minRole: m.minRole,
            group: m.group,
          })),
        }
      : {}),
  };
}

/** Global navigation: Platform first, then every module in registry order. */
export const NAV_ITEMS: readonly NavItem[] = [
  platformItem,
  ...MODULES.map(toNavItem),
];

/**
 * Items the actor may see: those with no minimum role, plus those at or below
 * the actor's role. A Visitor (null) sees public items only. This shapes the
 * menu; it is never access control. Pages authorize themselves (Task 6).
 */
export function visibleNav<
  T extends { minRole: Role | null; children?: readonly T[] },
>(items: readonly T[], actor: Actor): T[] {
  return items
    .filter((item) => meetsRole(actor, item.minRole))
    .map((item) =>
      item.children
        ? { ...item, children: visibleNav(item.children, actor) }
        : item,
    );
}

export type FooterLink = {
  label: string;
  href: string;
  minRole: Role | null;
  external?: boolean;
};

/** Every target resolves: an existing Next.js route or an official https URL. */
export const FOOTER_LINKS: readonly FooterLink[] = [
  { label: "Platform", href: "/platform", minRole: null },
  { label: "Nexus Tour", href: "/tour", minRole: null },
  { label: "Project Story", href: "/story", minRole: null },
  { label: "Nexus Status", href: "/status", minRole: null },
  { label: "Nexus Library", href: "/library", minRole: null },
  { label: "Yes Experience", href: "/yes", minRole: null },
  { label: "Sign in", href: "/signin", minRole: null },
  { label: "Design reference", href: "/design", minRole: "viewer" },
  {
    label: "YTL Corporation",
    href: "https://www.ytl.com/",
    minRole: null,
    external: true,
  },
  {
    label: "Yes",
    href: "https://www.yes.my/",
    minRole: null,
    external: true,
  },
];

export type PageInfo = PageCopy & {
  path: string;
  minRole: Role | null;
  accent: Accent;
  group: NavGroup;
  related: readonly string[];
  /** The module a child page belongs to, for the breadcrumb. */
  parent?: { name: string; href: string };
};

const extraPages: readonly PageInfo[] = [
  {
    path: "/platform",
    title: "Platform",
    subtitle: "How YTL Nexus fits together",
    summary:
      "How one Next.js application and a handful of host services make up YTL Nexus on Nexus Core 01, and why they are built this way.",
    task: 18,
    backing: null,
    minRole: null,
    accent: "blue",
    group: "explore",
    related: ["command", "library", "story"],
  },
  {
    path: "/signin",
    title: "Sign in",
    subtitle: "Access for the IT Infrastructure team",
    summary:
      "Email and password sign-in with two-factor authentication for operators and administrators.",
    task: 6,
    backing: "auth",
    minRole: null,
    accent: "blue",
    group: "explore",
    related: ["library", "status", "tour"],
  },
];

const moduleLandingPages: readonly PageInfo[] = MODULES.map((m) => ({
  // "/studio/" is the Apache URL; Next.js serves the fallback at "/studio".
  path: m.href.length > 1 ? m.href.replace(/\/$/, "") : m.href,
  title: m.name,
  subtitle: m.subtitle,
  summary: m.summary,
  task: m.task,
  backing: m.backing,
  minRole: m.minRole,
  accent: m.accent,
  group: m.group,
  related: m.related,
}));

const childPages: readonly PageInfo[] = MODULES.flatMap((m) =>
  (m.pages ?? []).map((p) => ({
    path: p.href,
    title: p.title,
    subtitle: p.subtitle,
    summary: p.summary,
    task: p.task,
    backing: p.backing,
    minRole: m.minRole,
    accent: m.accent,
    group: m.group,
    related: m.related,
    parent: { name: m.name, href: m.href },
  })),
);

/** Every stub page. The home page and /design are full pages and not listed. */
export const PAGES: readonly PageInfo[] = [
  ...extraPages,
  ...moduleLandingPages,
  ...childPages,
];

/** Every route the Next.js app serves. */
export const ROUTE_PATHS: readonly string[] = [
  "/",
  "/design",
  // A content page: the slug is a Library item (Task 7).
  "/library/[slug]",
  ...PAGES.map((p) => p.path),
];

export function pageInfo(path: string): PageInfo {
  const page = PAGES.find((p) => p.path === path);
  if (!page) throw new Error(`No page is registered for ${path}`);
  return page;
}

export function findModule(slug: string): ModuleInfo {
  const found = MODULES.find((m) => m.slug === slug);
  if (!found) throw new Error(`Unknown module: ${slug}`);
  return found;
}

/** The module whose contextual navigation includes this path, if any. */
export function moduleForPath(path: string): ModuleInfo | undefined {
  return MODULES.find((m) => m.subNav?.some((s) => s.href === path));
}
