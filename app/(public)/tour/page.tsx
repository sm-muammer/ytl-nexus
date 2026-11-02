import { ModulePage, pageMetadata } from "@/components/layout/module-page";

export const metadata = pageMetadata("/tour");

export default function TourPage() {
  return <ModulePage path="/tour" register="public" />;
}
