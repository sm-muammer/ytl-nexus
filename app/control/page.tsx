import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// Administrator-only. Task 6 adds the guard and step-up; Task 19 the tools.
// No particle field: Control uses no decorative motion.
export const metadata = pageMetadata("/control");

export default function ControlPage() {
  return <ModulePage path="/control" register="workspace" />;
}
