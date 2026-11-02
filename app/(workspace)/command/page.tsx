import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

// The particle field for Nexus Command is built in Task 8.
export const metadata = pageMetadata("/command");

export default async function CommandPage() {
  await requirePage("/command");
  return <ModulePage path="/command" register="workspace" />;
}
