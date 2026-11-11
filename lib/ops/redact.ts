// Masks secrets in log text before it leaves the agent (OPS-06, Property 14).
// Pure and dependency-free. The masks are conservative: they may hide a harmless
// value, never reveal a sensitive one.

export const MASK = "[redacted]";

export type RedactConfig = {
  /** IPv4 ranges in CIDR form whose addresses are masked, e.g. "10.0.0.0/8". */
  ipRanges: readonly string[];
  /** Exact secret values to mask wherever they appear (the HMAC secret, passwords). */
  secrets?: readonly string[];
};

/** Private ranges plus loopback and link-local. Used when nothing is configured. */
export const DEFAULT_IP_RANGES = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
] as const;

type Cidr = { base: number; mask: number };

function parseIpv4(text: string): number | null {
  const parts = text.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

export function parseCidr(text: string): Cidr | null {
  const [address, bits, ...rest] = text.split("/");
  if (address === undefined || rest.length > 0) return null;
  const base = parseIpv4(address);
  if (base === null) return null;
  const length = bits === undefined ? 32 : Number(bits);
  if (!Number.isInteger(length) || length < 0 || length > 32) return null;
  const mask = length === 0 ? 0 : (0xffffffff << (32 - length)) >>> 0;
  return { base: (base & mask) >>> 0, mask };
}

const EMAIL = /[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
const URL_CREDENTIALS = /\b([A-Za-z][A-Za-z0-9+.-]*:\/\/)[^\s/@:]*:[^\s/@]*@/g;
const AUTH_HEADER =
  /\b(authorization|proxy-authorization|cookie|set-cookie)\b(\s*[:=]\s*)[^\r\n]*/gi;
const BEARER = /\b(bearer|basic|token)\s+[A-Za-z0-9._~+/=-]{8,}/gi;
const KEY_VALUE =
  /\b([A-Za-z0-9_.-]*(?:password|passwd|pwd|secret|token|api[_-]?key|apikey|private[_-]?key|credential|signature|sig|session|cookie|auth)[A-Za-z0-9_.-]*)(\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;&]+)/gi;
const JWT = /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g;
const PRIVATE_KEY =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g;
const LONG_TOKEN = /\b[A-Fa-f0-9]{32,}\b|\b[A-Za-z0-9_-]{40,}\b/g;
const IPV4 = /(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)/g;

/**
 * Replaces, in this order: private keys, URL credentials, authorization lines,
 * bearer tokens, `name=value` pairs whose name suggests a secret, JWTs, long
 * hex or base64 tokens, email addresses, exact configured secrets and IPv4
 * addresses inside the configured ranges.
 */
export function redactLog(text: string, config: RedactConfig): string {
  let out = text;
  out = out.replace(PRIVATE_KEY, MASK);
  out = out.replace(URL_CREDENTIALS, `$1${MASK}@`);
  out = out.replace(AUTH_HEADER, (_m, name: string, sep: string) => {
    return `${name}${sep}${MASK}`;
  });
  out = out.replace(BEARER, (_m, scheme: string) => `${scheme} ${MASK}`);
  out = out.replace(
    KEY_VALUE,
    (_m, name: string, sep: string) => `${name}${sep}${MASK}`,
  );
  out = out.replace(JWT, MASK);
  out = out.replace(LONG_TOKEN, MASK);
  out = out.replace(EMAIL, MASK);
  for (const secret of config.secrets ?? []) {
    if (secret.length >= 6) out = out.split(secret).join(MASK);
  }
  const ranges = config.ipRanges
    .map(parseCidr)
    .filter((c): c is Cidr => c !== null);
  if (ranges.length > 0) {
    out = out.replace(IPV4, (match) => {
      const value = parseIpv4(match);
      if (value === null) return match;
      return ranges.some((r) => (value & r.mask) >>> 0 === r.base)
        ? MASK
        : match;
    });
  }
  return out;
}
