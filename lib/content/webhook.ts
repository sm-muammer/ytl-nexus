import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ContentType } from "./types.ts";
import { CONTENT_TYPES } from "./types.ts";

// The signed revalidation webhook (LIB-05). WordPress sends:
//   X-Nexus-Timestamp  seconds since the epoch
//   X-Nexus-Nonce      random, single use
//   X-Nexus-Signature  "sha256=" + hex HMAC-SHA256 of `${timestamp}.${nonce}.${body}`
// A request is refused when the signature is wrong, the timestamp is more than
// five minutes away from now, or the nonce was already used.

export const WEBHOOK_WINDOW_MS = 5 * 60 * 1000;

export const webhookBody = z.object({
  event: z.enum(["publish", "update", "delete"]),
  type: z.enum(CONTENT_TYPES),
  id: z.number().int().nonnegative(),
  slug: z.string().regex(/^[a-z0-9-]{1,200}$/),
});

export type WebhookEvent = z.infer<typeof webhookBody>;

export function signWebhook(
  secret: string,
  timestamp: string,
  nonce: string,
  body: string,
): string {
  const mac = createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.${body}`)
    .digest("hex");
  return `sha256=${mac}`;
}

export type NonceStore = {
  /** Records a nonce; false when it was already there. */
  remember(nonce: string, now: number): boolean;
  size(): number;
};

/** In-memory single-use store. One Node process serves the app, so this is enough. */
export function createNonceStore(): NonceStore {
  const seen = new Map<string, number>();
  function prune(now: number) {
    for (const [nonce, at] of seen) {
      if (now - at > WEBHOOK_WINDOW_MS * 2) seen.delete(nonce);
    }
  }
  return {
    remember(nonce, now) {
      prune(now);
      if (seen.has(nonce)) return false;
      seen.set(nonce, now);
      return true;
    },
    size: () => seen.size,
  };
}

export type WebhookResult =
  | { ok: true }
  | {
      ok: false;
      reason: "config" | "headers" | "signature" | "timestamp" | "replay";
    };

export function verifyWebhook(input: {
  secret: string;
  body: string;
  timestamp: string;
  nonce: string;
  signature: string;
  now: number;
  store: NonceStore;
}): WebhookResult {
  const { secret, body, timestamp, nonce, signature, now, store } = input;
  if (secret.length < 32) return { ok: false, reason: "config" };
  if (!timestamp || !nonce || !signature || nonce.length > 128) {
    return { ok: false, reason: "headers" };
  }
  const expected = Buffer.from(signWebhook(secret, timestamp, nonce, body));
  const given = Buffer.from(signature);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return { ok: false, reason: "signature" };
  }
  const seconds = Number(timestamp);
  if (
    !Number.isFinite(seconds) ||
    Math.abs(now - seconds * 1000) > WEBHOOK_WINDOW_MS
  ) {
    return { ok: false, reason: "timestamp" };
  }
  if (!store.remember(nonce, now)) return { ok: false, reason: "replay" };
  return { ok: true };
}

/** Cache tags to revalidate for an event: list, type, item. */
export function tagsForEvent(e: {
  type: ContentType;
  slug: string;
  [key: string]: unknown;
}): string[] {
  return ["content", `content:${e.type}`, `content:${e.type}:${e.slug}`];
}
