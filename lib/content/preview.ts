import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { CONTENT_TYPES, type ContentType } from "./types.ts";

// Draft preview token (LIB-06): `<base64url payload>.<base64url HMAC>`, valid
// for ten minutes. Signed with the same secret as the webhook.

export const PREVIEW_TTL_MS = 10 * 60 * 1000;

const payload = z.object({
  type: z.enum(CONTENT_TYPES),
  id: z.number().int().nonnegative(),
  exp: z.number(),
});

function mac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(`preview.${data}`).digest();
}

export function signPreviewToken(
  secret: string,
  target: { type: ContentType; id: number },
  now: number,
): string {
  const data = Buffer.from(
    JSON.stringify({ ...target, exp: now + PREVIEW_TTL_MS }),
  ).toString("base64url");
  return `${data}.${mac(secret, data).toString("base64url")}`;
}

export function verifyPreviewToken(
  secret: string,
  token: string,
  now: number,
): { type: ContentType; id: number } | null {
  if (secret.length < 32) return null;
  const [data, sig, extra] = token.split(".");
  if (!data || !sig || extra !== undefined) return null;
  const given = Buffer.from(sig, "base64url");
  const expected = mac(secret, data);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const parsed = payload.safeParse(
      JSON.parse(Buffer.from(data, "base64url").toString("utf8")),
    );
    if (!parsed.success || parsed.data.exp < now) return null;
    return { type: parsed.data.type, id: parsed.data.id };
  } catch {
    return null;
  }
}
