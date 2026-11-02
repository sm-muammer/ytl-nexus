import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { getAdapters } from "@/lib/server/adapters";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { resolveIdentity } from "@/lib/server/auth/service";
import { getMode } from "@/lib/server/mode";
import type { Identity } from "@/lib/server/policy";

/**
 * Who is asking, once per request. In Live_Mode this reads the Better Auth
 * session (and applies the idle and absolute limits); in Demo_Mode it reads the
 * presenter's fixture cookie and never touches the auth database
 * (requirement 6.25). Demo identities count as enrolled and stepped up, so the
 * whole UI can be shown; the Demo session label says so everywhere.
 */
export const getIdentity = cache(async (): Promise<Identity> => {
  if (getMode() === "demo") {
    const actor = await getAdapters().auth.getActor();
    if (actor === null) return { kind: "visitor" };
    return {
      kind: "user",
      userId: actor.userId,
      role: actor.role,
      twoFactorEnabled: true,
      stepUpAt: Date.now(),
    };
  }
  // Read the request first: while `next build` renders, headers() throws and the
  // runtime below is never created, so a build never reaches for the database.
  const requestHeaders = await headers();
  const { identity } = await resolveIdentity(getAuthRuntime(), requestHeaders);
  return identity;
});
