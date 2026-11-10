import { Suspense } from "react";
import { CommandDashboard } from "@/components/command/command-dashboard";
import {
  CommandFrame,
  CommandLoading,
} from "@/components/command/command-frame";
import { pageMetadata } from "@/components/layout/module-page";
import { getAdapters } from "@/lib/server/adapters";
import { requirePage } from "@/lib/server/guards";

export const metadata = pageMetadata("/command");

// The first reading is rendered on the server, so the page is useful before
// any script runs; the client then follows /api/stream/metrics.
async function Overview() {
  const initial = await getAdapters().prometheus.snapshot();
  return <CommandDashboard initial={initial} />;
}

export default async function CommandPage() {
  await requirePage("/command");
  return (
    <CommandFrame path="/command">
      <Suspense fallback={<CommandLoading what="the server readings" />}>
        <Overview />
      </Suspense>
    </CommandFrame>
  );
}
