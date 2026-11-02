import { SectionNav } from "@/components/layout/section-nav";
import { findModule } from "@/lib/navigation/modules";

// Contextual navigation for every page under /command (Requirement 3.3).
export default function CommandLayout({ children }: LayoutProps<"/command">) {
  const command = findModule("command");
  return (
    <>
      <SectionNav label="Command sections" items={command.subNav ?? []} />
      {children}
    </>
  );
}
