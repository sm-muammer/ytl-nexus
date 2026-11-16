import { Backdrop } from "@/components/backdrop/backdrop";
import {
  ContentUnavailable,
  ItemList,
  SourceLabel,
} from "@/components/content/content-parts";
import { ModuleHero } from "@/components/layout/module-hero";
import { RelatedModules } from "@/components/layout/related-modules";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";
import { listContent } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";

export const metadata = pageMetadata("/library");

// Public page. Visitors receive public items only; Viewers and above also get
// internal ones. The filter is inside listContent, not here.
export default async function LibraryPage() {
  const actor = await getActor();
  const [runbooks, faqs] = await Promise.all([
    listContent("runbook", actor),
    listContent("faq", actor),
  ]);
  const source = runbooks.ok ? runbooks.source : "live";

  return (
    <PageTransition>
      <div>
        <Backdrop path="/library" />
        <ModuleHero page={pageInfo("/library")} register="public" />
        <div className="grid gap-16 px-(--spacing-gutter) py-16">
          {!runbooks.ok || !faqs.ok ? (
            <ContentUnavailable />
          ) : (
            <>
              <section aria-labelledby="runbooks-title">
                <h2
                  id="runbooks-title"
                  className="text-heading-3 font-semibold"
                >
                  Runbooks and notes
                </h2>
                {actor === null ? (
                  <p className="text-muted text-data mt-2 max-w-(--spacing-prose)">
                    You are viewing public items. Sign in to see internal ones.
                  </p>
                ) : null}
                <div className="mt-4">
                  <ItemList items={runbooks.items} />
                </div>
              </section>
              <section aria-labelledby="faq-title">
                <h2 id="faq-title" className="text-heading-3 font-semibold">
                  Frequently asked questions
                </h2>
                <div className="mt-4">
                  <ItemList items={faqs.items} />
                </div>
              </section>
              <SourceLabel source={source} />
              <RelatedModules slugs={["studio", "ai", "status"]} />
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
