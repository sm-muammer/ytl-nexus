import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { RelatedModules } from "@/components/layout/related-modules";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { AiChatView } from "@/components/ai/ai-chat-view";

export const metadata = pageMetadata("/ai");

export default async function AiPage(props: {
  searchParams?: Promise<{ explain?: string }>;
}) {
  await requirePage("/ai");
  const searchParams = props.searchParams
    ? await props.searchParams
    : undefined;
  const explain = searchParams?.explain;
  const demo = getMode() === "demo";

  return (
    <PageTransition>
      <div>
        <Backdrop path="/ai" />
        <ModuleHero page={pageInfo("/ai")} register="workspace" />
        <div className="px-(--spacing-gutter) py-8">
          <AiChatView initialExplainPrompt={explain} demo={demo} />
          <RelatedModules
            slugs={["library", "command", "data"]}
            className="mt-8"
          />
        </div>
      </div>
    </PageTransition>
  );
}
