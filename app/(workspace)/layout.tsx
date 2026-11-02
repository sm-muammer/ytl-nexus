import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { requestPath, requireRole } from "@/lib/server/guards";

// Workspace register: dense and dark, for signed-in users. Never indexed
// (Requirement 3.9). Everything in this group needs at least the Viewer role, so
// the layout enforces that as a floor. Layouts do not run again when someone
// navigates between pages, so every page also calls requirePage() itself with
// its own, stricter minimum.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function WorkspaceLayout({ children }: LayoutProps<"/">) {
  await requireRole("viewer", { path: await requestPath() });
  return <AppShell register="workspace">{children}</AppShell>;
}
