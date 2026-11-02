import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// /library/* item pages arrive with Task 7; this is the index.
export const metadata = pageMetadata("/library");

export default function LibraryPage() {
  return <ModulePage path="/library" register="public" ambient />;
}
