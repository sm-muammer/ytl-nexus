import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { ROLES, ROLE_RANK, type Role } from "@/lib/roles";
import {
  ACTION_POLICY,
  HANDLER_POLICY,
  PAGE_POLICY,
  decide,
  policyForPage,
  type Identity,
  type Requirement,
} from "@/lib/server/policy";
import { ROUTE_PATHS } from "@/lib/navigation/modules";

const NOW = 1_800_000_000_000;

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

const roleArb = fc.constantFrom(...ROLES);
const minArb = fc.constantFrom<Role | null>(null, ...ROLES);

describe("Property 3: role-matrix authorization (requirements 6.3, 6.4, 6.11)", () => {
  it("grants exactly when the rank is at least the minimum", () => {
    fc.assert(
      fc.property(roleArb, minArb, (role, min) => {
        const d = decide(user(role), { minRole: min }, NOW);
        const expected = min === null || ROLE_RANK[role] >= ROLE_RANK[min];
        expect(d.allow).toBe(expected);
      }),
    );
  });

  it("lets a Visitor into public requirements only", () => {
    fc.assert(
      fc.property(minArb, (min) => {
        const d = decide(visitor, { minRole: min }, NOW);
        expect(d.allow).toBe(min === null);
        if (!d.allow) expect(d.reason).toBe("unauthenticated");
      }),
    );
  });

  it("says insufficient-role for a signed-in user below the minimum", () => {
    const d = decide(user("member"), { minRole: "operator" }, NOW);
    expect(d).toEqual({ allow: false, reason: "insufficient-role" });
  });

  it("hides a hidden requirement from everyone who fails the role check, Visitors included", () => {
    const req: Requirement = { minRole: "admin", hidden: true };
    for (const identity of [
      visitor,
      user("viewer"),
      user("member"),
      user("operator"),
    ]) {
      expect(decide(identity, req, NOW)).toEqual({
        allow: false,
        reason: "hidden",
      });
    }
    expect(decide(user("admin"), req, NOW).allow).toBe(true);
  });
});

describe("two-factor enrolment (requirement 6.9)", () => {
  it("blocks Operators and Administrators who have not enrolled, on any protected requirement", () => {
    for (const role of ["operator", "admin"] as const) {
      expect(
        decide(
          user(role, { twoFactorEnabled: false }),
          { minRole: "viewer" },
          NOW,
        ),
      ).toEqual({ allow: false, reason: "two-factor-enrolment" });
    }
  });

  it("does not require it of Viewers and Members", () => {
    for (const role of ["viewer", "member"] as const) {
      expect(
        decide(
          user(role, { twoFactorEnabled: false }),
          { minRole: "viewer" },
          NOW,
        ).allow,
      ).toBe(true);
    }
  });

  it("does not apply to public requirements", () => {
    expect(
      decide(user("admin", { twoFactorEnabled: false }), { minRole: null }, NOW)
        .allow,
    ).toBe(true);
  });

  it("checks the role first, so a Member never learns about hidden areas", () => {
    expect(
      decide(
        user("operator", { twoFactorEnabled: false }),
        { minRole: "admin", hidden: true },
        NOW,
      ),
    ).toEqual({ allow: false, reason: "hidden" });
  });
});

describe("step-up (requirement 6.10)", () => {
  const control: Requirement = { minRole: "admin", hidden: true, stepUp: true };

  it("requires a recent step-up", () => {
    expect(decide(user("admin", { stepUpAt: null }), control, NOW)).toEqual({
      allow: false,
      reason: "step-up-required",
    });
    expect(
      decide(user("admin", { stepUpAt: NOW - 10 * 60_000 }), control, NOW),
    ).toEqual({ allow: false, reason: "step-up-required" });
    expect(
      decide(user("admin", { stepUpAt: NOW - 9 * 60_000 }), control, NOW).allow,
    ).toBe(true);
  });
});

describe("the policy tables", () => {
  it("cover every Next.js route", () => {
    const paths = new Set(PAGE_POLICY.map((p) => p.path));
    for (const route of ROUTE_PATHS) expect(paths.has(route)).toBe(true);
  });

  it("make /control hidden, administrator-only and step-up", () => {
    expect(policyForPage("/control")).toMatchObject({
      minRole: "admin",
      hidden: true,
      stepUp: true,
    });
  });

  it("require a signed-in role for the workspace modules and keep the public pages public", () => {
    expect(policyForPage("/command").minRole).toBe("viewer");
    expect(policyForPage("/ai").minRole).toBe("member");
    expect(policyForPage("/shield").minRole).toBe("operator");
    expect(policyForPage("/").minRole).toBeNull();
    expect(policyForPage("/status").minRole).toBeNull();
    expect(policyForPage("/signin").minRole).toBeNull();
    expect(policyForPage("/design").minRole).toBe("viewer");
  });

  it("refuse an unknown page path", () => {
    expect(() => policyForPage("/nope")).toThrow();
  });

  it("name every handler and action once, with a minimum role", () => {
    const ids = [...HANDLER_POLICY, ...ACTION_POLICY].map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const p of [...HANDLER_POLICY, ...ACTION_POLICY]) {
      expect(p).toHaveProperty("minRole");
    }
  });

  it("send every Control action through admin and step-up", () => {
    const control = ACTION_POLICY.filter((a) => a.id.startsWith("control."));
    expect(control.length).toBeGreaterThan(0);
    for (const a of control) {
      expect(a.minRole).toBe("admin");
      expect(a.stepUp).toBe(true);
    }
  });
});
