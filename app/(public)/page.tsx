import Link from "next/link";
import { Backdrop } from "@/components/backdrop/backdrop";
import { BentoCard } from "@/components/home/bento-card";
import { ParticleLogoLoader } from "@/components/home/particle-logo-loader";
import { PageTransition } from "@/components/motion/page-transition";
import { Fade, Rise } from "@/components/motion/reveal";
import { PUBLIC_MODULES, type ModuleInfo } from "@/lib/navigation/modules";
import { accessLabel } from "@/lib/roles";

// Editorial showcase home page (spec 24). It names the project honestly: an
// internship project, not an official YTL product. It reads no session and no
// adapter, so every figure on it is a static fact about the project, not a
// live metric.

const ctaPrimary =
  "bg-accent-ink text-canvas inline-flex min-h-11 min-w-11 items-center rounded-full px-6 font-medium transition-opacity duration-(--duration-fast) hover:opacity-90";
const ctaSecondary =
  "border-glass-border bg-glass hover:bg-glass-raised text-ink inline-flex min-h-11 min-w-11 items-center rounded-full border px-6 font-medium backdrop-blur-md transition-colors duration-(--duration-fast)";

const PROJECT_FACTS = [
  {
    value: String(PUBLIC_MODULES.length),
    label: "Platform modules",
    note: "From PUBLIC_MODULES · excludes hidden Control",
  },
  {
    value: "1",
    label: "Rocky Linux server",
    note: "Nexus Core 01 · single-host architecture",
  },
  {
    value: "1",
    label: "Unified sign-in",
    note: "Better Auth · Visitor to Administrator",
  },
  {
    value: "2",
    label: "Live / Demo labelled",
    note: "Live telemetry vs deterministic fixtures",
  },
] as const;

const TOPOLOGY_TIERS = [
  {
    name: "Ingress",
    nodeClass: "bg-pink-ink ring-pink-ink/25",
    detail:
      "Apache TLS gateway, security headers, and path routing on ports 80, 443, 2022, 587 and 993.",
  },
  {
    name: "Nexus Core 01",
    nodeClass: "bg-violet-ink ring-violet-ink/25",
    detail:
      "Next.js 16 application enforcing server-side RBAC, Zod validation, and allowlisted nexus-ops actions.",
  },
  {
    name: "Services",
    nodeClass: "bg-accent-ink ring-accent-ink/25",
    detail:
      "Loopback-isolated MariaDB, Prometheus, Ollama AI, SFTPGo, Postfix/Dovecot and headless WordPress.",
  },
] as const;

function tileSpan(slug: string): string {
  if (slug === "command" || slug === "yes") return "md:col-span-2";
  return "md:col-span-1";
}

function ModuleTile({ module }: { module: ModuleInfo }) {
  const isPublic = module.minRole === null;

  return (
    <li className={`${tileSpan(module.slug)} border-line/70 border-r border-b`}>
      <BentoCard href={module.href} apacheServed={module.apacheServed}>
        <span className="relative z-10 flex h-full flex-col justify-between gap-3">
          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span className="text-heading-3 font-display text-ink inline-flex items-baseline gap-2.5 font-semibold tracking-tight">
              <span>{module.name}</span>
              <span
                aria-hidden="true"
                className="text-accent-ink text-sm opacity-0 transition-opacity duration-(--duration-fast) group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                →
              </span>
            </span>
            <span
              className={`font-mono text-xs ${
                isPublic ? "text-accent-ink" : "text-muted"
              }`}
            >
              {accessLabel(module.minRole)}
            </span>
          </span>

          <span className="text-muted max-w-prose text-sm leading-relaxed">
            {module.summary}
          </span>
        </span>
      </BentoCard>
    </li>
  );
}

export default function HomePage() {
  return (
    <PageTransition>
      <div className="relative overflow-x-clip">
        <Backdrop path="/" />

        <section
          aria-labelledby="home-title"
          className="relative flex min-h-[calc(100dvh-4.25rem)] flex-col justify-between px-(--spacing-gutter) pt-6 pb-8 lg:pt-12 lg:pb-10"
        >
          <ParticleLogoLoader />

          <div className="max-w-page mx-auto my-auto grid w-full items-center gap-8 lg:grid-cols-12 lg:gap-12">
            <div
              data-particle-stage
              aria-hidden="true"
              className="pointer-events-none relative -z-[1] order-1 min-h-[38dvh] w-full sm:min-h-[42dvh] lg:order-2 lg:col-span-6 lg:min-h-[64dvh]"
            />

            <div className="pointer-events-auto relative z-10 order-2 lg:order-1 lg:col-span-6">
              <Rise>
                <p className="text-accent-ink font-mono text-xs font-medium tracking-[0.22em] uppercase">
                  Internship project · YTL Communications
                </p>
                <h1
                  id="home-title"
                  className="text-display font-display text-ink mt-4 font-semibold tracking-tight text-balance"
                >
                  YTL Nexus
                </h1>
                <p className="text-ink/85 text-lead mt-6 max-w-2xl text-pretty">
                  One platform for infrastructure, intelligence and digital
                  services. An internship project by Muammer, built with the YTL
                  Communications IT Infrastructure team.
                </p>
                <div className="mt-9 flex flex-wrap gap-3">
                  <Link href="/tour" className={ctaPrimary}>
                    Take the tour
                  </Link>
                  <Link href="/platform" className={ctaSecondary}>
                    How it fits together
                  </Link>
                </div>
                <p className="border-line/60 text-muted mt-10 max-w-xl border-t pt-4 text-xs">
                  Engineered by Muammer · Rocky Linux (Nexus Core 01) · 16
                  unified modules
                </p>
              </Rise>
            </div>
          </div>

          <div className="pointer-events-auto relative z-10 mx-auto mt-6 flex justify-center">
            <a
              href="#facts-strip"
              className="text-muted hover:text-ink inline-flex min-h-11 min-w-11 items-center gap-3 rounded-full px-4 py-2 font-mono text-xs tracking-[0.2em] uppercase transition-colors duration-(--duration-fast)"
            >
              <span
                aria-hidden="true"
                className="border-border-strong/70 flex h-7 w-4 justify-center rounded-full border pt-1.5"
              >
                <span className="bg-accent-ink nx-scroll-cue-dot size-1.5 rounded-full" />
              </span>
              <span>Scroll</span>
            </a>
          </div>
        </section>

        <div className="relative z-10">
          <section
            id="facts-strip"
            aria-labelledby="facts-heading"
            className="max-w-page mx-auto px-(--spacing-gutter) py-12 lg:py-16"
          >
            <Fade>
              <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="facts-heading"
                  className="text-accent-ink font-mono text-xs font-medium tracking-[0.22em] uppercase"
                >
                  Project facts · Static configuration
                </h2>
                <p className="text-muted font-mono text-xs">
                  Derived from code — not live server telemetry
                </p>
              </div>
              <dl className="border-line/70 divide-line/70 grid divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                {PROJECT_FACTS.map((fact) => (
                  <div key={fact.label} className="flex flex-col gap-1.5 p-6">
                    <dt className="text-muted font-mono text-xs tracking-[0.14em] uppercase">
                      {fact.label}
                    </dt>
                    <dd className="text-heading-1 font-display text-ink order-first font-semibold tracking-tight tabular-nums">
                      {fact.value}
                    </dd>
                    <dd className="text-muted mt-1 font-mono text-xs">
                      {fact.note}
                    </dd>
                  </div>
                ))}
              </dl>
            </Fade>
          </section>

          <section
            aria-labelledby="modules-heading"
            className="max-w-page border-line/70 mx-auto grid gap-10 border-t px-(--spacing-gutter) py-(--spacing-section) lg:grid-cols-[minmax(0,1fr)_minmax(0,2.3fr)] lg:gap-16"
          >
            <div className="lg:sticky lg:top-24 lg:self-start">
              <Rise>
                <h2
                  id="modules-heading"
                  className="text-heading-2 font-display text-ink font-semibold tracking-tight"
                >
                  Modules
                </h2>
                <p className="text-muted mt-4 max-w-sm">
                  {PUBLIC_MODULES.length} modules share one sign-in, one design
                  and one server. Each shows its access level, so you know what
                  a link needs before you follow it.
                </p>
              </Rise>
            </div>

            <ul
              aria-labelledby="modules-heading"
              className="border-line/70 grid grid-cols-1 border-t border-l md:grid-cols-2"
            >
              {PUBLIC_MODULES.map((m) => (
                <ModuleTile key={m.slug} module={m} />
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="architecture-heading"
            className="max-w-page border-line/70 mx-auto border-t px-(--spacing-gutter) py-(--spacing-section)"
          >
            <Rise>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2
                    id="architecture-heading"
                    className="text-heading-2 font-display text-ink font-semibold tracking-tight"
                  >
                    How it fits together
                  </h2>
                  <p className="text-muted mt-3 max-w-2xl">
                    One hardened Rocky Linux host separates public ingress from
                    loopback-isolated databases, AI and telemetry across
                    explicit trust boundaries.
                  </p>
                </div>
                <Link href="/platform" className={ctaSecondary}>
                  Explore platform architecture
                </Link>
              </div>

              <div className="mt-12">
                <div
                  aria-hidden="true"
                  className="relative mb-6 hidden h-5 items-center lg:grid lg:grid-cols-3 lg:gap-8"
                >
                  <div className="bg-line/70 pointer-events-none absolute top-1/2 right-[16.666%] left-[16.666%] h-0.5 -translate-y-1/2 overflow-hidden rounded-full">
                    <div className="nx-topology-signal-pulse h-full w-1/3" />
                  </div>
                  {TOPOLOGY_TIERS.map((tier) => (
                    <div
                      key={`node-${tier.name}`}
                      className="relative z-10 flex justify-center"
                    >
                      <span
                        className={`border-canvas size-3 rounded-full border-2 ring-4 ${tier.nodeClass}`}
                      />
                    </div>
                  ))}
                </div>

                <div className="divide-line/70 border-line/70 grid divide-y border-y lg:grid-cols-3 lg:divide-x lg:divide-y-0">
                  {TOPOLOGY_TIERS.map((tier) => (
                    <div
                      key={tier.name}
                      className="flex flex-col gap-2 py-6 lg:px-8 lg:first:pl-0 lg:last:pr-0"
                    >
                      <h3 className="text-heading-3 font-display text-ink inline-flex items-center gap-2.5 font-semibold">
                        <span
                          aria-hidden="true"
                          className={`size-2 rounded-full ring-2 lg:hidden ${tier.nodeClass}`}
                        />
                        {tier.name}
                      </h3>
                      <p className="text-muted text-sm leading-relaxed">
                        {tier.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </Rise>
          </section>

          <section
            aria-labelledby="honest-heading"
            className="max-w-page border-line/70 mx-auto border-t px-(--spacing-gutter) py-16"
          >
            <Fade>
              <h2
                id="honest-heading"
                className="text-heading-3 font-display text-ink font-semibold"
              >
                About this project
              </h2>
              <p className="text-muted mt-3 max-w-(--spacing-prose)">
                YTL Nexus is an internship project designed and engineered by{" "}
                <strong className="text-ink">Muammer</strong> with the YTL
                Communications IT Infrastructure team, not an official YTL
                commercial product. Every value shown is labelled{" "}
                <strong className="text-ink">Live</strong> when it comes from
                Nexus Core 01 and{" "}
                <strong className="text-ink">Demo data</strong> when it comes
                from built-in samples.
              </p>
              <p className="mt-4">
                <Link
                  href="/story"
                  className="text-accent-ink inline-flex min-h-11 items-center font-medium underline underline-offset-4"
                >
                  Read the project story
                </Link>
              </p>
            </Fade>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
