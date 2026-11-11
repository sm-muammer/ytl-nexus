import type { TransferAccount } from "./types.ts";

/**
 * The account that belongs to the signed-in Nexus user (requirements 12.17 and
 * 12.18, Property 4). Ownership is decided by the session's user id alone. No
 * request field names an account here, so a Member cannot ask for someone
 * else's. If the data ever lists two accounts for one user, nobody is given
 * either, and the Administrator sees the problem in Control.
 */
export function ownAccount(
  accounts: readonly TransferAccount[],
  userId: string,
): TransferAccount | null {
  if (userId.length === 0) return null;
  const mine = accounts.filter((a) => a.nexusUserId === userId);
  return mine.length === 1 ? (mine[0] as TransferAccount) : null;
}
