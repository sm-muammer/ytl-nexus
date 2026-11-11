import { createHash } from "node:crypto";

// SSH public keys in OpenSSH one-line format (TRF-03). The parser is strict on
// purpose: one line, a known key type, data that really is that type, and no
// option prefix such as `command="..."`, which SFTPGo would otherwise honour.

export const MAX_KEYS = 10;

const ALLOWED_TYPES = [
  "ssh-ed25519",
  "ssh-rsa",
  "ecdsa-sha2-nistp256",
  "ecdsa-sha2-nistp384",
  "ecdsa-sha2-nistp521",
  "sk-ssh-ed25519@openssh.com",
  "sk-ecdsa-sha2-nistp256@openssh.com",
] as const;

const MAX_LINE = 8192;
const MAX_COMMENT = 100;
const MIN_RSA_BITS = 2048;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type ParsedKey = {
  type: string;
  fingerprint: string;
  comment: string;
  /** The line to store: `type base64 comment`. */
  normalized: string;
};

/** Reads one SSH wire-format string (4-byte length, then bytes). */
function readString(
  blob: Buffer,
  offset: number,
): { bytes: Buffer; next: number } | null {
  if (offset + 4 > blob.length) return null;
  const length = blob.readUInt32BE(offset);
  const end = offset + 4 + length;
  if (end > blob.length) return null;
  return { bytes: blob.subarray(offset + 4, end), next: end };
}

/** The bit length of an RSA modulus, from the key blob. */
function rsaBits(blob: Buffer, afterType: number): number | null {
  const exponent = readString(blob, afterType);
  if (!exponent) return null;
  const modulus = readString(blob, exponent.next);
  if (!modulus || modulus.next !== blob.length) return null;
  let bytes = modulus.bytes;
  while (bytes.length > 0 && bytes[0] === 0) bytes = bytes.subarray(1);
  if (bytes.length === 0) return null;
  return (bytes.length - 1) * 8 + (32 - Math.clz32(bytes[0] as number));
}

export function parsePublicKey(text: unknown): ParsedKey | null {
  if (typeof text !== "string") return null;
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_LINE) return null;
  if (/[\r\n\u0000]/.test(trimmed)) return null;

  const match = /^(\S+) (\S+)(?: (.*))?$/.exec(trimmed);
  if (!match) return null;
  const [, type, data, rawComment = ""] = match;
  if (!type || !data) return null;
  if (!(ALLOWED_TYPES as readonly string[]).includes(type)) return null;
  if (!BASE64.test(data)) return null;

  const blob = Buffer.from(data, "base64");
  const inner = readString(blob, 0);
  if (!inner || inner.bytes.toString("latin1") !== type) return null;
  if (blob.length < inner.next + 4) return null;

  if (type === "ssh-rsa") {
    const bits = rsaBits(blob, inner.next);
    if (bits === null || bits < MIN_RSA_BITS) return null;
  }

  const comment = rawComment
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, MAX_COMMENT);
  const digest = createHash("sha256")
    .update(blob)
    .digest("base64")
    .replace(/=+$/, "");
  return {
    type,
    fingerprint: `SHA256:${digest}`,
    comment,
    normalized: comment ? `${type} ${data} ${comment}` : `${type} ${data}`,
  };
}
