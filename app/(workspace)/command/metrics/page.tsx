import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command/metrics");

export default async function MetricsPage() {
  await requirePage("/command/metrics");
  return <ModulePage path="/command/metrics" register="workspace" />;
}
