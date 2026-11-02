import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/continuity");

export default async function ContinuityPage() {
  await requirePage("/continuity");
  return <ModulePage path="/continuity" register="workspace" />;
}
