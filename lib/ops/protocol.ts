import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  HEALTH_CHECK_IDS,
  MAX_LOG_LINES,
  MIN_LOG_LINES,
  OPS_UNITS,
  type HealthCheckId,
  type OpsUnit,
} from "./units.ts";

// The wire protocol between nexus-web and the operations agent (OPS-02,
// OPS-03). Node built-ins only, so the agent can run without installed
// packages. Used by the agent, the web client and the tests.

export type OpsRequest =
  | { op: "restart"; unit: OpsUnit }
  | { op: "logs"; unit: OpsUnit; lines: number }
  | { op: "health"; check: HealthCheckId };

export type Envelope = {
  req: unknown;
  /** Milliseconds since the epoch on the sender's clock. */
  ts: number;
  nonce: string;
  /** Hex HMAC-SHA256 over the version, timestamp, nonce and canonical request. */
  sig: string;
};

export const TIMESTAMP_WINDOW_MS = 30_000;
export const NONCE_TTL_MS = 60_000;
const MAX_NONCES = 10_000;

const NONCE_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;
const SIG_PATTERN = /^[0-9a-f]{64}$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((k) => own.includes(k));
}

/**
 * Strict, exact validation. The unit and check must equal an allowlist entry
 * character for character: `../`, `@`, glob characters, suffixes, other case,
 * extra keys and a non-integer or out-of-range `lines` all fail (Property 10).
 */
export function validateRequest(
  raw: unknown,
): { ok: true; req: OpsRequest } | { ok: false } {
  const invalid = { ok: false } as const;
  if (!isPlainObject(raw)) return invalid;
  const { op } = raw;
  if (op === "restart") {
    if (!hasOnlyKeys(raw, ["op", "unit"])) return invalid;
    const unit = OPS_UNITS.find((u) => u === raw.unit);
    return unit ? { ok: true, req: { op, unit } } : invalid;
  }
  if (op === "logs") {
    if (!hasOnlyKeys(raw, ["op", "unit", "lines"])) return invalid;
    const unit = OPS_UNITS.find((u) => u === raw.unit);
    const { lines } = raw;
    if (
      !unit ||
      typeof lines !== "number" ||
      !Number.isInteger(lines) ||
      lines < MIN_LOG_LINES ||
      lines > MAX_LOG_LINES
    ) {
      return invalid;
    }
    return { ok: true, req: { op, unit, lines } };
  }
  if (op === "health") {
    if (!hasOnlyKeys(raw, ["op", "check"])) return invalid;
    const check = HEALTH_CHECK_IDS.find((c) => c === raw.check);
    return check ? { ok: true, req: { op, check } } : invalid;
  }
  return invalid;
}

/** JSON with object keys sorted, so both sides sign the same bytes. */
export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function signature(
  secret: string,
  ts: number,
  nonce: string,
  req: unknown,
): string {
  return createHmac("sha256", secret)
    .update(`v1\n${ts}\n${nonce}\n${canonicalize(req)}`)
    .digest("hex");
}

export function newNonce(): string {
  return randomBytes(18).toString("base64url");
}

export function signEnvelope(
  req: unknown,
  secret: string,
  now: number,
  nonce: string = newNonce(),
): Envelope {
  return { req, ts: now, nonce, sig: signature(secret, now, nonce, req) };
}

/** Nonces accepted in the last minute. Fails closed when it is full. */
export class NonceCache {
  private readonly seen = new Map<string, number>();

  /** Records the nonce. False when it was already accepted within the window. */
  accept(nonce: string, now: number): boolean {
    for (const [key, expires] of this.seen) {
      if (expires <= now) this.seen.delete(key);
    }
    if (this.seen.has(nonce)) return false;
    if (this.seen.size >= MAX_NONCES) return false;
    this.seen.set(nonce, now + NONCE_TTL_MS);
    return true;
  }

  get size(): number {
    return this.seen.size;
  }
}

/**
 * Accepts an envelope only when the shape, the timestamp (within 30 s of the
 * agent's clock), the signature and the nonce (not seen in 60 s) all hold. The
 * nonce is recorded last, and only for a correctly signed request, so a
 * forger cannot fill the cache (Property 11).
 */
export function verifyEnvelope(
  envelope: unknown,
  secret: string,
  now: number,
  seen: NonceCache,
): "ok" | "auth-failure" {
  if (!isPlainObject(envelope)) return "auth-failure";
  if (!hasOnlyKeys(envelope, ["req", "ts", "nonce", "sig"])) {
    return "auth-failure";
  }
  const { req, ts, nonce, sig } = envelope;
  if (typeof ts !== "number" || !Number.isFinite(ts)) return "auth-failure";
  if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) {
    return "auth-failure";
  }
  if (typeof sig !== "string" || !SIG_PATTERN.test(sig)) return "auth-failure";
  if (Math.abs(now - ts) > TIMESTAMP_WINDOW_MS) return "auth-failure";
  const expected = Buffer.from(signature(secret, ts, nonce, req), "hex");
  const given = Buffer.from(sig, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return "auth-failure";
  }
  return seen.accept(nonce, now) ? "ok" : "auth-failure";
}

// ---- Responses ----------------------------------------------------------------

export type HealthProbeResult = {
  check: HealthCheckId;
  state: "healthy" | "degraded" | "down";
  latencyMs: number | null;
  /** A short fixed phrase. Never a host, address or error text from the system. */
  detail: string;
};

export type OpsResponse =
  | { ok: true; op: "restart"; unit: OpsUnit; accepted: true }
  | { ok: true; op: "logs"; unit: OpsUnit; lines: string[]; truncated: boolean }
  | ({ ok: true; op: "health" } & HealthProbeResult)
  | { ok: false; error: OpsErrorCode };

export const OPS_ERROR_CODES = [
  "auth-failure",
  "invalid-request",
  "failed",
] as const;
export type OpsErrorCode = (typeof OPS_ERROR_CODES)[number];
