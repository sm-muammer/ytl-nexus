import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/status");

export default function StatusPage() {
  return <ModulePage path="/status" register="public" />;
}
