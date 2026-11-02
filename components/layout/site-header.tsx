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
import { ModeStrip } from "./mode-strip";
import { NavLink } from "./nav-link";
import { NavSheet, type SheetGroup } from "./nav-sheet";

const linkClass =
  "text-muted hover:text-ink aria-[current=page]:text-ink inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors duration-(--duration-fast)";

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

  return (
    <header className="border-line bg-canvas border-b">
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
            className="font-serif text-xl font-medium tracking-tight"
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
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-2">
          {actor === null ? (
            <NavLink
              href="/signin"
              className="border-accent-ink text-accent-ink hover:bg-surface-raised hidden min-h-11 items-center rounded-full border px-4 text-sm font-medium transition-colors duration-(--duration-fast) md:inline-flex"
            >
              Sign in
            </NavLink>
          ) : null}
          <NavSheet
            groups={groups}
            {...(mode === "demo"
              ? { demoSession: { role: actor?.role ?? null } }
              : {})}
          />
        </div>
      </div>
      <ModeStrip mode={mode} actor={actor} />
    </header>
  );
}
