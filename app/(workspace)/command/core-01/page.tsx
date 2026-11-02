import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/command/core-01");

export default function Core01Page() {
  return <ModulePage path="/command/core-01" register="workspace" />;
}
