import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/story");

export default function StoryPage() {
  return <ModulePage path="/story" register="public" />;
}
