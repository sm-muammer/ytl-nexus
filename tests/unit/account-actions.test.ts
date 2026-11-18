// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/server/db/audit";
import type { Identity } from "@/lib/server/policy";

const events: AuditEventInput[] = [];
let identity: Identity;

const mockWriteProfile = vi.fn(async () => ({
  jobTitle: "Network Engineer",
  department: "Infrastructure",
  phone: "+60 3-2099 8812",
  sshPublicKey: "",
  bio: "Updated bio",
  updatedAt: new Date().toISOString(),
}));
const mockChangePassword = vi.fn<
  () => Promise<
    | { ok: true }
    | { ok: false; reason: "invalid-password" | "locked" | "no-credential" }
  >
>(async () => ({ ok: true }));
const mockRevokeOtherSessions = vi.fn(async () => 2);
const mockCreateUserRequest = vi.fn(async () => ({ id: "req-12345678" }));
const mockCancelUserRequest = vi.fn(
  async (_rt: unknown, _uid: string, reqId: string) => reqId === "req-pending",
);

vi.mock("@/lib/server/auth/runtime", () => ({
  getAuthRuntime: () => ({
    audit: async () => {},
  }),
}));

vi.mock("@/lib/server/auth/service", () => ({
  writeUserProfileMeta: mockWriteProfile,
  changeOwnPassword: mockChangePassword,
  resolveIdentity: async () => ({
    identity,
    session: {
      id: "sess-current",
      userId: "user-member",
      email: "member@example.com",
      name: "Member",
    },
  }),
  revokeOtherSessions: mockRevokeOtherSessions,
  createUserRequest: mockCreateUserRequest,
  cancelUserRequest: mockCancelUserRequest,
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
    sourceIp: async () => "10.26.64.25",
    audit: async (e) => {
      if (process.env.NEXUS_MODE === "demo") return;
      events.push(e);
    },
    nav,
  });
});

describe("Self-Service Account & Requests Actions", () => {
  beforeEach(() => {
    events.length = 0;
    vi.clearAllMocks();
    process.env.NEXUS_MODE = "live";
    identity = {
      kind: "user",
      userId: "user-member",
      role: "member",
      twoFactorEnabled: false,
      stepUpAt: null,
    };
  });

  afterEach(() => {
    delete process.env.NEXUS_MODE;
  });

  it("refuses visitors from updating profile or submitting requests", async () => {
    const actions = await import("@/lib/server/account-actions");
    identity = { kind: "visitor" };

    const profileForm = new FormData();
    profileForm.set("name", "Visitor Hack");
    const res1 = await actions.updateProfileAction(null, profileForm);
    expect(res1).toHaveProperty("error");
    expect(mockWriteProfile).not.toHaveBeenCalled();

    const reqForm = new FormData();
    reqForm.set("category", "general");
    reqForm.set("title", "Help");
    reqForm.set("reason", "Need access");
    const res2 = await actions.submitUserRequestAction(null, reqForm);
    expect(res2).toHaveProperty("error");
    expect(mockCreateUserRequest).not.toHaveBeenCalled();
  });

  it("refuses mutations cleanly in demo mode without auditing", async () => {
    process.env.NEXUS_MODE = "demo";
    const actions = await import("@/lib/server/account-actions");
    const form = new FormData();
    form.set("name", "Updated Member");
    const res = await actions.updateProfileAction(null, form);
    expect(res).toEqual({
      error: "This is a demo session. Nothing was changed.",
    });
    expect(mockWriteProfile).not.toHaveBeenCalled();
    expect(events).toHaveLength(0);
  });

  it("lets a Member edit their own profile and audits once", async () => {
    const actions = await import("@/lib/server/account-actions");
    const form = new FormData();
    form.set("name", "Azlin Ahmad");
    form.set("jobTitle", "Systems Engineer");
    form.set("department", "IT Infrastructure");
    form.set("phone", "+60 3-2099 1000");
    form.set(
      "sshPublicKey",
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl azlin@laptop",
    );
    form.set("bio", "Maintains storage & routing.");

    const result = await actions.updateProfileAction(null, form);
    expect(result).toEqual({ done: true, name: "Azlin Ahmad" });
    expect(mockWriteProfile).toHaveBeenCalledTimes(1);
    expect(events).toEqual([
      expect.objectContaining({
        actorId: "user-member",
        action: "account.update-profile",
        target: "profile:self",
        result: "success",
      }),
    ]);
  });

  it("rejects malformed OpenSSH keys in profile updates", async () => {
    const actions = await import("@/lib/server/account-actions");
    const form = new FormData();
    form.set("name", "Azlin Ahmad");
    form.set("sshPublicKey", "not-a-valid-ssh-key");

    const result = await actions.updateProfileAction(null, form);
    expect(result).toHaveProperty("error");
    expect(mockWriteProfile).not.toHaveBeenCalled();
    expect(events[0]).toMatchObject({ result: "refused" });
  });

  it("changes own password with confirmation check and handles invalid current password", async () => {
    const actions = await import("@/lib/server/account-actions");

    const mismatch = new FormData();
    mismatch.set("currentPassword", "old-password-123");
    mismatch.set("newPassword", "new-strong-password-123");
    mismatch.set("confirmPassword", "different-password-123");
    expect(await actions.changeOwnPasswordAction(null, mismatch)).toEqual({
      error: "New password and confirmation do not match.",
    });
    expect(mockChangePassword).not.toHaveBeenCalled();

    events.length = 0;
    mockChangePassword.mockResolvedValueOnce({
      ok: false,
      reason: "invalid-password",
    });
    const badCurrent = new FormData();
    badCurrent.set("currentPassword", "wrong-current-pass");
    badCurrent.set("newPassword", "new-strong-password-123");
    badCurrent.set("confirmPassword", "new-strong-password-123");
    expect(await actions.changeOwnPasswordAction(null, badCurrent)).toEqual({
      error: "Your current password is not correct.",
    });

    events.length = 0;
    const valid = new FormData();
    valid.set("currentPassword", "old-password-123");
    valid.set("newPassword", "new-strong-password-123");
    valid.set("confirmPassword", "new-strong-password-123");
    valid.set("revokeOthers", "true");
    expect(await actions.changeOwnPasswordAction(null, valid)).toEqual({
      done: true,
      revokedOthers: true,
    });
    expect(events[0]).toMatchObject({
      action: "account.change-password",
      result: "success",
    });
  });

  it("revokes all other sessions for Operator or Member", async () => {
    identity = {
      kind: "user",
      userId: "user-operator",
      role: "operator",
      twoFactorEnabled: true,
      stepUpAt: null,
    };
    const actions = await import("@/lib/server/account-actions");
    const res = await actions.revokeOtherSessionsAction(null, new FormData());
    expect(res).toEqual({ done: true, revokedCount: 2 });
    expect(mockRevokeOtherSessions).toHaveBeenCalledTimes(1);
    expect(events[0]).toMatchObject({
      actorId: "user-operator",
      action: "account.revoke-other-sessions",
      result: "success",
    });
  });

  it("submits category-specific service requests for Operators and Members", async () => {
    identity = {
      kind: "user",
      userId: "user-operator",
      role: "operator",
      twoFactorEnabled: false,
      stepUpAt: null,
    };
    const actions = await import("@/lib/server/account-actions");

    // SFTP quota request requires requestedQuotaMb
    const missingQuota = new FormData();
    missingQuota.set("category", "sftp-quota");
    missingQuota.set("title", "Increase quota");
    missingQuota.set("reason", "Need extra space for database backups.");
    expect(
      await actions.submitUserRequestAction(null, missingQuota),
    ).toHaveProperty("error");

    events.length = 0;
    const okQuota = new FormData();
    okQuota.set("category", "sftp-quota");
    okQuota.set("title", "Expand SFTP storage to 8 GiB");
    okQuota.set("requestedQuotaMb", "8192");
    okQuota.set("reason", "Storing weekly Continuity scratch test archives.");
    const okRes = await actions.submitUserRequestAction(null, okQuota);
    expect(okRes).toEqual({
      done: true,
      requestId: "req-12345678",
      title: "Expand SFTP storage to 8 GiB",
    });
    expect(events[0]).toMatchObject({
      action: "account.submit-request",
      target: "request:sftp-quota",
      result: "success",
    });
  });

  it("allows cancelling an owned pending request and refuses missing requests", async () => {
    const actions = await import("@/lib/server/account-actions");

    const okForm = new FormData();
    okForm.set("requestId", "req-pending");
    expect(await actions.cancelUserRequestAction(null, okForm)).toEqual({
      done: true,
      requestId: "req-pending",
    });

    const missingForm = new FormData();
    missingForm.set("requestId", "req-other");
    expect(await actions.cancelUserRequestAction(null, missingForm)).toEqual({
      error: "That request no longer exists or is already resolved.",
    });
  });
});
