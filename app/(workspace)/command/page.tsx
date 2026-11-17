import { Suspense } from "react";
import { CommandDashboard } from "@/components/command/command-dashboard";
import {
  CommandFrame,
  CommandLoading,
} from "@/components/command/command-frame";
import { StageUpgradeBanner } from "@/components/auth/stage-upgrade";
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
  const { identity } = await requirePage("/command");
  const role = identity.kind === "user" ? identity.role : null;
  return (
    <CommandFrame path="/command">
      {role && role !== "admin" ? (
        <StageUpgradeBanner currentRole={role} />
      ) : null}
      <Suspense fallback={<CommandLoading what="the server readings" />}>
        <Overview />
      </Suspense>
    </CommandFrame>
  );
}
