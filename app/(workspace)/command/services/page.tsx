import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command/services");

export default async function ServicesPage() {
  await requirePage("/command/services");
  return <ModulePage path="/command/services" register="workspace" />;
}
