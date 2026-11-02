import type { Metadata } from "next";
import { AppShell } from "@/components/layout/app-shell";

// Nexus Control is hidden administration. It is never indexed and is left out
// of robots.txt on purpose, because listing it there would reveal it exists.
// Task 6 makes non-administrators receive the same 404 as an unknown path.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ControlLayout({ children }: LayoutProps<"/control">) {
  return <AppShell register="workspace">{children}</AppShell>;
}
