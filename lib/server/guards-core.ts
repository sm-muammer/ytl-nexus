import type { z } from "zod";
import type { Role } from "../roles.ts";
import type { AuditEventInput } from "./db/audit.ts";
import {
  decide,
  isOwner,
  policyForAction,
  policyForPage,
  type DenyReason,
  type Identity,
  type Requirement,
} from "./policy.ts";

// The guards: what every protected page, Route Handler and Server Function
// calls first (requirements 6.3 to 6.6). This file holds the logic and nothing
// framework-specific, so the whole role matrix runs in unit tests with plain
// doubles. ./guards.ts wires it to Next.js, Better Auth and the database.
//
// What a refusal does, always in this order: decide, audit once, answer. The
// handler never runs. If the audit store is down the refusal still stands.

export type NavSignal = {
  redirect(to: string): never;
  notFound(): never;
  forbidden(): never;
};

export type GuardDeps = {
  now(): number;
  identity(): Promise<Identity>;
  sourceIp(): Promise<string>;
  audit(event: AuditEventInput): Promise<void>;
  nav: NavSignal;
};

type UserIdentity = Extract<Identity, { kind: "user" }>;

export type PageAccess = {
  identity: Identity;
  /** True when the page must show the Step_Up form instead of its content. */
  stepUpRequired: boolean;
};

export type ActionError =
  | "unauthenticated"
  | "forbidden"
  | "not-found"
  | "enrolment-required"
  | "step-up-required"
  | "invalid-input"
  | "failed";

export type Refusal = {
  ok: false;
  error: ActionError;
  /** Names of the fields that failed validation. Never the values. */
  fields?: string[];
};

type HandlerResult = { ok: true } | { ok: false; error: string };

export type ActionContext = {
  identity: Identity;
  sourceIp: string;
  /** True when the signed-in user owns the resource with this owner id. */
  owns(ownerId: string): boolean;
};

export type ActionSpec<S extends z.ZodType> = {
  /** A key of ACTION_POLICY; also the audit action. */
  id: string;
  schema: S;
  /** What the action was done to, for the audit trail. Runs on validated input. */
  target(input: z.output<S>): string;
  /**
   * "all" (default) audits the outcome. "refusals-only" is for actions whose
   * outcome Better Auth already audits (sign-in, enrolment).
   */
  audit?: "all" | "refusals-only";
};

export type HandlerSpec = {
  id: string;
  requirement: Requirement;
};

function reasonToError(reason: DenyReason): ActionError {
  switch (reason) {
    case "unauthenticated":
      return "unauthenticated";
    case "insufficient-role":
      return "forbidden";
    case "hidden":
      return "not-found";
    case "two-factor-enrolment":
      return "enrolment-required";
    case "step-up-required":
      return "step-up-required";
  }
}

function signInUrl(next: string, step?: "enrol"): string {
  const params = step
    ? `step=${step}&next=${encodeURIComponent(next)}`
    : `next=${encodeURIComponent(next)}`;
  return `/signin?${params}`;
}

export function createGuards(deps: GuardDeps) {
  async function refuse(
    action: string,
    target: string,
    identity: Identity,
  ): Promise<void> {
    await record(action, target, identity, "refused");
  }

  async function record(
    action: string,
    target: string,
    identity: Identity,
    result: AuditEventInput["result"],
  ): Promise<void> {
    try {
      await deps.audit({
        actorId: identity.kind === "user" ? identity.userId : null,
        role: identity.kind === "user" ? identity.role : null,
        action,
        target: target.slice(0, 255),
        result,
        sourceIp: await deps.sourceIp(),
      });
    } catch (error) {
      // Never let a failing audit store turn a refusal into an approval.
      console.error(
        "audit write failed:",
        error instanceof Error ? error.name : "unknown error",
      );
    }
  }

  /** Navigates away for a page that is not allowed. Always throws. */
  function leave(reason: DenyReason, path: string): never {
    switch (reason) {
      case "unauthenticated":
        return deps.nav.redirect(signInUrl(path));
      case "two-factor-enrolment":
        return deps.nav.redirect(signInUrl(path, "enrol"));
      case "hidden":
        return deps.nav.notFound();
      case "step-up-required":
      case "insufficient-role":
        return deps.nav.forbidden();
    }
  }

  /**
   * For pages and layouts. Applies the page's row in the policy table. Not
   * allowed: audit once, then redirect to sign-in, redirect to enrolment, 403
   * or the unknown-path 404. A page that needs Step_Up gets `stepUpRequired`
   * and shows the form; that prompt is not a refusal and is not audited.
   */
  async function requirePage(path: string): Promise<PageAccess> {
    const policy = policyForPage(path);
    const identity = await deps.identity();
    const decision = decide(identity, policy, deps.now());
    if (decision.allow) return { identity, stepUpRequired: false };
    if (decision.reason === "step-up-required") {
      return { identity, stepUpRequired: true };
    }
    await refuse("access.page", path, identity);
    return leave(decision.reason, path);
  }

  /** Same as `requirePage`, for a minimum role stated in the code. */
  async function requireRole(
    min: Role,
    options: { path: string; hidden?: boolean },
  ): Promise<UserIdentity> {
    const identity = await deps.identity();
    const decision = decide(
      identity,
      { minRole: min, ...(options.hidden ? { hidden: true } : {}) },
      deps.now(),
    );
    if (decision.allow && identity.kind === "user") return identity;
    if (decision.allow)
      throw new Error("A role was required for a public path.");
    await refuse("access.page", options.path, identity);
    return leave(decision.reason, options.path);
  }

  /**
   * For a page below /control that needs a fresh Step_Up: sends the
   * Administrator back to /control, where the form is. Not for /control itself.
   */
  async function requireStepUp(): Promise<UserIdentity> {
    const identity = await deps.identity();
    const decision = decide(
      identity,
      { minRole: "admin", hidden: true, stepUp: true },
      deps.now(),
    );
    if (decision.allow && identity.kind === "user") return identity;
    if (!decision.allow && decision.reason === "step-up-required") {
      return deps.nav.redirect("/control");
    }
    await refuse("access.page", "/control", identity);
    return leave(decision.allow ? "hidden" : decision.reason, "/control");
  }

  /**
   * For Server Functions. They are public HTTP endpoints, so this re-checks
   * the role whatever the page did. Order: authorize, validate, run, audit.
   * Exactly one audit event per call (Property 5).
   */
  function guardAction<S extends z.ZodType, R extends HandlerResult>(
    spec: ActionSpec<S>,
    handler: (input: z.output<S>, ctx: ActionContext) => Promise<R>,
  ): (rawInput: unknown) => Promise<R | Refusal> {
    const policy = policyForAction(spec.id);
    const onlyRefusals = spec.audit === "refusals-only";

    return async (rawInput) => {
      const identity = await deps.identity();
      const decision = decide(identity, policy, deps.now());
      if (!decision.allow) {
        await refuse(spec.id, spec.id, identity);
        return { ok: false, error: reasonToError(decision.reason) };
      }

      const parsed = spec.schema.safeParse(rawInput);
      if (!parsed.success) {
        await refuse(spec.id, spec.id, identity);
        const fields = [
          ...new Set(
            parsed.error.issues.map((i) => i.path.join(".") || "(input)"),
          ),
        ];
        return { ok: false, error: "invalid-input", fields };
      }

      const target = spec.target(parsed.data);
      const sourceIp = await deps.sourceIp();
      const ctx: ActionContext = {
        identity,
        sourceIp,
        owns: (ownerId) => isOwner(identity, ownerId),
      };
      let outcome: R | Refusal;
      try {
        outcome = await handler(parsed.data, ctx);
      } catch {
        if (!onlyRefusals) await record(spec.id, target, identity, "failure");
        return { ok: false, error: "failed" };
      }
      if (!onlyRefusals) {
        await record(
          spec.id,
          target,
          identity,
          outcome.ok ? "success" : "failure",
        );
      }
      return outcome;
    };
  }

  /**
   * For Route Handlers. Answers 401 to a Visitor, 403 when the role is too low
   * or enrolment or Step_Up is missing, and 404 with no body for a hidden
   * area. The handler runs only when allowed. Input validation belongs to the
   * handler (Zod) and, like its work, is audited there.
   */
  function guardHandler(
    spec: HandlerSpec,
    handler: (request: Request, ctx: ActionContext) => Promise<Response>,
  ): (request: Request) => Promise<Response> {
    return async (request) => {
      const identity = await deps.identity();
      const decision = decide(identity, spec.requirement, deps.now());
      if (!decision.allow) {
        await refuse("access.handler", spec.id, identity);
        if (decision.reason === "hidden")
          return new Response(null, { status: 404 });
        const status = decision.reason === "unauthenticated" ? 401 : 403;
        return Response.json(
          { error: reasonToError(decision.reason) },
          { status },
        );
      }
      const sourceIp = await deps.sourceIp();
      return handler(request, {
        identity,
        sourceIp,
        owns: (ownerId) => isOwner(identity, ownerId),
      });
    };
  }

  return { requirePage, requireRole, requireStepUp, guardAction, guardHandler };
}

export type Guards = ReturnType<typeof createGuards>;
