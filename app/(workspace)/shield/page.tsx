import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/shield");

export default function ShieldPage() {
  return <ModulePage path="/shield" register="workspace" />;
}
