import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/command/services");

export default function ServicesPage() {
  return <ModulePage path="/command/services" register="workspace" />;
}
