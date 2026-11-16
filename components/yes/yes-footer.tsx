import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function YesFooter() {
  return (
    <div className="border-line bg-surface/80 border-t py-12">
      <div className="max-w-page mx-auto px-(--spacing-gutter)">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand Col */}
          <div>
            <div className="flex items-center gap-3">
              <Logo slug="yes-logomark-gradient" height={32} />
              <span className="text-ink font-bold tracking-tight">Yes 5G</span>
            </div>
            <p className="text-muted mt-3 text-sm">
              Malaysia’s high-speed 5G mobile and broadband platform.
            </p>
            <p className="text-muted/80 mt-2 text-xs">
              Part of YTL Communications Sdn Bhd.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://www.facebook.com/Yes.5G/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Yes 5G on Facebook"
                className="text-muted hover:text-ink focus-ring rounded-md p-1 transition-colors"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a
                href="https://www.instagram.com/yes.5g/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Yes 5G on Instagram"
                className="text-muted hover:text-ink focus-ring rounded-md p-1 transition-colors"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a
                href="https://x.com/Yes_5G"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Yes 5G on X"
                className="text-muted hover:text-ink focus-ring rounded-md p-1 transition-colors"
              >
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Quick links */}
          <div>
            <h4 className="text-ink text-sm font-semibold tracking-wide">
              Experience Navigation
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link
                  href="/yes"
                  className="text-muted hover:text-ink transition-colors"
                >
                  Overview
                </Link>
              </li>
              <li>
                <Link
                  href="/yes/plans"
                  className="text-muted hover:text-ink transition-colors"
                >
                  5G Plans
                </Link>
              </li>
              <li>
                <Link
                  href="/yes/coverage"
                  className="text-muted hover:text-ink transition-colors"
                >
                  Coverage Checker
                </Link>
              </li>
              <li>
                <Link
                  href="/yes/support"
                  className="text-muted hover:text-ink transition-colors"
                >
                  Support & Help
                </Link>
              </li>
            </ul>
          </div>

          {/* Official destinations */}
          <div>
            <h4 className="text-ink text-sm font-semibold tracking-wide">
              Official Destinations
            </h4>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <a
                  href="https://www.yes.my/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors"
                >
                  Yes Homepage ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.yes.my/coverage/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors"
                >
                  DNB Coverage Map ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.yes.my/support/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors"
                >
                  Customer Support Portal ↗
                </a>
              </li>
              <li>
                <a
                  href="https://www.ytl.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted hover:text-ink transition-colors"
                >
                  YTL Corporation ↗
                </a>
              </li>
            </ul>
          </div>

          {/* Concept note */}
          <div>
            <h4 className="text-ink text-sm font-semibold tracking-wide">
              Notice
            </h4>
            <p className="text-muted mt-3 text-xs leading-relaxed">
              This Yes Experience is an interactive concept redesign integrated
              into YTL Nexus. Rates and offers shown are concept demonstrations;
              live subscription, official SIM purchases, and verified terms are
              conducted exclusively on{" "}
              <a
                href="https://www.yes.my/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-yes-pink underline"
              >
                yes.my
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
