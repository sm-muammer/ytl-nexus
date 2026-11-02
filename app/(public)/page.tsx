import Link from "next/link";
import { Backdrop } from "@/components/backdrop/backdrop";
import { PageTransition } from "@/components/motion/page-transition";
import { Rise } from "@/components/motion/reveal";
import { MODULES } from "@/lib/navigation/modules";
import { accessLabel } from "@/lib/roles";

// Editorial home page (public register). It names the project honestly: an
// internship project, not an official YTL product. It reads no session and no
// adapter, so every figure on it is a fact about the project, not a metric.

const ctaPrimary =
  "bg-accent-ink text-canvas inline-flex min-h-11 items-center rounded-full px-6 font-medium transition-opacity duration-(--duration-fast) hover:opacity-90";
const ctaSecondary =
  "border-border-strong hover:bg-surface-raised inline-flex min-h-11 items-center rounded-full border px-6 font-medium transition-colors duration-(--duration-fast)";

export default function HomePage() {
  return (
    <PageTransition>
      <div>
        <Backdrop path="/" />
        <section
          aria-labelledby="home-title"
          className="border-line flex min-h-[78dvh] flex-col justify-center border-b"
        >
          <div className="px-(--spacing-gutter) py-(--spacing-section)">
            <Rise>
              <h1
                id="home-title"
                className="text-display font-display font-semibold tracking-tight text-balance"
              >
                YTL Nexus
              </h1>
              <p className="text-ink/80 text-lead mt-6 max-w-2xl text-pretty">
                One platform for infrastructure, intelligence and digital
                services. An internship project built with the YTL
                Communications IT Infrastructure team.
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <Link href="/tour" className={ctaPrimary}>
                  Take the tour
                </Link>
                <Link href="/platform" className={ctaSecondary}>
                  How it fits together
                </Link>
              </div>
            </Rise>
          </div>
        </section>

        <section
          aria-labelledby="modules-heading"
          className="grid gap-12 px-(--spacing-gutter) py-(--spacing-section) lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]"
        >
          <div className="lg:sticky lg:top-8 lg:self-start">
            <h2
              id="modules-heading"
              className="text-heading-2 font-display font-semibold"
            >
              Modules
            </h2>
            <p className="text-muted mt-4 max-w-sm">
              {MODULES.length} modules share one sign-in, one design and one
              server. Each shows its access level, so you know what a link needs
              before you follow it.
            </p>
          </div>

          <ul
            aria-labelledby="modules-heading"
            className="divide-line border-line divide-y border-y"
          >
            {MODULES.map((m) => {
              const body = (
                <>
                  <span className="text-heading-3 font-display font-semibold">
                    {m.name}
                  </span>
                  <span className="text-muted text-data sm:text-right">
                    {accessLabel(m.minRole)}
                  </span>
                  <span className="text-muted text-data sm:col-span-2">
                    {m.subtitle}
                  </span>
                </>
              );
              const cls =
                "hover:bg-surface grid min-h-11 gap-x-6 gap-y-1 px-2 py-5 transition-colors duration-(--duration-fast) sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline";
              return (
                <li key={m.slug}>
                  {m.apacheServed ? (
                    <a href={m.href} className={cls}>
                      {body}
                    </a>
                  ) : (
                    <Link href={m.href} className={cls}>
                      {body}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section
          aria-labelledby="honest-heading"
          className="border-line border-t px-(--spacing-gutter) py-16"
        >
          <h2 id="honest-heading" className="text-heading-3 font-semibold">
            About this project
          </h2>
          <p className="text-muted mt-3 max-w-(--spacing-prose)">
            YTL Nexus is an internship project, not an official YTL commercial
            product. Every value shown is labelled <strong>Live</strong> when it
            comes from Nexus Core 01 and <strong>Demo data</strong> when it
            comes from built-in samples.
          </p>
          <p className="mt-4">
            <Link
              href="/story"
              className="text-accent-ink inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Read the project story
            </Link>
          </p>
        </section>
      </div>
    </PageTransition>
  );
}
