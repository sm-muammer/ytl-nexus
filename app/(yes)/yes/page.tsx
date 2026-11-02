import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// /yes/* pages arrive with Task 15; this is the entry.
export const metadata = pageMetadata("/yes");

export default function YesPage() {
  return <ModulePage path="/yes" register="public" />;
}
