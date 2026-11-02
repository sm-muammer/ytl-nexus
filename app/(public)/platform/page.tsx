import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/platform");

export default function PlatformPage() {
  return <ModulePage path="/platform" register="public" ambient />;
}
