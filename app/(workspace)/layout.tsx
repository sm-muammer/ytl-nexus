import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

// Workspace register: dense and dark, for signed-in users. Never indexed
// (Requirement 3.9). Task 6 adds requireRole() to every page in this group.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function WorkspaceLayout({ children }: LayoutProps<"/">) {
  return <AppShell register="workspace">{children}</AppShell>;
}
