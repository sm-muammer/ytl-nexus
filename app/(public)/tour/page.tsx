import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { TourView } from "@/components/tour/tour-view";
import { contentFixtures } from "@/lib/fixtures/content";
import { pageInfo } from "@/lib/navigation/modules";
import { listContent } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";

export const metadata = pageMetadata("/tour");

export default async function TourPage() {
  const result = await listContent("tour_step", await getActor());
  const steps =
    result.ok && result.items.length > 0
      ? [...result.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [...contentFixtures.filter((i) => i.type === "tour_step")].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
  const source = result.ok && result.items.length > 0 ? result.source : "demo";

  return (
    <PageTransition>
      <div>
        <Backdrop path="/tour" />
        <ModuleHero page={pageInfo("/tour")} register="public" />

        <div className="mx-auto max-w-(--spacing-page) px-(--spacing-gutter) py-12">
          <TourView steps={steps} source={source} />
        </div>
      </div>
    </PageTransition>
  );
}
