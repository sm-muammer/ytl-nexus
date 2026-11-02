import "server-only";
import type { Actor } from "@/lib/roles";
import { getAdapters } from "@/lib/server/adapters";

/**
 * The current actor, or null for a Visitor. Task 3 uses it only to filter
 * navigation. Task 6 adds requireRole(), which every protected page, Route
 * Handler and Server Function must call; a menu is never access control.
 */
export async function getActor(): Promise<Actor> {
  return getAdapters().auth.getActor();
}
