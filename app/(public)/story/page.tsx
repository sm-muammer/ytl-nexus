import { Backdrop } from "@/components/backdrop/backdrop";
import {
  ContentUnavailable,
  ItemBody,
  SourceLabel,
} from "@/components/content/content-parts";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";
import { listContent } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";

export const metadata = pageMetadata("/story");

export default async function StoryPage() {
  const result = await listContent("story_chapter", await getActor());
  return (
    <PageTransition>
      <div>
        <Backdrop path="/story" />
        <ModuleHero page={pageInfo("/story")} register="public" />
        <div className="grid gap-12 px-(--spacing-gutter) py-16">
          <p className="text-muted max-w-(--spacing-prose)">
            YTL Nexus is an internship project, not an official YTL commercial
            product.
          </p>
          {!result.ok ? (
            <ContentUnavailable />
          ) : (
            <>
              {result.items.map((chapter) => (
                <section
                  key={chapter.slug}
                  aria-labelledby={`ch-${chapter.slug}`}
                >
                  <h2
                    id={`ch-${chapter.slug}`}
                    className="text-heading-3 font-semibold"
                  >
                    {chapter.title}
                  </h2>
                  <div className="mt-3">
                    <ItemBody html={chapter.html} />
                  </div>
                </section>
              ))}
              <SourceLabel source={result.source} />
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
