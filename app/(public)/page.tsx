import Link from "next/link";
import { Backdrop } from "@/components/backdrop/backdrop";
import { BentoCard } from "@/components/home/bento-card";
import { ParticleLogoLoader } from "@/components/home/particle-logo-loader";
import { PageTransition } from "@/components/motion/page-transition";
import { Fade, Rise } from "@/components/motion/reveal";
import {
  MODULES,
  NAV_GROUP_LABEL,
  PUBLIC_MODULES,
  type Accent,
  type ModuleInfo,
} from "@/lib/navigation/modules";
import { accessLabel } from "@/lib/roles";

// Editorial showcase home page (spec 24). It names the project honestly: an
// internship project, not an official YTL product. It reads no session and no
// adapter, so every figure on it is a static fact about the project, not a
// live metric.

const ctaPrimary =
  "bg-accent-ink text-canvas inline-flex min-h-11 min-w-11 items-center rounded-full px-6 font-medium transition-opacity duration-(--duration-fast) hover:opacity-90";
const ctaSecondary =
  "border-glass-border bg-glass hover:bg-glass-raised text-ink inline-flex min-h-11 min-w-11 items-center rounded-full border px-6 font-medium backdrop-blur-md transition-colors duration-(--duration-fast)";

const FEATURED_SLUGS = new Set(["command", "ai", "yes"]);

const ACCENT_DOT_CLASS: Record<Accent, string> = {
  blue: "bg-accent-ink",
  pink: "bg-pink-ink",
  violet: "bg-violet-ink",
};

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

const HERO_IDENTITY = [
  {
    label: "Architect / Builder",
    value: "Muammer",
    detail: "YTL Comms IT Infrastructure",
  },
  {
    label: "Runtime Host",
    value: "Nexus Core 01",
    detail: "Rocky Linux · Loopback isolated",
  },
  {
    label: "Unified Platform",
    value: `${MODULES.length} Modules · 1 SSO`,
    detail: "Next.js 16 · WebGL2 · Live + Demo",
  },
] as const;

const HERO_QUICK_LINKS = [
  { label: "Command", href: "/command", dot: "bg-accent-ink" },
  { label: "Atlas", href: "/command/atlas", dot: "bg-accent-ink" },
  { label: "Nexus AI", href: "/ai", dot: "bg-violet-ink" },
  { label: "Yes 5G", href: "/yes", dot: "bg-pink-ink" },
  { label: "Shield", href: "/shield", dot: "bg-accent-ink" },
] as const;

const TOPOLOGY_TIERS = [
  {
    step: "01",
    name: "Ingress",
    nodeClass: "bg-pink-ink ring-pink-ink/25",
    detail:
      "Apache TLS gateway, security headers, and path routing on ports 80, 443, 2022, 587 and 993.",
  },
  {
    step: "02",
    name: "Nexus Core 01",
    nodeClass: "bg-violet-ink ring-violet-ink/25",
    detail:
      "Next.js 16 application enforcing server-side RBAC, Zod validation, and allowlisted nexus-ops actions.",
  },
  {
    step: "03",
    name: "Services",
    nodeClass: "bg-accent-ink ring-accent-ink/25",
    detail:
      "Loopback-isolated MariaDB, Prometheus, Ollama AI, SFTPGo, Postfix/Dovecot and headless WordPress.",
  },
] as const;

function tileSpan(slug: string): string {
  if (slug === "yes") return "md:col-span-3 lg:col-span-6";
  if (slug === "command" || slug === "ai") return "md:col-span-2 lg:col-span-4";
  return "md:col-span-1 lg:col-span-2";
}

function ModuleTile({ module }: { module: ModuleInfo }) {
  const featured = FEATURED_SLUGS.has(module.slug);
  const wide = module.slug === "yes";
  const isPublic = module.minRole === null;
  const pillClass = isPublic
    ? "border-accent-ink/35 bg-accent-ink/10 text-accent-ink"
    : "border-glass-border bg-surface-raised/80 text-muted";

  return (
    <li className={tileSpan(module.slug)}>
      <BentoCard href={module.href} apacheServed={module.apacheServed}>
        <span
          className={`relative z-10 flex h-full flex-col justify-between gap-5 ${
            wide ? "lg:flex-row lg:items-center lg:gap-10" : ""
          }`}
        >
          <span className="flex flex-col gap-3">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted inline-flex items-center gap-2 font-mono text-xs tracking-[0.16em] uppercase">
                <span
                  aria-hidden="true"
                  className={`size-1.5 rounded-full ${ACCENT_DOT_CLASS[module.accent]}`}
                />
                {NAV_GROUP_LABEL[module.group]}
              </span>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-xs ${pillClass}`}
              >
                {accessLabel(module.minRole)}
              </span>
            </span>

            <span className="text-heading-3 font-display text-ink font-semibold tracking-tight">
              {module.name}
            </span>

            <span className="text-muted text-sm">{module.subtitle}</span>

            <span
              className={`max-w-prose text-sm leading-relaxed ${
                featured
                  ? wide
                    ? "text-ink/80"
                    : "text-ink/80 line-clamp-2"
                  : "text-ink/75 line-clamp-2"
              }`}
            >
              {module.summary}
            </span>
          </span>

          <span
            className={`border-glass-border/70 text-muted flex items-center justify-between gap-4 border-t pt-3 font-mono text-xs ${
              wide
                ? "lg:shrink-0 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8"
                : ""
            }`}
          >
            <span className="truncate">{module.href}</span>
            <span
              aria-hidden="true"
              className="text-accent-ink transition-opacity duration-(--duration-fast) group-hover:opacity-100"
            >
              →
            </span>
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
          <div aria-hidden="true" className="nx-hero-dynamic-bg -z-[2]">
            <div className="nx-hero-aurora-cone" />
            <div className="nx-hero-perspective-grid">
              <div className="nx-hero-perspective-grid-lines" />
            </div>
          </div>

          <ParticleLogoLoader />

          <div className="max-w-page mx-auto my-auto grid w-full items-center gap-8 lg:grid-cols-12 lg:gap-12">
            <div
              aria-hidden="true"
              className="pointer-events-none relative -z-[1] order-1 flex flex-col items-center gap-3 lg:order-2 lg:col-span-6"
            >
              <div
                data-particle-stage
                className="relative flex min-h-[34dvh] w-full items-center justify-center sm:min-h-[38dvh] lg:min-h-[58dvh]"
              >
                <div className="nx-orbital-ring absolute size-[min(74vw,24rem)] rounded-full opacity-55 lg:size-[min(36vw,30rem)]" />
                <div className="nx-orbital-ring-reverse absolute size-[min(86vw,29rem)] rounded-full opacity-40 lg:size-[min(43vw,36rem)]" />
              </div>
              <div className="border-glass-border/80 bg-glass/80 text-muted hidden rounded-full border px-3.5 py-1 font-mono text-[11px] tracking-[0.14em] whitespace-nowrap uppercase backdrop-blur-md sm:inline-flex">
                Drag to spin · Move pointer to ripple · Scroll to disperse
              </div>
            </div>

            <div className="pointer-events-auto relative z-10 order-2 lg:order-1 lg:col-span-6">
              <Rise>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-accent-ink font-mono text-xs font-medium tracking-[0.22em] uppercase">
                    Internship project · YTL Communications
                  </p>
                  <span className="border-glass-border bg-glass text-ink/90 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-mono text-xs backdrop-blur-md">
                    <span
                      aria-hidden="true"
                      className="bg-accent-ink size-1.5 rounded-full"
                    />
                    Built by Muammer · IT Infrastructure
                  </span>
                </div>
                <h1
                  id="home-title"
                  className="text-display font-display text-ink mt-4 font-semibold tracking-tight text-balance"
                >
                  YTL Nexus
                </h1>
                <p className="text-ink/85 text-lead mt-6 max-w-2xl text-pretty">
                  One platform for infrastructure, intelligence and digital
                  services. An internship project built with the YTL
                  Communications IT Infrastructure team.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/tour" className={ctaPrimary}>
                    Take the tour
                  </Link>
                  <Link href="/platform" className={ctaSecondary}>
                    How it fits together
                  </Link>
                </div>

                <div className="border-glass-border bg-glass mt-8 rounded-2xl border p-4 backdrop-blur-md">
                  <dl className="divide-glass-border grid grid-cols-1 gap-4 divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                    {HERO_IDENTITY.map((item) => (
                      <div
                        key={item.label}
                        className="flex flex-col gap-0.5 pt-3 first:pt-0 sm:pt-0 sm:pl-4 sm:first:pl-0"
                      >
                        <dt className="text-muted font-mono text-[11px] tracking-[0.16em] uppercase">
                          {item.label}
                        </dt>
                        <dd className="font-display text-ink text-base font-semibold tracking-tight">
                          {item.value}
                        </dd>
                        <dd className="text-muted font-mono text-[11px]">
                          {item.detail}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <nav
                    aria-label="Quick module launch"
                    className="border-glass-border/70 mt-4 flex flex-wrap items-center gap-2 border-t pt-3"
                  >
                    <span className="text-muted mr-1 font-mono text-[11px] tracking-[0.16em] uppercase">
                      Quick launch
                    </span>
                    {HERO_QUICK_LINKS.map((q) => (
                      <Link
                        key={q.href}
                        href={q.href}
                        className="border-glass-border bg-surface/75 hover:bg-glass-raised hover:border-border-strong text-ink/90 hover:text-ink inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 font-mono text-xs transition-colors duration-(--duration-fast)"
                      >
                        <span
                          aria-hidden="true"
                          className={`size-1.5 rounded-full ${q.dot}`}
                        />
                        {q.label}
                      </Link>
                    ))}
                  </nav>
                </div>
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
              <dl className="border-glass-border bg-glass divide-glass-border grid divide-y overflow-hidden rounded-2xl border backdrop-blur-md sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
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
            className="max-w-page mx-auto px-(--spacing-gutter) py-(--spacing-section)"
          >
            <Rise>
              <div className="mb-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-pink-ink font-mono text-xs font-medium tracking-[0.22em] uppercase">
                    Unified workspace
                  </p>
                  <h2
                    id="modules-heading"
                    className="text-heading-2 font-display text-ink mt-2 font-semibold tracking-tight"
                  >
                    Modules
                  </h2>
                </div>
                <p className="text-muted max-w-md">
                  {PUBLIC_MODULES.length} modules share one sign-in, one design
                  and one server. Each shows its access level, so you know what
                  a link needs before you follow it.
                </p>
              </div>
            </Rise>

            <ul
              aria-labelledby="modules-heading"
              className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6"
            >
              {PUBLIC_MODULES.map((m) => (
                <ModuleTile key={m.slug} module={m} />
              ))}
            </ul>
          </section>

          <section
            aria-labelledby="architecture-heading"
            className="max-w-page mx-auto px-(--spacing-gutter) py-12 lg:py-16"
          >
            <Rise>
              <div className="border-glass-border bg-glass relative overflow-hidden rounded-2xl border p-8 backdrop-blur-md lg:p-12">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-accent-ink font-mono text-xs font-medium tracking-[0.22em] uppercase">
                      Architecture
                    </p>
                    <h2
                      id="architecture-heading"
                      className="text-heading-2 font-display text-ink mt-2 font-semibold tracking-tight"
                    >
                      How it fits together
                    </h2>
                    <p className="text-muted mt-3 max-w-2xl">
                      One hardened Rocky Linux host separates public ingress
                      from loopback-isolated databases, AI and telemetry across
                      explicit trust boundaries.
                    </p>
                  </div>
                  <Link href="/platform" className={ctaSecondary}>
                    Explore platform architecture
                  </Link>
                </div>

                <div className="mt-10">
                  <div
                    aria-hidden="true"
                    className="relative mb-4 hidden h-5 items-center lg:grid lg:grid-cols-3 lg:gap-8"
                  >
                    <div className="bg-glass-border pointer-events-none absolute top-1/2 right-[16.666%] left-[16.666%] h-0.5 -translate-y-1/2 overflow-hidden rounded-full">
                      <div className="nx-topology-signal-pulse h-full w-1/3" />
                    </div>
                    {TOPOLOGY_TIERS.map((tier) => (
                      <div
                        key={`node-${tier.step}`}
                        className="relative z-10 flex justify-center"
                      >
                        <span
                          className={`border-canvas size-3 rounded-full border-2 ring-4 ${tier.nodeClass}`}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="grid gap-6 lg:grid-cols-3 lg:gap-8">
                    {TOPOLOGY_TIERS.map((tier) => (
                      <div
                        key={tier.step}
                        className="border-glass-border bg-surface/85 relative z-10 flex flex-col gap-2 rounded-xl border p-6 backdrop-blur-md"
                      >
                        <span className="text-accent-ink inline-flex items-center gap-2 font-mono text-xs tracking-[0.2em] uppercase">
                          <span
                            aria-hidden="true"
                            className={`size-2 rounded-full ring-2 lg:hidden ${tier.nodeClass}`}
                          />
                          Tier {tier.step}
                        </span>
                        <h3 className="text-heading-3 font-display text-ink font-semibold">
                          {tier.name}
                        </h3>
                        <p className="text-muted text-sm leading-relaxed">
                          {tier.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Rise>
          </section>

          <section
            aria-labelledby="honest-heading"
            className="max-w-page mx-auto px-(--spacing-gutter) pt-4 pb-(--spacing-section)"
          >
            <Fade>
              <div className="border-glass-border bg-glass rounded-2xl border p-8 backdrop-blur-md lg:p-10">
                <p className="text-pink-ink font-mono text-xs font-medium tracking-[0.22em] uppercase">
                  Internship disclosure
                </p>
                <h2
                  id="honest-heading"
                  className="text-heading-3 font-display text-ink mt-2 font-semibold"
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
                <p className="mt-5">
                  <Link
                    href="/story"
                    className="text-accent-ink inline-flex min-h-11 items-center font-medium underline underline-offset-4"
                  >
                    Read the project story
                  </Link>
                </p>
              </div>
            </Fade>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
