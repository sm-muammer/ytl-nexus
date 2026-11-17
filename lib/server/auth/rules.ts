import type { Role } from "../../roles.ts";

// Pure rules for sessions, step-up and sign-in lockout (requirements 6.9,
// 6.10, 6.16 to 6.18). No I/O and no clock: callers pass `now` in
// milliseconds, so the rules are tested with any sequence of timestamps.

const MINUTE = 60_000;

/** A session unused for this long is dead (requirement 6.16: 60 minutes). */
export const IDLE_TIMEOUT_MS = 60 * MINUTE;
/** A session older than this is dead however busy it was (requirement 6.16). */
export const ABSOLUTE_TIMEOUT_MS = 12 * 60 * MINUTE;
/** Password plus TOTP counts as recent for this long (requirement 6.10). */
export const STEP_UP_WINDOW_MS = 10 * MINUTE;
/** Activity is written to the database at most this often. */
export const ACTIVITY_TOUCH_MS = MINUTE;

/** Failures that trigger a lockout, the window they must fall in, and how long it lasts. */
export const LOCKOUT_FAILURES = 5;
export const LOCKOUT_WINDOW_MS = 15 * MINUTE;
export const LOCKOUT_DURATION_MS = 15 * MINUTE;

export type SessionTimes = {
  now: number;
  createdAt: number;
  lastActivityAt: number;
  /** True when an Administrator revoked it or the user signed out. */
  revoked?: boolean;
};

export type SessionVerdict = "valid" | "revoked" | "expired" | "idle";

export function sessionVerdict(s: SessionTimes): SessionVerdict {
  if (s.revoked) return "revoked";
  // A timestamp in the future cannot come from this server; treat it as unusable.
  if (s.createdAt > s.now || s.lastActivityAt > s.now) return "expired";
  if (s.now - s.createdAt >= ABSOLUTE_TIMEOUT_MS) return "expired";
  if (s.now - s.lastActivityAt >= IDLE_TIMEOUT_MS) return "idle";
  return "valid";
}

export function isSessionValid(s: SessionTimes): boolean {
  return sessionVerdict(s) === "valid";
}

export function isStepUpFresh(stepUpAt: number | null, now: number): boolean {
  if (stepUpAt === null || stepUpAt > now) return false;
  return now - stepUpAt < STEP_UP_WINDOW_MS;
}

/** Operators and Administrators must enrol TOTP (requirement 6.9). */
export function requiresTwoFactor(role: Role): boolean {
  return role === "operator" || role === "admin";
}

/**
 * When the sign-in lock for one subject (an account or a source IP) ends, or
 * null when it is not locked. `failureTimes` are the failed attempts for that
 * subject; order does not matter. Five failures inside 15 minutes lock the
 * subject for 15 minutes counted from the fifth. Attempts refused during a
 * lock are not recorded as failures, so a lock never extends itself.
 */
export function lockedUntil(
  failureTimes: readonly number[],
  now: number,
): number | null {
  const sorted = failureTimes.filter((t) => t <= now).sort((a, b) => a - b);
  let end: number | null = null;
  for (let i = LOCKOUT_FAILURES - 1; i < sorted.length; i++) {
    const last = sorted[i] as number;
    const first = sorted[i - (LOCKOUT_FAILURES - 1)] as number;
    if (last - first > LOCKOUT_WINDOW_MS) continue;
    const until = last + LOCKOUT_DURATION_MS;
    if (until > now && (end === null || until > end)) end = until;
  }
  return end;
}
