import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { StoryView } from "@/components/story/story-view";
import { contentFixtures } from "@/lib/fixtures/content";
import { pageInfo } from "@/lib/navigation/modules";
import { listContent } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";
import "./story.css";

export const metadata = pageMetadata("/story");

export default async function StoryPage() {
  const result = await listContent("story_chapter", await getActor());
  const chapters =
    result.ok && result.items.length > 0
      ? [...result.items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [...contentFixtures.filter((i) => i.type === "story_chapter")].sort(
          (a, b) => (a.order ?? 0) - (b.order ?? 0),
        );
  const source = result.ok && result.items.length > 0 ? result.source : "demo";

  return (
    <PageTransition>
      <div>
        <Backdrop path="/story" />
        <ModuleHero page={pageInfo("/story")} register="public" />
        <StoryView chapters={chapters} source={source} />
      </div>
    </PageTransition>
  );
}
