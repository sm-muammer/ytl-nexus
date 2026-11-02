import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/shield");

export default async function ShieldPage() {
  await requirePage("/shield");
  return <ModulePage path="/shield" register="workspace" />;
}
