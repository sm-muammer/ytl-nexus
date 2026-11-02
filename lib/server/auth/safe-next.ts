// The page to return to after sign-in comes from the query string, so it is
// untrusted. Only a path on this site is accepted; everything else (another
// site, a protocol-relative address, control characters, the sign-in page
// itself) becomes the fallback.

export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (/[\u0000-\u001f\u007f]/.test(value)) return fallback;
  if (/^\/signin(?:[/?#]|$)/.test(value)) return fallback;
  return value;
}
