import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import type { NexusMode } from "@/lib/server/mode";
import { meetsRole, type Actor } from "@/lib/roles";
import { FOOTER_LINKS } from "@/lib/navigation/modules";

const linkClass =
  "text-muted hover:text-ink inline-flex min-h-11 min-w-11 items-center rounded-md px-2 text-sm transition-colors duration-(--duration-fast)";

/**
 * Contentinfo landmark. Every link resolves: an existing route, or an official
 * YTL or Yes page. tests/e2e/shell.spec.ts follows each one.
 */
export function SiteFooter({ actor, mode }: { actor: Actor; mode: NexusMode }) {
  const links = FOOTER_LINKS.filter((l) => meetsRole(actor, l.minRole));
  return (
    <footer className="border-line bg-surface/70 border-t backdrop-blur-md">
      <div className="max-w-page mx-auto flex w-full flex-col gap-10 px-(--spacing-gutter) py-10 lg:flex-row lg:justify-between">
        <div className="flex max-w-md flex-col gap-4">
          {/* self-start: a stretched flex item would distort the logo. */}
          <Logo
            slug="ytl-communications-left-reverse-white-wordmark"
            height={32}
            className="self-start"
          />
          <p className="text-muted text-sm">
            YTL Nexus is an internship project built with the YTL Communications
            IT Infrastructure team on Nexus Core 01. It is not an official YTL
            commercial product.
          </p>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <EnvironmentBadge mode={mode} />
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-2 gap-y-1 lg:max-w-xl lg:justify-end">
            {links.map((link) => (
              <li key={link.href}>
                {link.external ? (
                  <a
                    href={link.href}
                    rel="noopener noreferrer"
                    target="_blank"
                    className={linkClass}
                  >
                    {link.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                ) : (
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
