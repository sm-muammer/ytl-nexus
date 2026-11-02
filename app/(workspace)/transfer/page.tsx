import { ModulePage, pageMetadata } from "@/components/layout/module-page";
import { requirePage } from "@/lib/server/guards";

// Entry page only. The file portal itself is served at /files/ by SFTPGo.
export const metadata = pageMetadata("/transfer");

export default async function TransferPage() {
  await requirePage("/transfer");
  return <ModulePage path="/transfer" register="workspace" />;
}
