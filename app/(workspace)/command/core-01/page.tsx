import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command/core-01");

export default async function Core01Page() {
  await requirePage("/command/core-01");
  return <ModulePage path="/command/core-01" register="workspace" />;
}
