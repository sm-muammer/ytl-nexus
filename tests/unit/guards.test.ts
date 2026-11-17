import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ROLES, ROLE_RANK, type Role } from "@/lib/roles";
import {
  createGuards,
  type GuardDeps,
  type NavSignal,
} from "@/lib/server/guards-core";
import { isOwner, type Identity } from "@/lib/server/policy";
import type { AuditEventInput } from "@/lib/server/db/audit";
import { PAGE_MATRIX } from "../helpers/role-matrix";

const NOW = 1_800_000_000_000;

// ---- Test doubles ----------------------------------------------------------------

class Nav extends Error {
  constructor(
    readonly kind: "redirect" | "not-found" | "forbidden",
    readonly to?: string,
  ) {
    super(kind);
  }
}

function setup(identity: Identity) {
  const audits: AuditEventInput[] = [];
  const deps: GuardDeps = {
    now: () => NOW,
    identity: async () => identity,
    sourceIp: async () => "10.26.64.9",
    audit: async (e) => {
      audits.push(e);
    },
    nav: {
      redirect: (to) => {
        throw new Nav("redirect", to);
      },
      notFound: () => {
        throw new Nav("not-found");
      },
      forbidden: () => {
        throw new Nav("forbidden");
      },
    } satisfies NavSignal,
  };
  return { guards: createGuards(deps), audits };
}

const user = (
  role: Role,
  extra: Partial<Extract<Identity, { kind: "user" }>> = {},
): Identity => ({
  kind: "user",
  userId: `u-${role}`,
  role,
  twoFactorEnabled: true,
  stepUpAt: NOW - 60_000,
  ...extra,
});
const visitor: Identity = { kind: "visitor" };

async function navOutcome(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "allow";
  } catch (e) {
    if (e instanceof Nav) return e.to ? `${e.kind}:${e.to}` : e.kind;
    throw e;
  }
}

const identities: [string, Identity, number | null][] = [
  ["visitor", visitor, null],
  ["viewer", user("viewer"), 1],
  ["member", user("member"), 2],
  ["operator", user("operator"), 3],
  ["admin", user("admin"), 4],
];

describe("every page against every actor (requirements 6.3, 6.26)", () => {
  for (const [path, min] of Object.entries(PAGE_MATRIX)) {
    for (const [name, identity, rank] of identities) {
      const allowed = min === null || (rank !== null && rank >= ROLE_RANK[min]);
      it(`${path} for ${name}: ${allowed ? "allowed" : "refused"}`, async () => {
        const { guards, audits } = setup(identity);
        const out = await navOutcome(() => guards.requirePage(path));
        if (allowed) {
          expect(out).toBe("allow");
          expect(audits).toHaveLength(0);
        } else if (identity.kind === "visitor") {
          expect(out).toBe(`redirect:/signin?next=${encodeURIComponent(path)}`);
          expect(audits).toHaveLength(1);
        } else {
          expect(out).toBe("forbidden");
          expect(audits).toHaveLength(1);
        }
        if (!allowed) {
          expect(audits[0]).toMatchObject({
            action: "access.page",
            target: path,
            result: "refused",
            sourceIp: "10.26.64.9",
          });
        }
      });
    }
  }
});

describe("/control (requirements 6.10, 6.11)", () => {
  it("answers everyone but an Administrator with the unknown-path 404, and audits it", async () => {
    for (const identity of [
      visitor,
      user("viewer"),
      user("member"),
      user("operator"),
    ]) {
      const { guards, audits } = setup(identity);
      expect(await navOutcome(() => guards.requirePage("/control"))).toBe(
        "not-found",
      );
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: "access.page",
        target: "/control",
        result: "refused",
      });
    }
  });

  it("covers every path under /control", async () => {
    const { guards } = setup(user("member"));
    expect(await navOutcome(() => guards.requirePage("/control/users"))).toBe(
      "not-found",
    );
  });

  it("lets an Administrator in and reports when Step_Up is needed, without auditing the prompt", async () => {
    const stale = setup(user("admin", { stepUpAt: null }));
    expect(await stale.guards.requirePage("/control")).toMatchObject({
      stepUpRequired: true,
    });
    expect(stale.audits).toHaveLength(0);

    const fresh = setup(user("admin"));
    expect(await fresh.guards.requirePage("/control")).toMatchObject({
      stepUpRequired: false,
    });
  });

  it("sends an unenrolled Administrator to enrolment, not to a 404", async () => {
    const { guards } = setup(user("admin", { twoFactorEnabled: false }));
    expect(await navOutcome(() => guards.requirePage("/control"))).toBe(
      `redirect:/signin?step=enrol&next=${encodeURIComponent("/control")}`,
    );
  });
});

describe("two-factor enrolment on pages (requirement 6.9)", () => {
  it("sends an unenrolled Administrator to enrol before protected pages", async () => {
    const { guards, audits } = setup(
      user("admin", { twoFactorEnabled: false }),
    );
    expect(await navOutcome(() => guards.requirePage("/control"))).toBe(
      `redirect:/signin?step=enrol&next=${encodeURIComponent("/control")}`,
    );
    expect(audits).toHaveLength(1);
  });

  it("does not ask an Operator or Member for it", async () => {
    const { guards: operatorGuards } = setup(
      user("operator", { twoFactorEnabled: false }),
    );
    expect(await navOutcome(() => operatorGuards.requirePage("/command"))).toBe(
      "allow",
    );

    const { guards: memberGuards } = setup(
      user("member", { twoFactorEnabled: false }),
    );
    expect(await navOutcome(() => memberGuards.requirePage("/ai"))).toBe(
      "allow",
    );
  });
});

describe("unknown pages fail closed", () => {
  it("throws for a path with no policy", async () => {
    const { guards } = setup(user("admin"));
    await expect(guards.requirePage("/not-registered")).rejects.toThrow(
      /policy/,
    );
  });
});

// ---- Server Functions --------------------------------------------------------------

describe("guardAction (requirements 6.4, 6.5, 6.6, 6.20, 6.27)", () => {
  const schema = z.object({ userId: z.string().min(1).max(64) });

  type Result = { ok: true } | { ok: false; error: string };
  function build(
    identity: Identity,
    handler = vi.fn(async (): Promise<Result> => ({ ok: true })),
  ) {
    const ctx = setup(identity);
    const action = ctx.guards.guardAction(
      {
        id: "control.user.revoke-sessions",
        schema,
        target: (input) => `user:${input.userId}`,
      },
      handler,
    );
    return { ...ctx, handler, action };
  }

  const matrix: [string, Identity, string][] = [
    ["a Visitor", visitor, "not-found"],
    ["a Viewer", user("viewer"), "not-found"],
    ["a Member", user("member"), "not-found"],
    ["an Operator", user("operator"), "not-found"],
    [
      "an unenrolled Administrator",
      user("admin", { twoFactorEnabled: false }),
      "enrolment-required",
    ],
    [
      "an Administrator without Step_Up",
      user("admin", { stepUpAt: null }),
      "step-up-required",
    ],
    [
      "an Administrator with a stale Step_Up",
      user("admin", { stepUpAt: NOW - 11 * 60_000 }),
      "step-up-required",
    ],
  ];

  for (const [who, identity, error] of matrix) {
    it(`refuses ${who} without running the handler, and audits once`, async () => {
      const { action, handler, audits } = build(identity);
      const result = await action({ userId: "u-1" });
      expect(result).toEqual({ ok: false, error });
      expect(handler).not.toHaveBeenCalled();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({
        action: "control.user.revoke-sessions",
        result: "refused",
        sourceIp: "10.26.64.9",
      });
    });
  }

  it("runs the handler for an Administrator with a fresh Step_Up and audits one success", async () => {
    const { action, handler, audits } = build(user("admin"));
    const result = await action({ userId: "u-9" });
    expect(result).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(audits).toEqual([
      {
        actorId: "u-admin",
        role: "admin",
        action: "control.user.revoke-sessions",
        target: "user:u-9",
        result: "success",
        sourceIp: "10.26.64.9",
      },
    ]);
  });

  it("checks the role before it looks at the input", async () => {
    const { action, handler, audits } = build(user("member"));
    // Invalid input from someone who may not call it at all: still just a refusal.
    expect(await action({ nope: 1 })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(handler).not.toHaveBeenCalled();
    expect(audits).toHaveLength(1);
    expect(audits[0]?.result).toBe("refused");
  });

  it("rejects invalid input before the handler, reports field names only, and audits once", async () => {
    const hostile = [
      undefined,
      null,
      {},
      { userId: "" },
      { userId: "x".repeat(65) },
      { userId: 42 },
      { userId: "'; DROP TABLE user; --".repeat(10) },
      { userId: ["<script>"] },
    ];
    for (const input of hostile) {
      const { action, handler, audits } = build(user("admin"));
      const result = await action(input);
      expect(result.ok).toBe(false);
      if (!result.ok && result.error === "invalid-input") {
        expect(JSON.stringify(result)).not.toContain("DROP TABLE");
        expect(JSON.stringify(result)).not.toContain("<script>");
      }
      expect(handler).not.toHaveBeenCalled();
      expect(audits).toHaveLength(1);
      expect(audits[0]).toMatchObject({ result: "refused" });
    }
  });

  it("turns a thrown error into a failure with no detail, audited once", async () => {
    const boom = vi.fn(async (): Promise<Result> => {
      throw new Error("ECONNREFUSED 127.0.0.1:3306 password=hunter2");
    });
    const { action, audits } = build(user("admin"), boom);
    const result = await action({ userId: "u-1" });
    expect(result).toEqual({ ok: false, error: "failed" });
    expect(JSON.stringify(result)).not.toMatch(/ECONNREFUSED|hunter2/);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ result: "failure", target: "user:u-1" });
    expect(JSON.stringify(audits)).not.toMatch(/hunter2/);
  });

  it("audits a domain failure the handler reports as one failure", async () => {
    const miss = vi.fn(async (): Promise<Result> => ({
      ok: false,
      error: "not-found",
    }));
    const { action, audits } = build(user("admin"), miss);
    expect(await action({ userId: "ghost" })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ result: "failure" });
  });

  it("still refuses when the audit store is down", async () => {
    const { guards } = setup(visitor);
    const failing = createGuards({
      now: () => NOW,
      identity: async () => visitor,
      sourceIp: async () => "10.0.0.1",
      audit: async () => {
        throw new Error("database down");
      },
      nav: {
        redirect: () => {
          throw new Nav("redirect");
        },
        notFound: () => {
          throw new Nav("not-found");
        },
        forbidden: () => {
          throw new Nav("forbidden");
        },
      },
    });
    const handler = vi.fn(async () => ({ ok: true as const }));
    const action = failing.guardAction(
      { id: "control.user.revoke-sessions", schema, target: () => "x" },
      handler,
    );
    expect(await action({ userId: "u" })).toEqual({
      ok: false,
      error: "not-found",
    });
    expect(handler).not.toHaveBeenCalled();
    expect(guards).toBeDefined();
  });

  it("with audit set to refusals-only, writes nothing for a handled success", async () => {
    const ctx = setup(user("viewer"));
    const action = ctx.guards.guardAction(
      {
        id: "auth.start-enrolment",
        schema: z.object({ password: z.string().min(1) }),
        target: () => "self",
        audit: "refusals-only",
      },
      async () => ({ ok: true as const }),
    );
    expect(await action({ password: "x" })).toEqual({ ok: true });
    expect(ctx.audits).toHaveLength(0);
  });

  it("lets an unenrolled Operator reach the enrolment action only", async () => {
    const ctx = setup(user("operator", { twoFactorEnabled: false }));
    const enrol = ctx.guards.guardAction(
      {
        id: "auth.start-enrolment",
        schema: z.object({}),
        target: () => "self",
        audit: "refusals-only",
      },
      async () => ({ ok: true as const }),
    );
    expect(await enrol({})).toEqual({ ok: true });
  });
});

// ---- Route Handlers ---------------------------------------------------------------------

describe("guardHandler (requirements 6.3, 6.27)", () => {
  function build(identity: Identity, min: Role | null) {
    const ctx = setup(identity);
    const handler = vi.fn(async () => Response.json({ secret: "data" }));
    const route = ctx.guards.guardHandler(
      { id: "test.handler", requirement: { minRole: min } },
      handler,
    );
    return { ...ctx, handler, route };
  }
  const req = () =>
    new Request("https://nexus.test/api/x", { method: "POST", body: "{}" });

  it("answers 401 to a Visitor, 403 to a role that is too low, and never runs the handler", async () => {
    const a = build(visitor, "viewer");
    expect((await a.route(req())).status).toBe(401);
    expect(a.handler).not.toHaveBeenCalled();
    expect(a.audits).toHaveLength(1);

    const b = build(user("member"), "operator");
    const res = await b.route(req());
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("data");
    expect(b.handler).not.toHaveBeenCalled();
    expect(b.audits[0]).toMatchObject({
      result: "refused",
      action: "access.handler",
    });
  });

  it("runs the handler for an allowed role, without auditing a plain read", async () => {
    const a = build(user("operator"), "operator");
    expect((await a.route(req())).status).toBe(200);
    expect(a.handler).toHaveBeenCalledTimes(1);
    expect(a.audits).toHaveLength(0);
  });

  it("is open to a Visitor when the route is public", async () => {
    const a = build(visitor, null);
    expect((await a.route(req())).status).toBe(200);
  });
});

// ---- Properties ------------------------------------------------------------------------------

describe("Property 3 through the guards: any role against any page minimum", () => {
  it("grants exactly when the rank is high enough, and a refusal never runs the handler", async () => {
    const roleArb = fc.constantFrom(...ROLES);
    const minArb = fc.constantFrom<Role | null>(null, ...ROLES);
    await fc.assert(
      fc.asyncProperty(roleArb, minArb, async (role, min) => {
        const ctx = setup(user(role));
        const handler = vi.fn(async () => Response.json({}));
        const route = ctx.guards.guardHandler(
          { id: "p", requirement: { minRole: min } },
          handler,
        );
        const res = await route(new Request("https://nexus.test/api/p"));
        const allowed = min === null || ROLE_RANK[role] >= ROLE_RANK[min];
        expect(res.status === 200).toBe(allowed);
        expect(handler.mock.calls.length).toBe(allowed ? 1 : 0);
        expect(ctx.audits.length).toBe(allowed ? 0 : 1);
      }),
      { numRuns: 200 },
    );
  });
});

describe("Property 4: resource ownership prevents IDOR (requirement 6.28)", () => {
  it("never treats another user's resource as owned, whatever the role", () => {
    const idArb = fc.string({ minLength: 1, maxLength: 40 });
    fc.assert(
      fc.property(idArb, idArb, fc.constantFrom(...ROLES), (a, b, role) => {
        fc.pre(a !== b);
        const actor = user(role, { userId: a });
        expect(isOwner(actor, b)).toBe(false);
        expect(isOwner(actor, a)).toBe(true);
      }),
    );
  });

  it("owns nothing as a Visitor", () => {
    expect(isOwner(visitor, "anyone")).toBe(false);
  });
});

describe("Property 5: every mutation writes exactly one audit event", () => {
  it("holds for any identity and any input, success or not", async () => {
    const roleArb = fc.constantFrom(...ROLES);
    const idArb = fc.oneof(
      fc.string({ maxLength: 80 }),
      fc.constant(undefined),
      fc.constant(null),
      fc.integer(),
    );
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(roleArb, fc.constant("visitor" as const)),
        fc.boolean(),
        idArb,
        fc.boolean(),
        async (who, stepped, raw, failHandler) => {
          const identity =
            who === "visitor"
              ? visitor
              : user(who, { stepUpAt: stepped ? NOW - 1000 : null });
          const ctx = setup(identity);
          const action = ctx.guards.guardAction(
            {
              id: "control.user.reset-password",
              schema: z.object({ userId: z.string().min(1).max(64) }),
              target: (i) => `user:${i.userId}`,
            },
            async () => {
              if (failHandler) throw new Error("x");
              return { ok: true as const };
            },
          );
          await action(raw === undefined ? undefined : { userId: raw });
          expect(ctx.audits).toHaveLength(1);
          expect(ctx.audits[0]?.action).toBe("control.user.reset-password");
        },
      ),
      { numRuns: 300 },
    );
  });
});
