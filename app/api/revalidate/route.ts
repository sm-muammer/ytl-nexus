import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { sourceIpFromHeaders } from "@/lib/server/auth/ip";
import { getMode } from "@/lib/server/mode";
import {
  handleRevalidate,
  realRevalidate,
  webhookNonceStore,
} from "@/lib/server/revalidate-handler";
import { wpSecret } from "@/lib/server/wordpress";

// Public path, authenticated by an HMAC signature (policy: content.revalidate).
// Demo mode has no WordPress, so there is nothing to revalidate.
export async function POST(request: Request) {
  if (getMode() === "demo") {
    return Response.json({ error: "not-available" }, { status: 404 });
  }
  return handleRevalidate(request, {
    secret: wpSecret(),
    now: () => Date.now(),
    store: webhookNonceStore,
    revalidate: realRevalidate,
    audit: (event) => getAuthRuntime().audit(event),
    sourceIp: sourceIpFromHeaders(request.headers),
  });
}
