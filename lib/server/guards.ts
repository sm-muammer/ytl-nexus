import "server-only";
import { headers } from "next/headers";
import { forbidden, notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { sourceIpFromHeaders } from "@/lib/server/auth/ip";
import { createGuards } from "@/lib/server/guards-core";
import { getIdentity } from "@/lib/server/identity";
import { getMode } from "@/lib/server/mode";

// The guards, bound to this request: the Better Auth session (or the demo
// fixture), the request's source address, the audit store and Next.js
// navigation. Import these, not the core.
//
//   requirePage(path)      every page and layout: `await requirePage("/command")`
//   requireRole(min, ...)  a role stated in code instead of the policy table
//   requireStepUp()        pages below /control that need a fresh Step_Up
//   guardAction(...)       every Server Function: authorize, validate, run, audit
//   guardHandler(...)      every Route Handler
//
// In Demo_Mode nothing is written to the database (requirement 6.25), so
// refusals are enforced but not recorded.

// A layout and the page under it both guard the same request, so a refusal
// would be audited twice. This remembers what was written during one request.
const written = cache(() => new Set<string>());

const guards = createGuards({
  now: () => Date.now(),
  identity: getIdentity,
  sourceIp: async () => sourceIpFromHeaders(await headers()),
  audit: async (event) => {
    if (getMode() === "demo") return;
    const key = JSON.stringify([
      event.actorId,
      event.action,
      event.target,
      event.result,
    ]);
    const seen = written();
    if (seen.has(key)) return;
    seen.add(key);
    await getAuthRuntime().audit(event);
  },
  nav: { redirect, notFound, forbidden },
});

/**
 * The path of the page being rendered, for layouts, which are not told it.
 * The proxy sets the header on every request, replacing any value a client
 * sent; the pattern below is a second line of defence.
 */
export async function requestPath(): Promise<string> {
  const value = (await headers()).get("x-nexus-path") ?? "";
  return /^\/[A-Za-z0-9\-._~/]{0,200}$/.test(value) ? value : "/";
}

export const {
  requirePage,
  requireRole,
  requireStepUp,
  guardAction,
  guardHandler,
} = guards;
