import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { ROLE_LABEL, type Actor } from "@/lib/roles";
import type { NexusMode } from "@/lib/server/mode";

/**
 * Always-visible line under the header: which mode the platform is in, where
 * its values come from, and who is viewing (Requirements 3.7 and 1.14). The
 * demo session is labelled "Demo session" so it is never mistaken for a real
 * sign-in.
 */
export function ModeStrip({ mode, actor }: { mode: NexusMode; actor: Actor }) {
  const demo = mode === "demo";
  let session = "Not signed in";
  if (actor) {
    session = demo
      ? `Demo session: ${ROLE_LABEL[actor.role]}`
      : `Signed in: ${ROLE_LABEL[actor.role]}`;
  }
  return (
    <div className="border-line bg-surface border-t">
      <div className="max-w-page mx-auto flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-(--spacing-gutter) py-1.5">
        <EnvironmentBadge mode={mode} />
        <LiveDemoLabel source={demo ? "demo" : "live"} />
        <span data-session-label className="text-muted text-data sm:ml-auto">
          {session}
        </span>
      </div>
    </div>
  );
}
