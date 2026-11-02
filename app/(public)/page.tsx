import Link from "next/link";
import { AmbientField } from "@/components/motion/ambient-field";
import { PageTransition } from "@/components/motion/page-transition";
import { Rise, Stagger, StaggerItem } from "@/components/motion/reveal";
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
        <section
          aria-labelledby="home-title"
          className="border-line relative isolate flex min-h-[70dvh] flex-col justify-center overflow-hidden border-b"
        >
          <AmbientField className="absolute inset-0 -z-10" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_85%_5%,color-mix(in_oklab,var(--color-ytl-blue)_22%,transparent),transparent_70%),radial-gradient(50rem_36rem_at_0%_100%,color-mix(in_oklab,var(--color-yes-pink)_16%,transparent),transparent_70%)]"
          />
          <div className="px-(--spacing-gutter) py-(--spacing-section)">
            <Rise>
              <p className="text-accent-ink font-mono text-xs tracking-[0.3em] uppercase">
                YTL Communications IT Infrastructure
              </p>
            </Rise>
            <Rise delay={0.06}>
              <h1
                id="home-title"
                className="text-display mt-6 font-serif font-medium tracking-tight text-balance"
              >
                YTL Nexus
              </h1>
            </Rise>
            <Rise delay={0.12}>
              <p className="text-muted text-lead mt-6 max-w-2xl text-pretty">
                One platform for infrastructure, intelligence and digital
                services. An internship project built with the YTL
                Communications IT Infrastructure team.
              </p>
            </Rise>
            <Rise delay={0.18} className="mt-10 flex flex-wrap gap-3">
              <Link href="/tour" className={ctaPrimary}>
                Take the tour
              </Link>
              <Link href="/platform" className={ctaSecondary}>
                How it fits together
              </Link>
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
              className="text-heading-2 font-serif font-medium"
            >
              Modules
            </h2>
            <p className="text-muted mt-4 max-w-sm">
              {MODULES.length} modules share one sign-in, one design and one
              server. Each shows its access level, so you know what a link needs
              before you follow it.
            </p>
          </div>

          <Stagger
            as="ul"
            aria-labelledby="modules-heading"
            className="divide-line border-line divide-y border-y"
          >
            {MODULES.map((m, index) => {
              const body = (
                <>
                  <span className="text-heading-3 font-serif font-medium">
                    {m.name}
                  </span>
                  <span className="border-line text-muted justify-self-start rounded-full border px-3 py-0.5 font-mono text-xs tracking-wide uppercase sm:justify-self-end">
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
                <StaggerItem as="li" key={m.slug} index={index}>
                  {m.apacheServed ? (
                    <a href={m.href} className={cls}>
                      {body}
                    </a>
                  ) : (
                    <Link href={m.href} className={cls}>
                      {body}
                    </Link>
                  )}
                </StaggerItem>
              );
            })}
          </Stagger>
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
