import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "kysely";
import QRCode from "qrcode";
import { z } from "zod";
import {
  EMPTY_PROFILE_META,
  USER_REQUEST_CATEGORIES,
  type OwnSessionDto,
  type UserProfileMeta,
  type UserRequestCategory,
  type UserRequestDto,
  type UserRequestStatus,
} from "../../fixtures/account.ts";
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
  banned: boolean;
  banReason?: string | null;
  stageRequest?: {
    role: Role;
    requestedAt: string;
    reason?: string;
  } | null;
  twoFactorEnabled: boolean;
  activeSessions: number;
  createdAt: string;
};

export function parseStageRequest(banReason: string | null | undefined): {
  role: Role;
  requestedAt: string;
  reason?: string;
} | null {
  if (!banReason || !banReason.startsWith("STAGE_REQUEST:")) return null;
  try {
    const raw = JSON.parse(banReason.slice("STAGE_REQUEST:".length));
    if (raw && (raw.role === "operator" || raw.role === "admin")) {
      return raw;
    }
  } catch {
    return null;
  }
  return null;
}

async function syncStageRequestBanReason(
  rt: AuthRuntime,
  userId: string,
  role: Role,
  reason?: string,
): Promise<void> {
  const payload = JSON.stringify({
    role,
    requestedAt: new Date().toISOString(),
    reason: reason || undefined,
  });
  await rt.db
    .updateTable("user")
    .set({
      banReason: `STAGE_REQUEST:${payload}`,
    })
    .where("id", "=", userId)
    .execute();
}

export async function requestStageUpgrade(
  rt: AuthRuntime,
  userId: string,
  role: Role,
  reason?: string,
): Promise<void> {
  await syncStageRequestBanReason(rt, userId, role, reason);
  const existing = await listUserRequests(rt, userId);
  const hasPendingRoleUpgrade = existing.some(
    (r) => r.category === "role-upgrade" && r.status === "pending",
  );
  if (!hasPendingRoleUpgrade) {
    await createUserRequest(rt, {
      userId,
      category: "role-upgrade",
      title: `Stage promotion request to ${role}`,
      requestedRole: role,
      reason: reason?.trim() || `Requested promotion to ${role}.`,
    });
  }
}

export async function clearStageRequest(
  rt: AuthRuntime,
  userId: string,
  resolutionStatus: "approved" | "dismissed" = "dismissed",
): Promise<void> {
  const user = await rt.db
    .selectFrom("user")
    .select(["banReason", "banned"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (user && user.banReason?.startsWith("STAGE_REQUEST:") && !user.banned) {
    await rt.db
      .updateTable("user")
      .set({ banReason: null })
      .where("id", "=", userId)
      .execute();
  }
  const rows = await rt.db
    .selectFrom("verification")
    .select(["id", "value"])
    .where("identifier", "=", `${REQUEST_PREFIX}${userId}`)
    .execute();
  const nowDate = new Date();
  for (const row of rows) {
    const payload = parseRequestPayload(row.value);
    if (
      payload &&
      payload.category === "role-upgrade" &&
      payload.status === "pending"
    ) {
      await rt.db
        .updateTable("verification")
        .set({
          value: JSON.stringify({
            ...payload,
            status: resolutionStatus,
            updatedAt: nowDate.toISOString(),
          }),
          updatedAt: nowDate,
        })
        .where("id", "=", row.id)
        .execute();
    }
  }
}

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
      "user.banned",
      "user.banReason",
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
  return rows.map((r) => {
    const stageReq = parseStageRequest(r.banReason);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role,
      banned: Boolean(r.banned),
      banReason: r.banReason,
      stageRequest: stageReq,
      twoFactorEnabled: Boolean(r.twoFactorEnabled),
      activeSessions: Number(r.activeSessions ?? 0),
      createdAt: new Date(r.createdAt).toISOString(),
    };
  });
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

export async function findUserRole(
  rt: AuthRuntime,
  userId: string,
): Promise<Role | null> {
  const row = await rt.db
    .selectFrom("user")
    .select("role")
    .where("id", "=", userId)
    .executeTakeFirst();
  return (row?.role as Role) ?? null;
}

export async function changeUserRole(
  rt: AuthRuntime,
  userId: string,
  role: Role,
): Promise<void> {
  await rt.db
    .updateTable("user")
    .set({ role })
    .where("id", "=", userId)
    .execute();
}

export async function setUserBanned(
  rt: AuthRuntime,
  headers: Headers,
  userId: string,
  banned: boolean,
  banReason?: string,
): Promise<void> {
  await rt.db
    .updateTable("user")
    .set({
      banned: banned ? 1 : 0,
      banReason: banned ? (banReason ?? "Disabled by Administrator") : null,
      banExpires: null,
    })
    .where("id", "=", userId)
    .execute();
  if (banned) {
    await rt.auth.api.revokeUserSessions({ body: { userId }, headers });
  }
}

export async function resetTwoFactor(
  rt: AuthRuntime,
  headers: Headers,
  userId: string,
): Promise<void> {
  await rt.db.deleteFrom("twoFactor").where("userId", "=", userId).execute();
  await rt.db
    .updateTable("user")
    .set({ twoFactorEnabled: 0 })
    .where("id", "=", userId)
    .execute();
  await rt.auth.api.revokeUserSessions({ body: { userId }, headers });
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

export async function updateUserName(
  rt: AuthRuntime,
  userId: string,
  name: string,
): Promise<void> {
  await rt.db
    .updateTable("user")
    .set({ name: name.trim() })
    .where("id", "=", userId)
    .execute();
}

export async function deleteUserAccount(
  rt: AuthRuntime,
  headers: Headers,
  userId: string,
): Promise<void> {
  await rt.auth.api
    .revokeUserSessions({ body: { userId }, headers })
    .catch(() => undefined);
  await rt.db.deleteFrom("twoFactor").where("userId", "=", userId).execute();
  await rt.db.deleteFrom("session").where("userId", "=", userId).execute();
  await rt.db.deleteFrom("account").where("userId", "=", userId).execute();
  await rt.db
    .deleteFrom("verification")
    .where("identifier", "in", [
      `${PROFILE_PREFIX}${userId}`,
      `${REQUEST_PREFIX}${userId}`,
    ])
    .execute();
  await rt.db.deleteFrom("user").where("id", "=", userId).execute();
}

// ---- Self-service Profile, Requests, Password & Sessions --------------------------

const PROFILE_PREFIX = "nexus:profile:";
const REQUEST_PREFIX = "nexus:request:";
const NON_EXPIRING = new Date("2099-12-31T23:59:59.000Z");

export type OwnUserSummary = {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  createdAt: string;
};

export async function readUserSummary(
  rt: AuthRuntime,
  userId: string,
): Promise<OwnUserSummary | null> {
  const row = await rt.db
    .selectFrom("user")
    .select(["id", "name", "email", "role", "twoFactorEnabled", "createdAt"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!row || !isRole(row.role)) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    twoFactorEnabled: Boolean(row.twoFactorEnabled),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export async function readUserProfileMeta(
  rt: AuthRuntime,
  userId: string,
): Promise<UserProfileMeta> {
  const row = await rt.db
    .selectFrom("verification")
    .select(["value", "updatedAt"])
    .where("identifier", "=", `${PROFILE_PREFIX}${userId}`)
    .orderBy("updatedAt", "desc")
    .executeTakeFirst();
  if (!row) return EMPTY_PROFILE_META;
  try {
    const parsed = JSON.parse(row.value) as Partial<UserProfileMeta>;
    return {
      jobTitle: typeof parsed.jobTitle === "string" ? parsed.jobTitle : "",
      department:
        typeof parsed.department === "string" ? parsed.department : "",
      phone: typeof parsed.phone === "string" ? parsed.phone : "",
      sshPublicKey:
        typeof parsed.sshPublicKey === "string" ? parsed.sshPublicKey : "",
      bio: typeof parsed.bio === "string" ? parsed.bio : "",
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date(row.updatedAt).toISOString(),
    };
  } catch {
    return EMPTY_PROFILE_META;
  }
}

export async function writeUserProfileMeta(
  rt: AuthRuntime,
  userId: string,
  input: {
    name?: string;
    jobTitle: string;
    department: string;
    phone: string;
    sshPublicKey: string;
    bio: string;
  },
  now: number = Date.now(),
): Promise<UserProfileMeta> {
  const nowDate = new Date(now);
  const nowIso = nowDate.toISOString();
  if (input.name && input.name.trim()) {
    await rt.db
      .updateTable("user")
      .set({ name: input.name.trim(), updatedAt: nowDate })
      .where("id", "=", userId)
      .execute();
  }

  const meta: UserProfileMeta = {
    jobTitle: input.jobTitle.trim(),
    department: input.department.trim(),
    phone: input.phone.trim(),
    sshPublicKey: input.sshPublicKey.trim(),
    bio: input.bio.trim(),
    updatedAt: nowIso,
  };

  const identifier = `${PROFILE_PREFIX}${userId}`;
  const existing = await rt.db
    .selectFrom("verification")
    .select("id")
    .where("identifier", "=", identifier)
    .executeTakeFirst();

  if (existing) {
    await rt.db
      .updateTable("verification")
      .set({
        value: JSON.stringify(meta),
        expiresAt: NON_EXPIRING,
        updatedAt: nowDate,
      })
      .where("id", "=", existing.id)
      .execute();
  } else {
    await rt.db
      .insertInto("verification")
      .values({
        id: `prof-${userId.slice(0, 56)}`,
        identifier,
        value: JSON.stringify(meta),
        expiresAt: NON_EXPIRING,
        createdAt: nowDate,
        updatedAt: nowDate,
      })
      .execute();
  }
  return meta;
}

type StoredRequestPayload = {
  category: UserRequestCategory;
  title: string;
  requestedRole?: Role;
  requestedQuotaMb?: number;
  sshPublicKey?: string;
  reason: string;
  status: UserRequestStatus;
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
};

function isRequestCategory(val: unknown): val is UserRequestCategory {
  return (USER_REQUEST_CATEGORIES as readonly string[]).includes(String(val));
}

function parseRequestPayload(raw: string): StoredRequestPayload | null {
  try {
    const parsed = JSON.parse(raw) as Partial<StoredRequestPayload>;
    if (!parsed || !isRequestCategory(parsed.category)) return null;
    const status: UserRequestStatus =
      parsed.status === "approved" || parsed.status === "dismissed"
        ? parsed.status
        : "pending";
    return {
      category: parsed.category,
      title: typeof parsed.title === "string" ? parsed.title : "Request",
      ...(parsed.requestedRole && isRole(parsed.requestedRole)
        ? { requestedRole: parsed.requestedRole }
        : {}),
      ...(typeof parsed.requestedQuotaMb === "number"
        ? { requestedQuotaMb: parsed.requestedQuotaMb }
        : {}),
      ...(typeof parsed.sshPublicKey === "string" && parsed.sshPublicKey
        ? { sshPublicKey: parsed.sshPublicKey }
        : {}),
      reason: typeof parsed.reason === "string" ? parsed.reason : "",
      status,
      createdAt:
        typeof parsed.createdAt === "string"
          ? parsed.createdAt
          : new Date().toISOString(),
      updatedAt:
        typeof parsed.updatedAt === "string"
          ? parsed.updatedAt
          : new Date().toISOString(),
      ...(parsed.resolvedBy !== undefined
        ? { resolvedBy: parsed.resolvedBy }
        : {}),
      ...(parsed.resolutionNote !== undefined
        ? { resolutionNote: parsed.resolutionNote }
        : {}),
    };
  } catch {
    return null;
  }
}

export async function listUserRequests(
  rt: AuthRuntime,
  userId?: string,
): Promise<UserRequestDto[]> {
  let query = rt.db
    .selectFrom("verification")
    .select(["id", "identifier", "value", "createdAt", "updatedAt"])
    .orderBy("createdAt", "desc")
    .limit(200);

  if (userId) {
    query = query.where("identifier", "=", `${REQUEST_PREFIX}${userId}`);
  } else {
    query = query.where("identifier", "like", `${REQUEST_PREFIX}%`);
  }

  const rows = await query.execute();
  if (rows.length === 0) return [];

  const userIds = [
    ...new Set(rows.map((r) => r.identifier.slice(REQUEST_PREFIX.length))),
  ];
  const users = await rt.db
    .selectFrom("user")
    .select(["id", "email", "name", "role"])
    .where("id", "in", userIds)
    .execute();
  const userMap = new Map(users.map((u) => [u.id, u]));

  const out: UserRequestDto[] = [];
  for (const r of rows) {
    const uid = r.identifier.slice(REQUEST_PREFIX.length);
    const payload = parseRequestPayload(r.value);
    if (!payload) continue;
    const owner = userMap.get(uid);
    out.push({
      id: r.id,
      userId: uid,
      userEmail: owner?.email ?? "unknown",
      userName: owner?.name ?? "Unknown user",
      userRole: owner && isRole(owner.role) ? owner.role : "viewer",
      category: payload.category,
      title: payload.title,
      ...(payload.requestedRole
        ? { requestedRole: payload.requestedRole }
        : {}),
      ...(payload.requestedQuotaMb !== undefined
        ? { requestedQuotaMb: payload.requestedQuotaMb }
        : {}),
      ...(payload.sshPublicKey ? { sshPublicKey: payload.sshPublicKey } : {}),
      reason: payload.reason,
      status: payload.status,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
      resolvedBy: payload.resolvedBy ?? null,
      resolutionNote: payload.resolutionNote ?? null,
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createUserRequest(
  rt: AuthRuntime,
  input: {
    userId: string;
    category: UserRequestCategory;
    title: string;
    requestedRole?: Role;
    requestedQuotaMb?: number;
    sshPublicKey?: string;
    reason: string;
  },
  now: number = Date.now(),
): Promise<{ id: string }> {
  const id = `req-${randomUUID().replace(/-/g, "").slice(0, 28)}`;
  const nowDate = new Date(now);
  const nowIso = nowDate.toISOString();
  const payload: StoredRequestPayload = {
    category: input.category,
    title: input.title.trim(),
    ...(input.requestedRole ? { requestedRole: input.requestedRole } : {}),
    ...(input.requestedQuotaMb !== undefined
      ? { requestedQuotaMb: input.requestedQuotaMb }
      : {}),
    ...(input.sshPublicKey?.trim()
      ? { sshPublicKey: input.sshPublicKey.trim() }
      : {}),
    reason: input.reason.trim(),
    status: "pending",
    createdAt: nowIso,
    updatedAt: nowIso,
    resolvedBy: null,
    resolutionNote: null,
  };

  await rt.db
    .insertInto("verification")
    .values({
      id,
      identifier: `${REQUEST_PREFIX}${input.userId}`,
      value: JSON.stringify(payload),
      expiresAt: NON_EXPIRING,
      createdAt: nowDate,
      updatedAt: nowDate,
    })
    .execute();

  if (input.category === "role-upgrade" && input.requestedRole) {
    await syncStageRequestBanReason(
      rt,
      input.userId,
      input.requestedRole,
      input.reason.trim() || input.title.trim(),
    );
  }
  return { id };
}

export async function cancelUserRequest(
  rt: AuthRuntime,
  userId: string,
  requestId: string,
): Promise<boolean> {
  const row = await rt.db
    .selectFrom("verification")
    .select(["id", "value"])
    .where("id", "=", requestId)
    .where("identifier", "=", `${REQUEST_PREFIX}${userId}`)
    .executeTakeFirst();
  if (!row) return false;
  const payload = parseRequestPayload(row.value);
  if (!payload || payload.status !== "pending") return false;

  await rt.db
    .deleteFrom("verification")
    .where("id", "=", requestId)
    .where("identifier", "=", `${REQUEST_PREFIX}${userId}`)
    .execute();

  if (payload.category === "role-upgrade") {
    await clearStageRequest(rt, userId);
  }
  return true;
}

export async function findUserRequestById(
  rt: AuthRuntime,
  requestId: string,
): Promise<UserRequestDto | null> {
  const row = await rt.db
    .selectFrom("verification")
    .select(["id", "identifier", "value"])
    .where("id", "=", requestId)
    .where("identifier", "like", `${REQUEST_PREFIX}%`)
    .executeTakeFirst();
  if (!row) return null;
  const uid = row.identifier.slice(REQUEST_PREFIX.length);
  const payload = parseRequestPayload(row.value);
  if (!payload) return null;
  const user = await rt.db
    .selectFrom("user")
    .select(["email", "name", "role"])
    .where("id", "=", uid)
    .executeTakeFirst();
  return {
    id: row.id,
    userId: uid,
    userEmail: user?.email ?? "unknown",
    userName: user?.name ?? "Unknown user",
    userRole: user && isRole(user.role) ? user.role : "viewer",
    category: payload.category,
    title: payload.title,
    ...(payload.requestedRole ? { requestedRole: payload.requestedRole } : {}),
    ...(payload.requestedQuotaMb !== undefined
      ? { requestedQuotaMb: payload.requestedQuotaMb }
      : {}),
    ...(payload.sshPublicKey ? { sshPublicKey: payload.sshPublicKey } : {}),
    reason: payload.reason,
    status: payload.status,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt,
    resolvedBy: payload.resolvedBy ?? null,
    resolutionNote: payload.resolutionNote ?? null,
  };
}

export async function resolveUserRequestRecord(
  rt: AuthRuntime,
  requestId: string,
  resolution: {
    status: "approved" | "dismissed";
    resolvedBy: string;
    resolutionNote?: string;
  },
  now: number = Date.now(),
): Promise<UserRequestDto | null> {
  const row = await rt.db
    .selectFrom("verification")
    .select(["id", "identifier", "value"])
    .where("id", "=", requestId)
    .where("identifier", "like", `${REQUEST_PREFIX}%`)
    .executeTakeFirst();
  if (!row) return null;
  const payload = parseRequestPayload(row.value);
  if (!payload || payload.status !== "pending") return null;

  const nowDate = new Date(now);
  const updated: StoredRequestPayload = {
    ...payload,
    status: resolution.status,
    updatedAt: nowDate.toISOString(),
    resolvedBy: resolution.resolvedBy,
    resolutionNote: resolution.resolutionNote?.trim() || null,
  };
  await rt.db
    .updateTable("verification")
    .set({ value: JSON.stringify(updated), updatedAt: nowDate })
    .where("id", "=", requestId)
    .execute();

  return findUserRequestById(rt, requestId);
}

export type ChangeOwnPasswordResult =
  | { ok: true }
  | { ok: false; reason: "invalid-password" | "locked" | "no-credential" };

export async function changeOwnPassword(
  rt: AuthRuntime,
  userId: string,
  currentPassword: string,
  newPassword: string,
  options: { revokeOthers?: boolean; currentSessionId?: string | null } = {},
  now: number = Date.now(),
): Promise<ChangeOwnPasswordResult> {
  if (await locked(rt, userId, now)) {
    return { ok: false, reason: "locked" };
  }
  const ok = await passwordMatches(rt, userId, currentPassword);
  if (!ok) {
    await recordFailures(rt.db, [userSubject(userId)], now);
    return { ok: false, reason: "invalid-password" };
  }

  const ctx = await rt.auth.$context;
  const accounts = await ctx.internalAdapter.findAccounts(userId);
  const credential = accounts.find((a) => a.providerId === "credential");
  if (!credential) {
    return { ok: false, reason: "no-credential" };
  }

  const hash = await ctx.password.hash(newPassword);
  await rt.db
    .updateTable("account")
    .set({ password: hash, updatedAt: new Date(now) })
    .where("userId", "=", userId)
    .where("providerId", "=", "credential")
    .execute();

  if (options.revokeOthers) {
    await revokeOtherSessions(rt, userId, options.currentSessionId ?? null);
  }
  return { ok: true };
}

export async function listOwnSessions(
  rt: AuthRuntime,
  userId: string,
  currentSessionId: string | null,
  now: number = Date.now(),
): Promise<OwnSessionDto[]> {
  const rows = await rt.db
    .selectFrom("session")
    .select([
      "id",
      "ipAddress",
      "userAgent",
      "createdAt",
      "updatedAt",
      "expiresAt",
    ])
    .where("userId", "=", userId)
    .where("expiresAt", ">", new Date(now))
    .orderBy("updatedAt", "desc")
    .limit(20)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    ipAddress: r.ipAddress ?? null,
    userAgent: r.userAgent ?? null,
    createdAt: new Date(r.createdAt).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
    expiresAt: new Date(r.expiresAt).toISOString(),
    current: Boolean(currentSessionId && r.id === currentSessionId),
  }));
}

export async function revokeOtherSessions(
  rt: AuthRuntime,
  userId: string,
  currentSessionId: string | null,
): Promise<number> {
  let q = rt.db.deleteFrom("session").where("userId", "=", userId);
  if (currentSessionId) {
    q = q.where("id", "<>", currentSessionId);
  }
  const res = await q.executeTakeFirst();
  return Number(res?.numDeletedRows ?? 0);
}

export { LOCKOUT_MESSAGE };
