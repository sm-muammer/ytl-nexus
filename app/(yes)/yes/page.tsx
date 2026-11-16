import Link from "next/link";
import { pageMetadata } from "@/components/layout/module-page";
import { Logo } from "@/components/brand/logo";
import { NewsletterSignup } from "@/components/yes/newsletter-signup";

export const metadata = pageMetadata("/yes");

export default function YesHomePage() {
  return (
    <div className="space-y-20 py-8">
      {/* Hero Section */}
      <section className="relative px-(--spacing-gutter) text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="border-line bg-surface-elevated/70 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 shadow-xs">
            <span className="bg-yes-pink h-2 w-2 animate-pulse rounded-full" />
            <span className="text-ink text-xs font-medium">
              Experience Concept · Integrated with Nexus Core
            </span>
          </div>

          <h1 className="text-ink text-4xl font-extrabold tracking-tight sm:text-6xl">
            Experience Malaysia’s{" "}
            <span className="from-yes-pink to-yes-gradient-end bg-gradient-to-r bg-clip-text text-transparent">
              Fastest 5G Network
            </span>
          </h1>

          <p className="text-muted mx-auto max-w-2xl text-lg leading-relaxed">
            Uncapped speeds, honest connectivity, and nationwide Digital
            Nasional Berhad (DNB) infrastructure. Discover plans built for
            modern digital lifestyles.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <Link
              href="/yes/plans"
              className="focus-ring bg-yes-pink text-surface inline-flex min-h-12 items-center justify-center rounded-xl px-7 text-sm font-semibold shadow-md transition-transform hover:opacity-95 active:scale-95"
            >
              Explore 5G Plans
            </Link>
            <Link
              href="/yes/coverage"
              className="focus-ring border-line bg-surface/80 text-ink hover:bg-surface-elevated inline-flex min-h-12 items-center justify-center rounded-xl border px-7 text-sm font-semibold shadow-xs transition-colors"
            >
              Check Area Coverage
            </Link>
            <a
              href="https://www.yes.my/"
              target="_blank"
              rel="noopener noreferrer"
              className="focus-ring text-muted hover:text-ink inline-flex min-h-12 items-center justify-center px-4 text-xs font-medium transition-colors"
            >
              Official yes.my Portal ↗
            </a>
          </div>

          <p className="text-muted/70 pt-2 text-xs">
            Pricing and promotion claims shown for demonstration; source:
            official yes.my portal.
          </p>
        </div>
      </section>

      {/* Feature Highlights */}
      <section className="px-(--spacing-gutter)">
        <div className="max-w-page mx-auto">
          <div className="mb-12 text-center">
            <h2 className="text-ink text-2xl font-bold tracking-tight sm:text-3xl">
              Why Choose Yes 5G?
            </h2>
            <p className="text-muted mt-2 text-sm">
              Purpose-built connectivity without speed throttling or unexpected
              barriers.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div className="border-line bg-surface/90 rounded-2xl border p-6 transition-all hover:shadow-md">
              <div className="bg-surface-elevated flex h-12 w-12 items-center justify-center rounded-xl">
                <Logo slug="yes-logomark-pink" height={28} />
              </div>
              <h3 className="text-ink mt-4 text-lg font-bold">
                Uncapped Speed
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                Enjoy uncapped 5G download and upload speeds across Malaysia’s
                centralized single wholesale network.
              </p>
            </div>

            <div className="border-line bg-surface/90 rounded-2xl border p-6 transition-all hover:shadow-md">
              <div className="bg-surface-elevated flex h-12 w-12 items-center justify-center rounded-xl">
                <svg
                  aria-hidden="true"
                  className="text-yes-pink h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </div>
              <h3 className="text-ink mt-4 text-lg font-bold">
                Nationwide Reach
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                Over 80% populated area coverage across Peninsular and East
                Malaysia, including major highways and rural hubs.
              </p>
            </div>

            <div className="border-line bg-surface/90 rounded-2xl border p-6 transition-all hover:shadow-md">
              <div className="bg-surface-elevated flex h-12 w-12 items-center justify-center rounded-xl">
                <svg
                  aria-hidden="true"
                  className="text-yes-pink h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <h3 className="text-ink mt-4 text-lg font-bold">
                Transparent Value
              </h3>
              <p className="text-muted mt-2 text-sm leading-relaxed">
                Simple plans with generous hotspot allocations, free VoLTE, and
                no hidden speed degradation tiers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Newsletter / Updates */}
      <section className="px-(--spacing-gutter)">
        <NewsletterSignup />
      </section>
    </div>
  );
}
