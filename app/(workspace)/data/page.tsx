import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/data");

export default function DataPage() {
  return <ModulePage path="/data" register="workspace" />;
}
