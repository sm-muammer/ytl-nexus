import { randomBytes } from "node:crypto";
import { sql } from "kysely";
import QRCode from "qrcode";
import { z } from "zod";
import { ROLES, type Role } from "../../roles.ts";
import type { Identity } from "../policy.ts";
import type { AuthRuntime } from "./create-auth.ts";
import {
  LOCKOUT_MESSAGE,
  currentLock,
  recordFailures,
  userSubject,
} from "./lockout.ts";
import { ACTIVITY_TOUCH_MS, sessionVerdict } from "./rules.ts";
import { sourceIpFromHeaders } from "./ip.ts";

// What the application does with Better Auth: who is asking (with the 30-minute
// idle rule), Step_Up, TOTP enrolment, the Administrator's account actions and
// the first-admin script. Every function takes the runtime and the request's
// headers, so the same code runs in a page, a Server Function, a script and a
// test. No `server-only` import for that reason; ./runtime.ts is the server-only door.

export type SessionRef = {
  id: string;
  userId: string;
  email: string;
  name: string;
};

export type Resolved = {
  identity: Identity;
  session: SessionRef | null;
  /** Set when a stale session was just ended, for a polite message. */
  ended?: "idle" | "expired";
};

const VISITOR: Identity = { kind: "visitor" };

function isRole(value: unknown): value is Role {
  return ROLES.some((r) => r === value);
}

/**
 * Who is asking. Reads the session from the database every time (so a revoked
 * session fails at once), ends it when it has been idle for 30 minutes or is
 * 12 hours old, and otherwise records the activity at most once a minute.
 */
export async function resolveIdentity(
  rt: AuthRuntime,
  headers: Headers,
  now: number = Date.now(),
): Promise<Resolved> {
  const found = await rt.auth.api.getSession({ headers }).catch(() => null);
  const role = found?.user.role;
  if (!found || !isRole(role)) {
    return { identity: VISITOR, session: null };
  }
  const { session, user } = found;
  const createdAt = new Date(session.createdAt).getTime();
  const lastActivityAt = new Date(session.updatedAt).getTime();

  const verdict = sessionVerdict({ now, createdAt, lastActivityAt });
  if (verdict !== "valid") {
    await rt.db.deleteFrom("session").where("id", "=", session.id).execute();
    return {
      identity: VISITOR,
      session: null,
      ended: verdict === "idle" ? "idle" : "expired",
    };
  }
  if (now - lastActivityAt >= ACTIVITY_TOUCH_MS) {
    await rt.db
      .updateTable("session")
      .set({ updatedAt: new Date(now) })
      .where("id", "=", session.id)
      .execute();
  }
  const stepUp = (session as { stepUpAt?: Date | string | null }).stepUpAt;
  return {
    identity: {
      kind: "user",
      userId: user.id,
      role,
      twoFactorEnabled: Boolean(user.twoFactorEnabled),
      stepUpAt: stepUp ? new Date(stepUp).getTime() : null,
    },
    session: {
      id: session.id,
      userId: user.id,
      email: user.email,
      name: user.name,
    },
  };
}

// ---- Password and TOTP checks ---------------------------------------------------

async function passwordMatches(
  rt: AuthRuntime,
  userId: string,
  password: string,
): Promise<boolean> {
  const ctx = await rt.auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const credential = accounts.find((a) => a.providerId === "credential");
  if (!credential?.password) return false;
  return ctx.password.verify({ hash: credential.password, password });
}

async function locked(
  rt: AuthRuntime,
  userId: string,
  now: number,
): Promise<boolean> {
  return (await currentLock(rt.db, [userSubject(userId)], now)) !== null;
}

export type StepUpResult =
  { ok: true } | { ok: false; reason: "invalid" | "locked" | "no-session" };

/**
 * Step_Up: the signed-in user proves password and TOTP again, and the session
 * is stamped (requirement 6.10). The same limit as sign-in applies: five wrong
 * attempts in 15 minutes lock further attempts for 15 minutes. The answer never
 * says whether the password or the code was wrong.
 */
export async function performStepUp(
  rt: AuthRuntime,
  headers: Headers,
  input: { password: string; code: string },
  now: number = Date.now(),
): Promise<StepUpResult> {
  const { identity, session } = await resolveIdentity(rt, headers, now);
  if (identity.kind !== "user" || !session) {
    return { ok: false, reason: "no-session" };
  }
  const ip = sourceIpFromHeaders(headers);
  const record = (result: "success" | "failure" | "denied") =>
    rt.audit({
      actorId: identity.userId,
      role: identity.role,
      action: "auth.step-up",
      target: session.email,
      result,
      sourceIp: ip,
    });

  if (await locked(rt, identity.userId, now)) {
    await record("denied");
    return { ok: false, reason: "locked" };
  }

  let good = await passwordMatches(rt, identity.userId, input.password);
  if (good) {
    good = await rt.auth.api
      .verifyTOTP({ body: { code: input.code }, headers })
      .then(() => true)
      .catch(() => false);
  }
  if (!good) {
    await recordFailures(rt.db, [userSubject(identity.userId)], now);
    await record("failure");
    return { ok: false, reason: "invalid" };
  }
  await rt.db
    .updateTable("session")
    .set({ stepUpAt: new Date(now) })
    .where("id", "=", session.id)
    .execute();
  await record("success");
  return { ok: true };
}

// ---- TOTP enrolment -------------------------------------------------------------

export type EnrolmentStart =
  | {
      ok: true;
      /** An SVG image of the QR code, drawn here so the secret never goes to a third party. */
      qrSvg: string;
      /** The same secret as text, for apps that cannot scan. */
      manualKey: string;
      backupCodes: string[];
    }
  | {
      ok: false;
      reason: "invalid-password" | "locked" | "no-session" | "already-enrolled";
    };

function secretFromUri(uri: string): string {
  try {
    return new URL(uri).searchParams.get("secret") ?? "";
  } catch {
    return "";
  }
}

export async function startEnrolment(
  rt: AuthRuntime,
  headers: Headers,
  password: string,
  now: number = Date.now(),
): Promise<EnrolmentStart> {
  const { identity, session } = await resolveIdentity(rt, headers, now);
  if (identity.kind !== "user" || !session) {
    return { ok: false, reason: "no-session" };
  }
  if (identity.twoFactorEnabled)
    return { ok: false, reason: "already-enrolled" };
  if (await locked(rt, identity.userId, now))
    return { ok: false, reason: "locked" };

  try {
    const result = await rt.auth.api.enableTwoFactor({
      body: { password, method: "totp" },
      headers,
    });
    if (result.method !== "totp")
      return { ok: false, reason: "invalid-password" };
    const uri = result.totpURI;
    return {
      ok: true,
      qrSvg: await QRCode.toString(uri, { type: "svg", margin: 1 }),
      manualKey: secretFromUri(uri),
      backupCodes: result.backupCodes,
    };
  } catch {
    await recordFailures(rt.db, [userSubject(identity.userId)], now);
    return { ok: false, reason: "invalid-password" };
  }
}

export type EnrolmentConfirm =
  { ok: true } | { ok: false; reason: "invalid" | "locked" | "no-session" };

/** Checks the first code. Better Auth then turns two-factor on and swaps the session. */
export async function confirmEnrolment(
  rt: AuthRuntime,
  headers: Headers,
  code: string,
  now: number = Date.now(),
): Promise<EnrolmentConfirm> {
  const { identity } = await resolveIdentity(rt, headers, now);
  if (identity.kind !== "user") return { ok: false, reason: "no-session" };
  if (await locked(rt, identity.userId, now))
    return { ok: false, reason: "locked" };
  try {
    await rt.auth.api.verifyTOTP({ body: { code }, headers });
    return { ok: true };
  } catch {
    await recordFailures(rt.db, [userSubject(identity.userId)], now);
    return { ok: false, reason: "invalid" };
  }
}

// ---- Accounts: the first-admin script and Nexus Control --------------------------

export const newAccountSchema = z.object({
  email: z.email().max(255),
  name: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
  password: z.string().min(12).max(128),
});

export type NewAccount = z.infer<typeof newAccountSchema>;

/** A random password of 24 URL-safe characters (144 bits). */
export function generatePassword(): string {
  return randomBytes(18).toString("base64url");
}

/**
 * Creates an account with a password and no email. Used by the first-admin
 * script. It does not need a session: whoever can run it on the server already
 * controls the database.
 */
export async function createAccount(
  rt: AuthRuntime,
  input: NewAccount,
): Promise<{ id: string }> {
  const data = newAccountSchema.parse(input);
  const email = data.email.toLowerCase();
  const ctx = await rt.auth.$context;
  if (await ctx.internalAdapter.findUserByEmail(email)) {
    throw new Error("An account with that email already exists.");
  }
  const hash = await ctx.password.hash(data.password);
  const user = await ctx.internalAdapter.createUser(
    { email, name: data.name, emailVerified: true, role: data.role },
    { method: "admin" },
  );
  await ctx.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hash,
  });
  return { id: user.id };
}

/** What the Control user list may show. Never a password hash or a token. */
export type AdminUserDto = {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  activeSessions: number;
  createdAt: string;
};

export async function listUsersForAdmin(
  rt: AuthRuntime,
): Promise<AdminUserDto[]> {
  const rows = await rt.db
    .selectFrom("user")
    .select([
      "user.id",
      "user.name",
      "user.email",
      "user.role",
      "user.twoFactorEnabled",
      "user.createdAt",
      (eb) =>
        eb
          .selectFrom("session")
          .select(sql<number>`count(*)`.as("n"))
          .whereRef("session.userId", "=", "user.id")
          .where("session.expiresAt", ">", new Date())
          .as("activeSessions"),
    ])
    .orderBy("user.email")
    .limit(200)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    role: r.role,
    twoFactorEnabled: Boolean(r.twoFactorEnabled),
    activeSessions: Number(r.activeSessions ?? 0),
    createdAt: new Date(r.createdAt).toISOString(),
  }));
}

export async function findUserEmail(
  rt: AuthRuntime,
  userId: string,
): Promise<string | null> {
  const row = await rt.db
    .selectFrom("user")
    .select("email")
    .where("id", "=", userId)
    .executeTakeFirst();
  return row?.email ?? null;
}

/**
 * Sets a new password for a user and ends all of their sessions. No email is
 * sent (requirement 6.13). Runs as the signed-in Administrator, so Better
 * Auth's own permission check applies as well.
 */
export async function resetPasswordAsAdmin(
  rt: AuthRuntime,
  headers: Headers,
  userId: string,
  newPassword: string,
): Promise<void> {
  await rt.auth.api.setUserPassword({ body: { userId, newPassword }, headers });
  await rt.auth.api.revokeUserSessions({ body: { userId }, headers });
}

export async function revokeSessionsAsAdmin(
  rt: AuthRuntime,
  headers: Headers,
  userId: string,
): Promise<void> {
  await rt.auth.api.revokeUserSessions({ body: { userId }, headers });
}

export { LOCKOUT_MESSAGE };
