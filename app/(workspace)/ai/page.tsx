import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/ai");

export default async function AiPage() {
  await requirePage("/ai");
  return <ModulePage path="/ai" register="workspace" />;
}
