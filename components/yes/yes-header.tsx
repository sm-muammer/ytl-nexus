"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";

const NAV_LINKS = [
  { href: "/yes", label: "Overview" },
  { href: "/yes/plans", label: "Plans" },
  { href: "/yes/coverage", label: "Coverage" },
  { href: "/yes/support", label: "Support" },
];

export function YesHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="border-line bg-surface/85 relative border-b backdrop-blur-md">
      <div className="max-w-page mx-auto flex items-center justify-between px-(--spacing-gutter) py-3">
        {/* Brand logo & title */}
        <div className="flex items-center gap-4">
          <Link
            href="/yes"
            className="focus-ring flex items-center gap-3 rounded-md transition-opacity hover:opacity-90"
          >
            <Logo slug="yes-logomark-gradient" height={34} priority />
            <div className="flex flex-col">
              <span className="text-ink font-bold tracking-tight">Yes 5G</span>
              <span className="text-muted text-xs">Experience Concept</span>
            </div>
          </Link>
        </div>

        {/* Desktop navigation */}
        <nav
          aria-label="Yes section navigation"
          className="hidden md:flex md:items-center md:gap-1"
        >
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={`focus-ring inline-flex min-h-10 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-surface-elevated text-ink shadow-xs"
                    : "text-muted hover:text-ink hover:bg-surface-elevated/50"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* Action button & Mobile toggle */}
        <div className="flex items-center gap-2">
          <a
            href="https://www.yes.my/"
            target="_blank"
            rel="noopener noreferrer"
            className="focus-ring bg-yes-pink text-surface hidden items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold shadow-xs transition-transform hover:opacity-95 active:scale-95 sm:inline-flex"
          >
            Official yes.my ↗
          </a>
          <Link
            href="/"
            className="focus-ring border-line text-muted hover:text-ink hover:bg-surface-elevated inline-flex items-center justify-center rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors"
          >
            ← Back to Nexus
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-expanded={mobileOpen}
            aria-controls="yes-mobile-nav"
            aria-label={mobileOpen ? "Close Yes menu" : "Open Yes menu"}
            className="focus-ring border-line text-ink hover:bg-surface-elevated inline-flex h-9 w-9 items-center justify-center rounded-md border md:hidden"
          >
            {mobileOpen ? (
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer navigation */}
      {mobileOpen && (
        <div
          id="yes-mobile-nav"
          className="border-line bg-surface/95 border-b px-(--spacing-gutter) py-3 md:hidden"
        >
          <nav
            aria-label="Mobile Yes section navigation"
            className="flex flex-col gap-1"
          >
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={isActive ? "page" : undefined}
                  className={`focus-ring flex min-h-11 items-center rounded-md px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-surface-elevated text-ink"
                      : "text-muted hover:text-ink hover:bg-surface-elevated/50"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
            <a
              href="https://www.yes.my/"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-yes-pink text-surface mt-2 flex min-h-11 items-center justify-center rounded-lg px-4 text-center text-sm font-semibold"
            >
              Visit Official yes.my ↗
            </a>
          </nav>
        </div>
      )}
    </div>
  );
}
