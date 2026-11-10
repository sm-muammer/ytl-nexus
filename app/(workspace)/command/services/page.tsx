import { Suspense } from "react";
import {
  CommandFrame,
  CommandLoading,
} from "@/components/command/command-frame";
import { HealthBadge } from "@/components/command/health-badge";
import { ServiceTable } from "@/components/command/service-list";
import { pageMetadata } from "@/components/layout/module-page";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { overallHealth } from "@/lib/monitoring/snapshot";
import { getAdapters } from "@/lib/server/adapters";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command/services");

async function Services() {
  const snapshot = await getAdapters().prometheus.snapshot();
  // The reading is taken for this request, so it is fresh unless unreachable.
  const stale = !snapshot.reachable;
  return (
    <div className="px-(--spacing-gutter) py-8">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <HealthBadge
          health={overallHealth(snapshot, snapshot.takenAt)}
          label={stale ? "No recent data" : undefined}
        />
        <LiveDemoLabel source={snapshot.source} />
      </div>
      <p className="text-muted text-data mt-3 max-w-(--spacing-prose)">
        State comes from systemd through node_exporter. “Not installed” means
        the unit does not exist yet on this server; it is planned in a later
        task. Reload the page for a new reading, or open the overview for live
        updates.
      </p>
      <div className="mt-6">
        <ServiceTable
          snapshot={snapshot}
          stale={stale}
          caption="Tracked services and their state"
        />
      </div>
    </div>
  );
}

export default async function ServicesPage() {
  await requirePage("/command/services");
  return (
    <CommandFrame path="/command/services">
      <Suspense fallback={<CommandLoading what="the services" />}>
        <Services />
      </Suspense>
    </CommandFrame>
  );
}
