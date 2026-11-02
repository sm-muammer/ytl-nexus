import { AppShell } from "@/components/layout/app-shell";

// Public register: editorial pages open to Visitors (Requirement 3.1).
export default function PublicLayout({ children }: LayoutProps<"/">) {
  return <AppShell register="public">{children}</AppShell>;
}
