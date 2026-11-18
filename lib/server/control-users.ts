import "server-only";
import { demoControlUsers } from "@/lib/fixtures/control-users";
import { listAuditEvents } from "@/lib/server/audit";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { listUsersForAdmin } from "@/lib/server/auth/service";
import { readAllMailboxes } from "@/lib/server/mail";
import { getMode } from "@/lib/server/mode";
import { readAllAccounts } from "@/lib/server/transfer";

/**
 * Loads the Administrator user directory combined with linked SFTPGo transfer
 * accounts, virtual mailboxes, and recent audit events for Nexus Control.
 */
export async function readControlUsersSnapshot() {
  const demo = getMode() === "demo";
  const users = demo
    ? demoControlUsers
    : await listUsersForAdmin(getAuthRuntime());
  const [transfer, mail, auditEvents] = await Promise.all([
    readAllAccounts(),
    readAllMailboxes(),
    listAuditEvents({}, 100),
  ]);

  const transferAccounts = transfer.state === "ready" ? transfer.accounts : [];
  const mailAccounts = mail.state === "ready" ? mail.accounts : [];

  const transferByNexusId = new Map(
    transferAccounts.map((a) => [a.nexusUserId, a]),
  );
  const mailByNexusId = new Map(mailAccounts.map((a) => [a.nexusUserId, a]));

  const usersWithServices = users.map((u) => ({
    ...u,
    transferAccount: transferByNexusId.get(u.id) ?? null,
    mailAccount: mailByNexusId.get(u.id) ?? null,
  }));

  return {
    demo,
    users,
    usersWithServices,
    transfer,
    mail,
    auditEvents,
  };
}
