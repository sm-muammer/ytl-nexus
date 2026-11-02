import "server-only";
import type { Actor } from "@/lib/roles";
import { getIdentity } from "@/lib/server/identity";
import { identityToActor } from "@/lib/server/policy";

/**
 * The current actor, or null for a Visitor, for menus and labels. Showing or
 * hiding a menu entry is not access control: every protected page, Route Handler
 * and Server Function calls a guard from ./guards.ts.
 */
export async function getActor(): Promise<Actor> {
  return identityToActor(await getIdentity());
}
