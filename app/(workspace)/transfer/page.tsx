import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// Entry page only. The file portal itself is served at /files/ by SFTPGo.
export const metadata = pageMetadata("/transfer");

export default function TransferPage() {
  return <ModulePage path="/transfer" register="workspace" />;
}
