import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import type { Actor } from "@/lib/roles";
import {
  NAV_GROUPS,
  NAV_GROUP_LABEL,
  NAV_ITEMS,
  visibleNav,
} from "@/lib/navigation/modules";
import type { NexusMode } from "@/lib/server/mode";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { ROLE_LABEL } from "@/lib/roles";
import { CommandPalette } from "@/components/navigation/command-palette";
import { NavLink } from "./nav-link";
import { NavSheet, type SessionSummary, type SheetGroup } from "./nav-sheet";

// Short labels keep the bar on one line; the menu sheet uses the full names.
const SHORT: Record<string, string> = {
  "Nexus Status": "Status",
  "Nexus Library": "Library",
  "Nexus Tour": "Tour",
  "Project Story": "Story",
  "Yes Experience": "Yes",
};

const linkClass =
  "text-muted hover:text-ink aria-[current=page]:text-ink inline-flex whitespace-nowrap min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-(--duration-fast)";

/**
 * Banner landmark for both registers: brand, global navigation, the module
 * directory and the mode strip. Items are filtered to the actor's role; that
 * shapes the menu only, pages authorize themselves.
 */
export function SiteHeader({ mode, actor }: { mode: NexusMode; actor: Actor }) {
  const items = visibleNav(NAV_ITEMS, actor);
  const primary = items.filter((i) => i.group === "explore");

  const groups: SheetGroup[] = NAV_GROUPS.map((key) => ({
    key,
    label: NAV_GROUP_LABEL[key],
    items: items
      .filter((i) => i.group === key)
      .map((i) => ({
        label: i.label,
        href: i.href,
        subtitle: i.subtitle,
        apacheServed: Boolean(i.apacheServed),
      })),
  })).filter((g) => g.items.length > 0);

  const demo = mode === "demo";
  const session: SessionSummary | null = actor
    ? {
        kicker: demo ? "Demo session" : "Signed in",
        name: ROLE_LABEL[actor.role],
        initial: ROLE_LABEL[actor.role].charAt(0),
        demo,
      }
    : demo
      ? { kicker: "Demo session", name: "Not signed in", initial: null, demo }
      : null;

  return (
    <header className="border-line bg-canvas/70 relative z-(--z-sticky) border-b backdrop-blur-md">
      <div className="max-w-page mx-auto flex w-full items-center gap-3 px-(--spacing-gutter) py-3">
        <Link
          href="/"
          aria-label="YTL Nexus, home"
          className="flex min-h-11 items-center gap-3"
        >
          <Logo
            slug="ytl-communications-left-reverse-white-wordmark"
            height={32}
            className="shrink-0"
            priority
          />
          <span aria-hidden="true" className="bg-border-strong h-6 w-px" />
          <span
            aria-hidden="true"
            className="font-display text-xl font-medium tracking-tight"
          >
            Nexus
          </span>
        </Link>

        <nav
          aria-label="Global"
          className="ml-auto hidden items-center gap-1 xl:flex"
        >
          {primary.map((item) => (
            <NavLink key={item.href} href={item.href} className={linkClass}>
              {SHORT[item.label] ?? item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-2">
          <CommandPalette actor={actor} />
          <span className="hidden sm:inline-flex">
            <EnvironmentBadge mode={mode} />
          </span>
          {actor === null ? (
            <NavLink
              href="/signin"
              className="border-accent-ink text-accent-ink hover:bg-surface-raised hidden min-h-11 items-center rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors duration-(--duration-fast) md:inline-flex"
            >
              Sign in
            </NavLink>
          ) : null}
          <NavSheet
            mode={mode}
            session={session}
            groups={groups}
            {...(mode === "demo"
              ? { demoSession: { role: actor?.role ?? null } }
              : {})}
            canSignOut={mode === "live" && actor !== null}
          />
        </div>
      </div>
    </header>
  );
}
