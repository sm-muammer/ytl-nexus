import { z } from "zod";
import { isContentType } from "@/lib/content/types";
import { sourceIpFromHeaders } from "@/lib/server/auth/ip";
import { listContent } from "@/lib/server/content";
import { checkRateLimit, rateLimitResponse } from "@/lib/server/rate-limit";
import { getActor } from "@/lib/server/session";

// Public path: the answer is filtered for the caller's role inside
// listContent, so a Visitor receives public items only (policy: library.list).
const query = z.object({
  type: z.string().refine(isContentType).default("runbook"),
});

export async function GET(request: Request) {
  const ip = sourceIpFromHeaders(new Headers(request.headers));
  const rate = checkRateLimit(`${ip}:api-library`, {
    maxRequests: 60,
    windowMs: 60 * 1000,
  });
  if (!rate.ok) {
    return rateLimitResponse(rate.retryAfter);
  }

  const parsed = query.safeParse({
    type: new URL(request.url).searchParams.get("type") ?? undefined,
  });
  if (!parsed.success) {
    return Response.json({ error: "invalid-input" }, { status: 400 });
  }
  const type = parsed.data.type as Parameters<typeof listContent>[0];
  const result = await listContent(type, await getActor());
  if (!result.ok) {
    return Response.json({ error: "unavailable" }, { status: 503 });
  }
  return Response.json(
    {
      source: result.source,
      items: result.items.map((i) => ({
        slug: i.slug,
        title: i.title,
        excerpt: i.excerpt,
        audience: i.audience,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
