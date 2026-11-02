import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/command/metrics");

export default function MetricsPage() {
  return <ModulePage path="/command/metrics" register="workspace" />;
}
