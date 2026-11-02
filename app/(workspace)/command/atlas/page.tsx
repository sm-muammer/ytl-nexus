import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/command/atlas");

export default function AtlasPage() {
  return <ModulePage path="/command/atlas" register="workspace" />;
}
