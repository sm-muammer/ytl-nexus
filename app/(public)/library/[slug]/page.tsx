import { notFound } from "next/navigation";
import { Backdrop } from "@/components/backdrop/backdrop";
import {
  AudienceTag,
  ContentUnavailable,
  ItemBody,
  SourceLabel,
} from "@/components/content/content-parts";
import { ModuleHero } from "@/components/layout/module-hero";
import { PageTransition } from "@/components/motion/page-transition";
import type { ContentType } from "@/lib/content/types";
import { verifyPreviewToken } from "@/lib/content/preview";
import { pageInfo } from "@/lib/navigation/modules";
import { getContentItem } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";
import {
  fetchPreview,
  readWordPressConfig,
  wpSecret,
} from "@/lib/server/wordpress";

const SLUG = /^[a-z0-9-]{1,200}$/;
// Library shows runbooks and FAQs; an item is looked up in each.
const TYPES: ContentType[] = ["runbook", "faq"];

export const metadata = { title: "Library item" };

// A short-lived signed link from the Studio "Preview" button shows a draft
// (LIB-06). The token names one item and expires after ten minutes.
async function previewItem(token: string | undefined) {
  const target = verifyPreviewToken(wpSecret(), token ?? "", Date.now());
  const config = readWordPressConfig();
  if (!target || !config) return null;
  return fetchPreview(target.type, target.id, config);
}

export default async function LibraryItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const actor = await getActor();

  if (slug === "preview") {
    const { token } = await searchParams;
    const draft = await previewItem(
      typeof token === "string" ? token : undefined,
    );
    if (!draft) notFound();
    const base = pageInfo("/library");
    return (
      <PageTransition>
        <div>
          <Backdrop path="/library" />
          <ModuleHero
            page={{
              ...base,
              title: draft.title,
              subtitle: "Preview of an unpublished change",
              parent: { name: base.title, href: "/library" },
            }}
            register="public"
          />
          <article className="px-(--spacing-gutter) py-12">
            <p role="status" className="text-data mb-4 font-medium">
              Preview. Visitors do not see this version yet.
            </p>
            <ItemBody html={draft.html} />
          </article>
        </div>
      </PageTransition>
    );
  }

  for (const type of TYPES) {
    const result = await getContentItem(type, slug, actor);
    if (!result.ok) {
      return (
        <div className="px-(--spacing-gutter) py-16">
          <ContentUnavailable />
        </div>
      );
    }
    if (result.item) {
      const item = result.item;
      const base = pageInfo("/library");
      return (
        <PageTransition>
          <div>
            <Backdrop path="/library" />
            <ModuleHero
              page={{
                ...base,
                title: item.title,
                subtitle: item.excerpt || base.subtitle,
                parent: { name: base.title, href: "/library" },
              }}
              register="public"
            />
            <article className="px-(--spacing-gutter) py-12">
              <AudienceTag audience={item.audience} />
              <ItemBody html={item.html} />
              {item.sourceUrl ? (
                <p className="text-muted text-data mt-6">
                  Source:{" "}
                  <a
                    className="underline"
                    href={item.sourceUrl}
                    rel="noopener noreferrer"
                  >
                    {item.sourceUrl}
                  </a>
                </p>
              ) : null}
              <SourceLabel source={result.source} />
            </article>
          </div>
        </PageTransition>
      );
    }
  }
  // Absent and internal-for-a-visitor look the same: a plain 404.
  notFound();
}
