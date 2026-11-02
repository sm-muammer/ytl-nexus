import { ModulePage, pageMetadata } from "@/components/layout/module-page";

// Fallback only. On Nexus Core 01 Apache serves /studio/ (WordPress) and never
// forwards it to Next.js, so this page appears locally and in demo mode, where
// Apache is absent. Task 7 documents the split.
export const metadata = pageMetadata("/studio");

export default function StudioPage() {
  return <ModulePage path="/studio" register="workspace" />;
}
