import type { Kysely } from "kysely";
import type { Database } from "../db/schema.ts";
import {
  LOCKOUT_DURATION_MS,
  LOCKOUT_WINDOW_MS,
  lockedUntil,
} from "./rules.ts";

// Failed sign-ins are rows in `auth_failures`, one per subject: the account
// (`account:<email>`) and the source address (`ip:<address>`). The decision
// itself is the pure `lockedUntil` rule; this file only stores and reads the
// failures. Success never clears them, so an attacker cannot reset the counter
// for an address by signing in to an account of their own.

export const accountSubject = (email: string) =>
  `account:${email.trim().toLowerCase()}`.slice(0, 320);
export const ipSubject = (ip: string) => `ip:${ip}`.slice(0, 320);
export const userSubject = (userId: string) => `user:${userId}`.slice(0, 320);

/** Only failures this recent can still matter to the rule. */
const LOOKBACK_MS = LOCKOUT_WINDOW_MS + LOCKOUT_DURATION_MS;

/** The latest lock end across the subjects, in ms, or null when none is locked. */
export async function currentLock(
  db: Kysely<Database>,
  subjects: readonly string[],
  now: number,
): Promise<number | null> {
  let latest: number | null = null;
  for (const subject of subjects) {
    const rows = await db
      .selectFrom("auth_failures")
      .select("failed_at")
      .where("subject", "=", subject)
      .where("failed_at", ">", new Date(now - LOOKBACK_MS))
      .orderBy("failed_at", "desc")
      .limit(100)
      .execute();
    const until = lockedUntil(
      rows.map((r) => new Date(r.failed_at).getTime()),
      now,
    );
    if (until !== null && (latest === null || until > latest)) latest = until;
  }
  return latest;
}

export async function recordFailures(
  db: Kysely<Database>,
  subjects: readonly string[],
  now: number,
): Promise<void> {
  if (subjects.length === 0) return;
  await db
    .insertInto("auth_failures")
    .values(subjects.map((subject) => ({ subject, failed_at: new Date(now) })))
    .execute();
}

/** Removes failures too old to matter. Cheap to call after a sign-in. */
export async function pruneFailures(
  db: Kysely<Database>,
  now: number,
): Promise<void> {
  await db
    .deleteFrom("auth_failures")
    .where("failed_at", "<", new Date(now - 2 * LOOKBACK_MS))
    .execute();
}

export const LOCKOUT_MESSAGE =
  "Too many failed attempts. Try again in 15 minutes.";
