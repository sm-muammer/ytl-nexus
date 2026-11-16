import { Backdrop } from "@/components/backdrop/backdrop";
import {
  ContentUnavailable,
  ItemBody,
  SourceLabel,
} from "@/components/content/content-parts";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { Rise } from "@/components/motion/reveal";
import { pageInfo } from "@/lib/navigation/modules";
import { listContent } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";

export const metadata = pageMetadata("/story");

export default async function StoryPage() {
  const result = await listContent("story_chapter", await getActor());
  const chapters = result.ok
    ? [...result.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    : [];

  return (
    <PageTransition>
      <div>
        <Backdrop path="/story" />
        <ModuleHero page={pageInfo("/story")} register="public" />

        <div className="grid gap-12 px-(--spacing-gutter) py-16">
          <div className="border-border-strong border-l-2 pl-6">
            <p className="text-muted text-heading-4 max-w-(--spacing-prose) font-normal italic">
              YTL Nexus is an internship project, not an official YTL commercial
              product.
            </p>
            <p className="text-muted text-data mt-2 max-w-(--spacing-prose)">
              A reflective engineering case study on unifying infrastructure,
              security, local AI, and modern web applications on a single
              hardened host.
            </p>
          </div>

          {!result.ok ? (
            <ContentUnavailable />
          ) : (
            <div className="grid max-w-(--spacing-prose) gap-16">
              {chapters.map((chapter, index) => (
                <Rise key={chapter.slug} delay={index * 0.05}>
                  <article
                    aria-labelledby={`ch-${chapter.slug}`}
                    className="relative"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span className="bg-surface text-muted border-border text-caption rounded-sm border px-2 py-0.5 font-mono font-medium">
                        Chapter {index + 1}
                      </span>
                    </div>
                    <h2
                      id={`ch-${chapter.slug}`}
                      className="text-heading-3 font-semibold tracking-tight"
                    >
                      {chapter.title}
                    </h2>
                    <div className="mt-4 leading-relaxed">
                      <ItemBody html={chapter.html} />
                    </div>
                  </article>
                </Rise>
              ))}

              <div className="border-border border-t pt-8">
                <SourceLabel source={result.source} />
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
