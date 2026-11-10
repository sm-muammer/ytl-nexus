import { guardHandler } from "@/lib/server/guards";
import { policyForHandler } from "@/lib/server/policy";
import {
  createStreamResponse,
  getPoller,
} from "@/lib/server/monitoring/stream";

// Server-sent events with the latest snapshot of Nexus Core 01 (CMD-03).
// Viewer and above; each signed-in user may hold a few streams open at once.

export const dynamic = "force-dynamic";

const ID = "metrics.stream";

export const GET = guardHandler(
  { id: ID, requirement: policyForHandler(ID) },
  async (request, ctx) =>
    createStreamResponse({
      poller: getPoller(),
      signal: request.signal,
      key: ctx.identity.kind === "user" ? ctx.identity.userId : "anonymous",
    }),
);
