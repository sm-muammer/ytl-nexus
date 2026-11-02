import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";
import { requirePage } from "@/lib/server/guards";

// Nexus Control is hidden administration. It is never indexed and is left out
// of robots.txt on purpose, because listing it there would reveal it exists.
//
// Anyone who is not an Administrator, a Visitor included, gets notFound() from
// here, before any part of the shell renders. That produces the same 404 as a
// path that does not exist (requirement 6.11). The page and every future page
// below it guard themselves as well, because layouts do not re-run on
// navigation. For the same reason no page below /control exports a static
// title: it would show in the 404 (see lib/server/control-metadata.ts).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ControlLayout({
  children,
}: LayoutProps<"/control">) {
  await requirePage("/control");
  return <AppShell register="workspace">{children}</AppShell>;
}
