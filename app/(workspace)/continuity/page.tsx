import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/continuity");

export default function ContinuityPage() {
  return <ModulePage path="/continuity" register="workspace" />;
}
