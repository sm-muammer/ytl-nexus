import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/ai");

export default function AiPage() {
  return <ModulePage path="/ai" register="workspace" />;
}
