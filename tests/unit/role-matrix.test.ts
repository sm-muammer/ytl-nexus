// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  decide,
  PAGE_POLICY,
  policyForPage,
  type Identity,
} from "@/lib/server/policy";

// Requirements CTL-01, IAM-05, IAM-06:
// Role matrix validation across all registered platform routes for all five identity types.

const now = Date.now();

const visitor: Identity = { kind: "visitor" };

const viewer: Identity = {
  kind: "user",
  userId: "viewer-1",
  role: "viewer",
  twoFactorEnabled: false,
  stepUpAt: null,
};

const member: Identity = {
  kind: "user",
  userId: "member-1",
  role: "member",
  twoFactorEnabled: false,
  stepUpAt: null,
};

const operatorWithout2FA: Identity = {
  kind: "user",
  userId: "op-1",
  role: "operator",
  twoFactorEnabled: false,
  stepUpAt: null,
};

const operatorWith2FA: Identity = {
  kind: "user",
  userId: "op-2",
  role: "operator",
  twoFactorEnabled: true,
  stepUpAt: null,
};

const adminStaleStepUp: Identity = {
  kind: "user",
  userId: "admin-1",
  role: "admin",
  twoFactorEnabled: true,
  stepUpAt: now - 15 * 60 * 1000, // 15 mins ago (stale > 10m)
};

const adminFreshStepUp: Identity = {
  kind: "user",
  userId: "admin-2",
  role: "admin",
  twoFactorEnabled: true,
  stepUpAt: now - 2 * 60 * 1000, // 2 mins ago (fresh < 10m)
};

describe("Role Matrix Access Across All Module Pages", () => {
  it("allows visitors to public pages only", () => {
    for (const p of PAGE_POLICY) {
      const decision = decide(visitor, p, now);
      if (p.minRole === null) {
        expect(decision, `${p.path} should be accessible to visitor`).toEqual({
          allow: true,
        });
      } else {
        expect(decision.allow, `${p.path} should reject visitor`).toBe(false);
      }
    }
  });

  it("allows viewers to explore & view routes but denies member/operator/admin areas", () => {
    expect(decide(viewer, policyForPage("/command"), now)).toEqual({
      allow: true,
    });
    expect(decide(viewer, policyForPage("/data"), now)).toEqual({
      allow: true,
    });
    expect(decide(viewer, policyForPage("/ai"), now).allow).toBe(false);
    expect(decide(viewer, policyForPage("/transfer"), now).allow).toBe(false);
    expect(decide(viewer, policyForPage("/continuity"), now).allow).toBe(false);
    expect(decide(viewer, policyForPage("/shield"), now).allow).toBe(false);
    expect(decide(viewer, policyForPage("/control"), now).allow).toBe(false);
  });

  it("allows members to access transfer, mail and AI", () => {
    expect(decide(member, policyForPage("/ai"), now)).toEqual({ allow: true });
    expect(decide(member, policyForPage("/transfer"), now)).toEqual({
      allow: true,
    });
    expect(decide(member, policyForPage("/mail"), now)).toEqual({
      allow: true,
    });
    expect(decide(member, policyForPage("/continuity"), now).allow).toBe(false);
    expect(decide(member, policyForPage("/shield"), now).allow).toBe(false);
  });

  it("requires 2FA enrolment for operators before accessing workspace modules", () => {
    // Unenrolled operator redirected/refused on workspace
    expect(
      decide(operatorWithout2FA, policyForPage("/continuity"), now),
    ).toEqual({
      allow: false,
      reason: "two-factor-enrolment",
    });
    expect(decide(operatorWithout2FA, policyForPage("/shield"), now)).toEqual({
      allow: false,
      reason: "two-factor-enrolment",
    });

    // Enrolled operator permitted
    expect(decide(operatorWith2FA, policyForPage("/continuity"), now)).toEqual({
      allow: true,
    });
    expect(decide(operatorWith2FA, policyForPage("/shield"), now)).toEqual({
      allow: true,
    });
  });

  it("protects /control: hidden to non-admins, requires fresh Step_Up for admins", () => {
    const controlPolicy = policyForPage("/control");

    // Hidden to visitors, viewers, members, operators
    expect(decide(visitor, controlPolicy, now)).toEqual({
      allow: false,
      reason: "hidden",
    });
    expect(decide(viewer, controlPolicy, now)).toEqual({
      allow: false,
      reason: "hidden",
    });
    expect(decide(operatorWith2FA, controlPolicy, now)).toEqual({
      allow: false,
      reason: "hidden",
    });

    // Admin with stale step-up requires step-up
    expect(decide(adminStaleStepUp, controlPolicy, now)).toEqual({
      allow: false,
      reason: "step-up-required",
    });

    // Admin with fresh step-up (<10m) is allowed in
    expect(decide(adminFreshStepUp, controlPolicy, now)).toEqual({
      allow: true,
    });
  });
});
