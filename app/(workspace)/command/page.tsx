import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// The particle field for Nexus Command is built in Task 8.
export const metadata = pageMetadata("/command");

export default function CommandPage() {
  return <ModulePage path="/command" register="workspace" />;
}
