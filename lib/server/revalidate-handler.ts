import "server-only";
import { revalidateTag } from "next/cache";
import {
  createNonceStore,
  tagsForEvent,
  verifyWebhook,
  webhookBody,
  type NonceStore,
} from "@/lib/content/webhook";
import type { AuditEventInput } from "@/lib/server/db/audit";

// The logic of POST /api/revalidate (LIB-05), separate from the route file so
// tests can hand it doubles. The route supplies the real secret, clock, tag
// invalidation and audit store.

export type RevalidateDeps = {
  secret: string;
  now: () => number;
  store: NonceStore;
  revalidate: (tag: string) => void;
  audit: (event: AuditEventInput) => Promise<void>;
  sourceIp: string;
};

const MAX_BODY_BYTES = 4096;

function audit(deps: RevalidateDeps, target: string, ok: boolean) {
  return deps
    .audit({
      actorId: null,
      role: null,
      action: "content.revalidate",
      target: target.slice(0, 255),
      result: ok ? "success" : "refused",
      sourceIp: deps.sourceIp,
    })
    .catch(() => undefined);
}

export async function handleRevalidate(
  request: Request,
  deps: RevalidateDeps,
): Promise<Response> {
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) {
    return Response.json({ error: "too-large" }, { status: 413 });
  }
  const verdict = verifyWebhook({
    secret: deps.secret,
    body,
    timestamp: request.headers.get("x-nexus-timestamp") ?? "",
    nonce: request.headers.get("x-nexus-nonce") ?? "",
    signature: request.headers.get("x-nexus-signature") ?? "",
    now: deps.now(),
    store: deps.store,
  });
  if (!verdict.ok) {
    await audit(deps, `webhook:${verdict.reason}`, false);
    // No detail to the caller beyond the status.
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = webhookBody.safeParse(JSON.parse(body));
  } catch {
    parsed = null;
  }
  if (!parsed?.success) {
    await audit(deps, "webhook:invalid-body", false);
    return Response.json({ error: "invalid-input" }, { status: 400 });
  }
  const tags = tagsForEvent(parsed.data);
  for (const tag of tags) deps.revalidate(tag);
  await audit(deps, `${parsed.data.type}:${parsed.data.slug}`, true);
  return Response.json({ revalidated: tags }, { status: 200 });
}

export const webhookNonceStore = createNonceStore();

export function realRevalidate(tag: string) {
  revalidateTag(tag, { expire: 0 });
}
