import { AppShell } from "@/components/layout/app-shell";
import { YesHeader } from "@/components/yes/yes-header";
import { YesFooter } from "@/components/yes/yes-footer";
import { YesChatbot } from "@/components/yes/yes-chatbot";

// Yes Experience sits in the public register inside the Nexus shell. Task 15
// adds its own cherry-blossom art direction, navigation, and Nexus AI integration.
export default function YesLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell register="public">
      <div className="flex min-h-full flex-col">
        <YesHeader />
        <div className="flex-1">{children}</div>
        <YesFooter />
        <YesChatbot />
      </div>
    </AppShell>
  );
}
