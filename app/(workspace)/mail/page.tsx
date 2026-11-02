import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

// Entry page only. Webmail itself is served at /webmail/ by Roundcube. The
// inbox uses no particles, parallax or transform animation.
export const metadata = pageMetadata("/mail");

export default async function MailPage() {
  await requirePage("/mail");
  return <ModulePage path="/mail" register="workspace" />;
}
