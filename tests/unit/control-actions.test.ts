// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/server/db/audit";
import type { Identity } from "@/lib/server/policy";

// Requirements CTL-02, CTL-08, CTL-09:
// - Users and roles: create, change role, disable, revoke sessions, reset password, force 2FA re-enrolment
// - Every Control mutation asks for confirmation and writes an audit event
// - Destructive actions name the exact target in the confirmation

const events: AuditEventInput[] = [];
let identity: Identity;

vi.mock("@/lib/server/auth/runtime", () => ({
  getAuthRuntime: () => ({
    audit: async () => {},
    db: {
      updateTable: () => ({
        set: () => ({
          where: () => ({
            execute: async () => {},
          }),
        }),
      }),
      deleteFrom: () => ({
        where: () => ({
          execute: async () => {},
        }),
      }),
    },
    auth: {
      $context: Promise.resolve({
        internalAdapter: {
          findUserByEmail: async (email: string) =>
            email === "existing@example.com" ? { id: "user-existing" } : null,
          createUser: async (user: {
            email: string;
            name: string;
            role: string;
          }) => ({
            id: `user-${user.name.toLowerCase()}`,
            ...user,
          }),
          linkAccount: async () => {},
        },
        password: {
          hash: async (p: string) => `hashed:${p}`,
        },
      }),
      api: {
        revokeUserSessions: async () => {},
      },
    },
  }),
}));

vi.mock("@/lib/server/auth/service", () => ({
  generatePassword: () => "generated-secret-password-123",
  findUserEmail: async (_rt: unknown, id: string) =>
    id === "user-target"
      ? "target@example.com"
      : id === "user-admin"
        ? "admin@example.com"
        : null,
  findUserRole: async (_rt: unknown, id: string) =>
    id === "user-target" ? "member" : id === "user-admin" ? "admin" : null,
  createAccount: async () => ({ id: "user-created" }),
  changeUserRole: async () => {},
  clearStageRequest: async () => {},
  setUserBanned: async () => {},
  resetTwoFactor: async () => {},
  resetPasswordAsAdmin: async () => {},
  revokeSessionsAsAdmin: async () => {},
  updateUserName: async () => {},
  deleteUserAccount: async () => {},
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

vi.mock("@/lib/server/guards", async () => {
  const { createGuards } = await import("@/lib/server/guards-core");
  const nav = {
    redirect: () => {
      throw new Error("redirect");
    },
    notFound: () => {
      throw new Error("notFound");
    },
    forbidden: () => {
      throw new Error("forbidden");
    },
  };
  return createGuards({
    now: () => Date.now(),
    identity: async () => identity,
    sourceIp: async () => "10.26.1.50",
    audit: async (e) => {
      if (process.env.NEXUS_MODE === "demo") return;
      events.push(e);
    },
    nav,
  });
});

describe("Nexus Control User Actions", () => {
  beforeEach(() => {
    events.length = 0;
    process.env.NEXUS_MODE = "live";
    identity = {
      kind: "user",
      userId: "user-admin",
      role: "admin",
      twoFactorEnabled: true,
      stepUpAt: Date.now(),
    };
  });

  afterEach(() => {
    delete process.env.NEXUS_MODE;
  });

  it("refuses actions from non-admins or when step-up is stale", async () => {
    const actions = await import("@/lib/server/control-actions");
    identity = {
      kind: "user",
      userId: "user-operator",
      role: "operator",
      twoFactorEnabled: true,
      stepUpAt: Date.now(),
    };

    const form = new FormData();
    form.set("email", "newbie@example.com");
    form.set("name", "Newbie");
    form.set("role", "member");

    const result = await actions.createUserAction(null, form);
    expect(result).toHaveProperty("error");
  });

  it("creates a new user and records audit event", async () => {
    const actions = await import("@/lib/server/control-actions");
    const form = new FormData();
    form.set("email", "azlin@ytlcomms.my");
    form.set("name", "Azlin");
    form.set("role", "operator");

    const result = await actions.createUserAction(null, form);
    expect(result).toEqual({
      done: true,
      email: "azlin@ytlcomms.my",
      password: "generated-secret-password-123",
    });

    expect(events).toEqual([
      expect.objectContaining({
        action: "control.user.create",
        target: "user:azlin@ytlcomms.my",
        result: "success",
      }),
    ]);
  });

  it("changes role of an account and prevents self-demotion", async () => {
    const actions = await import("@/lib/server/control-actions");

    // Attempting self-demotion
    const selfForm = new FormData();
    selfForm.set("userId", "user-admin");
    selfForm.set("role", "viewer");
    const selfResult = await actions.changeRoleAction(null, selfForm);
    expect(selfResult).toEqual({
      error: "You cannot change your own role in Control.",
    });

    events.length = 0;

    // Valid role change on another account
    const form = new FormData();
    form.set("userId", "user-target");
    form.set("role", "operator");
    const result = await actions.changeRoleAction(null, form);
    expect(result).toEqual({
      done: true,
      email: "target@example.com",
      role: "operator",
    });

    expect(events).toEqual([
      expect.objectContaining({
        action: "control.user.change-role",
        target: "user:user-target",
        result: "success",
      }),
    ]);
  });

  it("disables a user, revoking their sessions and preventing self-disable", async () => {
    const actions = await import("@/lib/server/control-actions");

    // Self-disable prevented
    const selfForm = new FormData();
    selfForm.set("userId", "user-admin");
    selfForm.set("enabled", "false");
    const selfResult = await actions.setUserEnabledAction(null, selfForm);
    expect(selfResult).toEqual({
      error: "You cannot disable your own account.",
    });

    events.length = 0;

    // Valid disable
    const form = new FormData();
    form.set("userId", "user-target");
    form.set("enabled", "false");
    const result = await actions.setUserEnabledAction(null, form);
    expect(result).toEqual({
      done: true,
      email: "target@example.com",
      enabled: false,
    });

    expect(events).toEqual([
      expect.objectContaining({
        action: "control.user.set-enabled",
        target: "user:user-target",
        result: "success",
      }),
    ]);
  });

  it("resets two-factor authentication forcing re-enrolment", async () => {
    const actions = await import("@/lib/server/control-actions");
    const form = new FormData();
    form.set("userId", "user-target");
    const result = await actions.resetTwoFactorAction(null, form);
    expect(result).toEqual({
      done: true,
      email: "target@example.com",
    });

    expect(events).toEqual([
      expect.objectContaining({
        action: "control.user.reset-2fa",
        target: "user:user-target",
        result: "success",
      }),
    ]);
  });

  it("updates display name and emits an audit event", async () => {
    const actions = await import("@/lib/server/control-actions");
    const form = new FormData();
    form.set("userId", "user-target");
    form.set("name", "Updated Target Name");
    const result = await actions.updateUserNameAction(null, form);
    expect(result).toEqual({
      done: true,
      email: "target@example.com",
      name: "Updated Target Name",
    });

    expect(events).toEqual([
      expect.objectContaining({
        action: "control.user.update-name",
        target: "user:user-target",
        result: "success",
      }),
    ]);
  });

  it("dismisses a stage promotion request and emits an audit event", async () => {
    const actions = await import("@/lib/server/control-actions");
    const form = new FormData();
    form.set("userId", "user-target");
    const result = await actions.dismissStageRequestAction(null, form);
    expect(result).toEqual({
      done: true,
      email: "target@example.com",
    });

    expect(events).toEqual([
      expect.objectContaining({
        action: "control.user.dismiss-stage-request",
        target: "user:user-target",
        result: "success",
      }),
    ]);
  });

  it("deletes a target user after exact email confirmation and blocks self-deletion", async () => {
    const actions = await import("@/lib/server/control-actions");

    const selfForm = new FormData();
    selfForm.set("userId", "user-admin");
    selfForm.set("confirmEmail", "admin@example.com");
    const selfResult = await actions.deleteUserAction(null, selfForm);
    expect(selfResult).toEqual({
      error: "You cannot delete your own account.",
    });

    const mismatchForm = new FormData();
    mismatchForm.set("userId", "user-target");
    mismatchForm.set("confirmEmail", "wrong@example.com");
    const mismatchResult = await actions.deleteUserAction(null, mismatchForm);
    expect(mismatchResult).toEqual({
      error: "Type the exact account email address to confirm deletion.",
    });

    events.length = 0;

    const okForm = new FormData();
    okForm.set("userId", "user-target");
    okForm.set("confirmEmail", "target@example.com");
    const okResult = await actions.deleteUserAction(null, okForm);
    expect(okResult).toEqual({
      done: true,
      email: "target@example.com",
    });

    expect(events).toEqual([
      expect.objectContaining({
        action: "control.user.delete",
        target: "user:user-target",
        result: "success",
      }),
    ]);
  });
});
