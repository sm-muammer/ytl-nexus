import Link from "next/link";
import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { TourView } from "@/components/tour/tour-view";
import { contentFixtures } from "@/lib/fixtures/content";
import { pageInfo } from "@/lib/navigation/modules";
import { listContent } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";
import { parseInitialTourStep } from "@/lib/tour/slides";

export const metadata = pageMetadata("/tour");

const CONTINUE_LINKS = [
  {
    href: "/platform",
    title: "Platform",
    description:
      "Inspect the 3-tier network topology, 6 trust boundaries and runtime services.",
  },
  {
    href: "/story",
    title: "Project Story",
    description:
      "Read the 6-chapter engineering case study, trade-offs and team handover.",
  },
  {
    href: "/library",
    title: "Nexus Library",
    description:
      "Browse public runbooks, FAQs and documentation synced from Nexus Studio.",
  },
  {
    href: "/yes",
    title: "Yes Experience",
    description:
      "Explore the Yes 5G plans, coverage lookup and cherry-blossom design.",
  },
] as const;

export default async function TourPage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string | string[] }>;
}) {
  const [actor, resolvedSearchParams] = await Promise.all([
    getActor(),
    searchParams,
  ]);
  const result = await listContent("tour_step", actor);

  const steps =
    result.ok && result.items.length > 0
      ? [...result.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [...contentFixtures.filter((i) => i.type === "tour_step")].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
  const source = result.ok && result.items.length > 0 ? result.source : "demo";
  const initialStep = parseInitialTourStep(
    resolvedSearchParams.step,
    steps.length,
  );

  return (
    <PageTransition>
      <div>
        <Backdrop path="/tour" />
        <ModuleHero page={pageInfo("/tour")} register="public" />

        <div className="max-w-page mx-auto px-(--spacing-gutter) pb-16">
          <TourView steps={steps} source={source} initialStep={initialStep} />

          <section
            aria-labelledby="tour-continue-title"
            className="border-line mt-16 border-t pt-10"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id="tour-continue-title"
                className="font-display text-heading-3 text-ink font-semibold tracking-tight"
              >
                Continue exploring
              </h2>
              <span className="text-muted font-mono text-xs">
                Public showcase routes
              </span>
            </div>

            <ul className="border-line mt-6 grid grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-4">
              {CONTINUE_LINKS.map((item) => (
                <li key={item.href} className="border-line border-r border-b">
                  <Link
                    href={item.href}
                    className="hover:bg-surface/65 group flex h-full min-h-28 flex-col justify-between gap-3 p-5 transition-colors duration-150 ease-out"
                  >
                    <div>
                      <span className="font-display text-ink inline-flex items-baseline gap-2 text-base font-semibold">
                        <span>{item.title}</span>
                        <span
                          aria-hidden="true"
                          className="text-accent-ink text-sm transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                        >
                          →
                        </span>
                      </span>
                      <p className="text-muted text-data mt-1.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
