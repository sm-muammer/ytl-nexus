import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import {
  PlatformView,
  type SubsystemStatusItem,
} from "@/components/platform/platform-view";
import { pageInfo } from "@/lib/navigation/modules";
import { getAdapters } from "@/lib/server/adapters";
import type { AdapterName } from "@/lib/server/adapters/types";

export const metadata = pageMetadata("/platform");

export default async function PlatformPage() {
  const adapters = getAdapters();
  const keys: AdapterName[] = [
    "db",
    "auth",
    "wordpress",
    "prometheus",
    "ollama",
    "sftpgo",
    "ops",
    "mail",
  ];

  const statuses: SubsystemStatusItem[] = await Promise.all(
    keys.map(async (key) => ({
      key,
      name: key,
      status: await adapters[key].status(),
    })),
  );

  return (
    <PageTransition>
      <div>
        <Backdrop path="/platform" />
        <ModuleHero page={pageInfo("/platform")} register="public" />
        <PlatformView statuses={statuses} />
      </div>
    </PageTransition>
  );
}
