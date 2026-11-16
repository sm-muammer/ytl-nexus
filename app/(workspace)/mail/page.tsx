import { pageMetadata } from "@/components/layout/module-page";
import { MailView } from "@/components/mail/mail-view";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { readMailStatus, readOwnMailbox } from "@/lib/server/mail";
import { listContent } from "@/lib/server/content";
import { getActor } from "@/lib/server/session";

// Nexus Mail entry page (MAIL-09). Shows service status, webmail link, the
// user's own mailbox (if linked), client settings, and help articles.
export const metadata = pageMetadata("/mail");

export default async function MailPage() {
  const { identity } = await requirePage("/mail");
  const demo = getMode() === "demo";
  const status = await readMailStatus();
  const ownMailbox =
    identity.kind === "user"
      ? await readOwnMailbox(identity.userId)
      : ({ state: "no-mailbox", source: demo ? "demo" : "live" } as const);
  const actor = await getActor();
  const helpResult = await listContent("mail_help", actor);
  const helpItems = helpResult.ok ? helpResult.items : [];

  return (
    <MailView
      status={status}
      ownMailbox={ownMailbox}
      helpItems={helpItems}
      demoSession={demo}
    />
  );
}
