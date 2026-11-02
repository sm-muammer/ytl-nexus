import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// Entry page only. Webmail itself is served at /webmail/ by Roundcube. The
// inbox uses no particles, parallax or transform animation.
export const metadata = pageMetadata("/mail");

export default function MailPage() {
  return <ModulePage path="/mail" register="workspace" />;
}
