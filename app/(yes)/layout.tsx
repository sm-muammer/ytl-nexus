import { AppShell } from "@/components/layout/app-shell";

// Yes Experience sits in the public register inside the Nexus shell. Task 15
// adds its own cherry-blossom art direction to the pages under /yes.
export default function YesLayout({ children }: LayoutProps<"/">) {
  return <AppShell register="public">{children}</AppShell>;
}
