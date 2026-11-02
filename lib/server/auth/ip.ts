import { isIP } from "node:net";

// The client address, as seen by the audit trail and the sign-in lockout.
//
// Apache is the only way in (docs/tech.md, trust boundaries) and sets
// `X-Real-IP` to the connecting address with `RequestHeader set`, which
// replaces any value a client sent. `X-Forwarded-For` is not used: Apache
// appends to it, so its first entry can be forged. If the header is missing or
// not an address (local development, tests), the result is "0.0.0.0".

export const CLIENT_IP_HEADER = "x-real-ip";
export const UNKNOWN_IP = "0.0.0.0";

export function sourceIpFromHeaders(
  headers: Headers | null | undefined,
): string {
  const raw = headers?.get(CLIENT_IP_HEADER)?.trim();
  if (!raw) return UNKNOWN_IP;
  const ip = raw.toLowerCase().startsWith("::ffff:") ? raw.slice(7) : raw;
  return isIP(ip) !== 0 && ip.length <= 45 ? ip : UNKNOWN_IP;
}
