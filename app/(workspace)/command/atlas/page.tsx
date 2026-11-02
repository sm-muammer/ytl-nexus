import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command/atlas");

export default async function AtlasPage() {
  await requirePage("/command/atlas");
  return <ModulePage path="/command/atlas" register="workspace" />;
}
