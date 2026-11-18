import { PAGES } from "../navigation/modules.ts";
import { ROLE_RANK, type Actor, type Role } from "../roles.ts";
import { isStepUpFresh, requiresTwoFactor } from "./auth/rules.ts";

// The policy table: who may reach every page, Route Handler and Server
// Function, and the one function that decides. Pure data and logic with no
// I/O. The guards in ./guards.ts apply it; tests walk the whole table.

export { ROLE_RANK };

export type Identity =
  | { kind: "visitor" }
  | {
      kind: "user";
      userId: string;
      role: Role;
      twoFactorEnabled: boolean;
      /** Milliseconds since the epoch of the last password plus TOTP check. */
      stepUpAt: number | null;
    };

export type Requirement = {
  /** `null` is public. */
  minRole: Role | null;
  /** Needs password plus TOTP within the last 10 minutes (requirement 6.10). */
  stepUp?: boolean;
  /**
   * Answers with the unknown-path 404 to anyone who fails the role check, so
   * the area's existence is not revealed (requirement 6.11).
   */
  hidden?: boolean;
  /** For the pages where an unenrolled Operator or Administrator enrols. */
  allowUnenrolled?: boolean;
};

export type DenyReason =
  | "unauthenticated"
  | "insufficient-role"
  | "two-factor-enrolment"
  | "step-up-required"
  | "hidden";

export type Decision = { allow: true } | { allow: false; reason: DenyReason };

/**
 * The single authorization rule. Order matters: the role check comes first, so
 * a user without the role learns nothing about enrolment or step-up, and a
 * hidden area looks the same to every user who is not allowed in.
 */
export function decide(
  identity: Identity,
  req: Requirement,
  now: number,
): Decision {
  if (req.minRole === null) return { allow: true };

  if (identity.kind === "visitor") {
    return { allow: false, reason: req.hidden ? "hidden" : "unauthenticated" };
  }
  if (ROLE_RANK[identity.role] < ROLE_RANK[req.minRole]) {
    return {
      allow: false,
      reason: req.hidden ? "hidden" : "insufficient-role",
    };
  }
  if (
    !req.allowUnenrolled &&
    requiresTwoFactor(identity.role) &&
    !identity.twoFactorEnabled
  ) {
    return { allow: false, reason: "two-factor-enrolment" };
  }
  if (req.stepUp && !isStepUpFresh(identity.stepUpAt, now)) {
    return { allow: false, reason: "step-up-required" };
  }
  return { allow: true };
}

/**
 * The actor for menus and labels. A user who still has to enrol two-factor is
 * not shown as signed in: the guards send them to enrolment, and the menu must
 * not offer them pages they cannot open.
 */
export function identityToActor(identity: Identity): Actor {
  if (identity.kind !== "user") return null;
  if (requiresTwoFactor(identity.role) && !identity.twoFactorEnabled) {
    return null;
  }
  return { userId: identity.userId, role: identity.role };
}

/**
 * True when the signed-in user owns the resource (requirement 6.28). Ownership
 * is by identity only: no role, not even Administrator, owns another user's
 * files, chats or mailbox through the ordinary routes. Administrators manage
 * accounts through Nexus Control, which has its own audited actions.
 */
export function isOwner(identity: Identity, ownerId: string): boolean {
  return identity.kind === "user" && identity.userId === ownerId;
}

// ---- Pages -----------------------------------------------------------------

export type PagePolicy = Requirement & { path: string };

const CONTROL: Requirement = { minRole: "admin", hidden: true, stepUp: true };

export const PAGE_POLICY: readonly PagePolicy[] = [
  { path: "/", minRole: null },
  { path: "/design", minRole: "viewer" },
  // Public shell; the item itself is filtered for the actor (lib/server/content.ts).
  { path: "/library/[slug]", minRole: null },
  ...PAGES.map((p): PagePolicy => {
    if (p.path === "/control" || p.path.startsWith("/control/"))
      return { path: p.path, ...CONTROL };
    return { path: p.path, minRole: p.minRole };
  }),
];

/** The requirement for a page. Any path under /control is Control. */
export function policyForPage(path: string): PagePolicy {
  const exact = PAGE_POLICY.find((p) => p.path === path);
  if (exact) return exact;
  if (path.startsWith("/control/")) return { path, ...CONTROL };
  throw new Error(`No access policy is registered for ${path}`);
}

// ---- Route Handlers ----------------------------------------------------------

export type HandlerPolicy = Requirement & {
  /** Stable name used in tests and audit targets. */
  id: string;
  method: "GET" | "POST";
  path: string;
  /** Why a handler with no minimum role is safe. */
  note?: string;
};

export const HANDLER_POLICY: readonly HandlerPolicy[] = [
  {
    id: "health.live",
    method: "GET",
    path: "/api/health/live",
    minRole: null,
    note: "Reports only that the process is up.",
  },
  {
    id: "health.ready",
    method: "GET",
    path: "/api/health/ready",
    minRole: null,
    note: "Reports ok or unavailable per dependency, with no detail.",
  },
  {
    id: "content.revalidate",
    method: "POST",
    path: "/api/revalidate",
    minRole: null,
    note: "Authenticated by an HMAC signature with timestamp and single-use nonce; changes no data, only drops cache entries.",
  },
  {
    id: "library.list",
    method: "GET",
    path: "/api/library",
    minRole: null,
    note: "Lists content already filtered for the caller's role: a Visitor receives public items only.",
  },
  {
    id: "metrics.stream",
    method: "GET",
    path: "/api/stream/metrics",
    minRole: "viewer",
  },
  {
    id: "data.export",
    method: "GET",
    path: "/api/data/export",
    minRole: "viewer",
  },
  {
    id: "auth.api",
    method: "POST",
    path: "/api/auth/[...all]",
    minRole: null,
    note: "Better Auth applies its own checks, lockout, rate limits and audit hooks; the routes that change accounts are disabled.",
  },
  {
    id: "ai.chat",
    method: "POST",
    path: "/api/ai/chat",
    minRole: null,
    note: "Public scope serves Yes Experience; workspace queries check Member role inside the handler.",
  },
  {
    id: "ai.conversations",
    method: "GET",
    path: "/api/ai/conversations",
    minRole: "member",
  },
  {
    id: "control.audit.export",
    method: "GET",
    path: "/api/control/audit/export",
    ...CONTROL,
  },
  {
    id: "transfer.sso-ticket",
    method: "GET",
    path: "/api/transfer/sso-ticket",
    minRole: "viewer",
  },
];

export function policyForHandler(id: string): HandlerPolicy {
  const found = HANDLER_POLICY.find((h) => h.id === id);
  if (!found) throw new Error(`No access policy is registered for ${id}`);
  return found;
}

// ---- Server Functions ----------------------------------------------------------

export type ActionPolicy = Requirement & {
  id: string;
  note?: string;
};

export const ACTION_POLICY: readonly ActionPolicy[] = [
  {
    id: "demo.set-session",
    minRole: null,
    note: "Does nothing outside Demo_Mode; changes a presentation cookie only.",
  },
  {
    id: "auth.sign-in",
    minRole: null,
    note: "Credentials are checked by Better Auth, behind the lockout.",
  },
  {
    id: "auth.sign-up",
    minRole: null,
    note: "Public self-service registration into Stage 1 (Member).",
  },
  {
    id: "auth.request-stage-upgrade",
    minRole: "member",
    note: "Members request promotion to Operator (Stage 2) or Administrator (Stage 3).",
  },
  {
    id: "auth.verify-two-factor",
    minRole: null,
    note: "Needs the pending two-factor cookie issued by a correct password.",
  },
  { id: "auth.sign-out", minRole: null },
  { id: "auth.start-enrolment", minRole: "viewer", allowUnenrolled: true },
  { id: "auth.confirm-enrolment", minRole: "viewer", allowUnenrolled: true },
  { id: "auth.step-up", minRole: "admin", hidden: true },
  // Operations through the nexus-ops agent (requirement 9.11). Operators and
  // Administrators only; the agent re-checks the request on its own.
  { id: "ops.restart", minRole: "operator" },
  { id: "ops.logs", minRole: "operator" },
  { id: "ops.health", minRole: "operator" },
  // Incidents (requirement 9.17).
  { id: "status.incident.open", minRole: "operator" },
  { id: "status.incident.update", minRole: "operator" },
  // Nexus Data records (requirement 11.2).
  { id: "data.record.create", minRole: "operator" },
  { id: "data.record.update", minRole: "operator" },
  { id: "data.record.delete", minRole: "operator" },
  { id: "control.user.create", ...CONTROL },
  { id: "control.user.change-role", ...CONTROL },
  { id: "control.user.set-enabled", ...CONTROL },
  { id: "control.user.reset-2fa", ...CONTROL },
  { id: "control.user.reset-password", ...CONTROL },
  { id: "control.user.revoke-sessions", ...CONTROL },
  { id: "control.user.update-name", ...CONTROL },
  { id: "control.user.dismiss-stage-request", ...CONTROL },
  { id: "control.user.delete", ...CONTROL },
  // Nexus Transfer accounts (requirement 12.16). Administrators in Control, with a fresh Step_Up.
  { id: "transfer.account.create", ...CONTROL },
  { id: "transfer.account.set-enabled", ...CONTROL },
  { id: "transfer.account.set-quota", ...CONTROL },
  { id: "transfer.account.reset-password", ...CONTROL },
  { id: "transfer.account.delete", ...CONTROL },
  { id: "transfer.key.add", ...CONTROL },
  { id: "transfer.key.remove", ...CONTROL },
  // Nexus Mail accounts (requirement 13.8). Administrators in Control, with a fresh Step_Up.
  { id: "mail.account.create", ...CONTROL },
  { id: "mail.account.set-enabled", ...CONTROL },
  { id: "mail.account.set-quota", ...CONTROL },
  { id: "mail.account.reset-password", ...CONTROL },
  { id: "mail.account.delete", ...CONTROL },
];

export function policyForAction(id: string): ActionPolicy {
  const found = ACTION_POLICY.find((a) => a.id === id);
  if (!found) throw new Error(`No access policy is registered for ${id}`);
  return found;
}
