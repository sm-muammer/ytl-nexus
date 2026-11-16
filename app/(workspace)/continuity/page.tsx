import { ContinuityView } from "@/components/continuity/continuity-view";
import { pageMetadata } from "@/components/layout/module-page";
import { getContinuityView } from "@/lib/server/continuity";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";

export const metadata = pageMetadata("/continuity");

export default async function ContinuityPage() {
  const { identity } = await requirePage("/continuity");
  const actor =
    identity.kind === "user"
      ? { userId: identity.userId, role: identity.role }
      : null;

  const continuity = await getContinuityView(actor);
  const mode = getMode();

  return <ContinuityView continuity={continuity} mode={mode} />;
}
