import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/data");

export default async function DataPage() {
  await requirePage("/data");
  return <ModulePage path="/data" register="workspace" />;
}
