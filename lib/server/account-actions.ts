"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { USER_REQUEST_CATEGORIES } from "@/lib/fixtures/account";
import { parsePublicKey } from "@/lib/transfer/keys";
import { QUOTA_MB_MAX, QUOTA_MB_MIN } from "@/lib/transfer/validation";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import {
  cancelUserRequest,
  changeOwnPassword,
  createUserRequest,
  resolveIdentity,
  revokeOtherSessions,
  writeUserProfileMeta,
} from "@/lib/server/auth/service";
import {
  MESSAGES,
  type CancelUserRequestState,
  type ChangeOwnPasswordState,
  type RevokeOtherSessionsState,
  type SubmitUserRequestState,
  type UpdateProfileState,
} from "@/lib/server/auth/form-state";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";

function revalidateAccount() {
  revalidatePath("/account");
  revalidatePath("/command");
  revalidatePath("/control");
  revalidatePath("/control/users");
}

const boolFlag = z.preprocess(
  (v) => v === "true" || v === "on" || v === true,
  z.boolean(),
);

// ---- Update own profile -------------------------------------------------------------

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  jobTitle: z.string().trim().max(120).default(""),
  department: z.string().trim().max(120).default(""),
  phone: z.string().trim().max(40).default(""),
  sshPublicKey: z
    .string()
    .trim()
    .max(4096)
    .default("")
    .refine((val) => val === "" || parsePublicKey(val) !== null, {
      message: "invalid-ssh-key",
    }),
  bio: z.string().trim().max(600).default(""),
});

const updateProfile = guardAction(
  {
    id: "account.update-profile",
    schema: updateProfileSchema,
    target: (_i) => "profile:self",
  },
  async (input, ctx) => {
    if (getMode() === "demo") {
      return { ok: false as const, error: "demo" as const };
    }
    if (ctx.identity.kind !== "user") {
      return { ok: false as const, error: "unauthenticated" as const };
    }
    const rt = getAuthRuntime();
    await writeUserProfileMeta(rt, ctx.identity.userId, input);
    revalidateAccount();
    return { ok: true as const, name: input.name };
  },
);

export async function updateProfileAction(
  _previous: UpdateProfileState,
  formData: FormData,
): Promise<UpdateProfileState> {
  const result = await updateProfile({
    name: formData.get("name") ?? "",
    jobTitle: formData.get("jobTitle") ?? "",
    department: formData.get("department") ?? "",
    phone: formData.get("phone") ?? "",
    sshPublicKey: formData.get("sshPublicKey") ?? "",
    bio: formData.get("bio") ?? "",
  });
  if (result.ok) return { done: true, name: result.name };
  switch (result.error) {
    case "demo":
      return { error: MESSAGES.demo };
    case "invalid-input":
      return {
        error:
          "Check your profile fields (OpenSSH key must start with ssh-ed25519, ssh-rsa, or ecdsa-sha2-*).",
      };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

// ---- Change own password ------------------------------------------------------------

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(1).max(128),
  confirmPassword: z.string().min(1).max(128),
  revokeOthers: boolFlag.optional(),
});

const changePasswordGuard = guardAction(
  {
    id: "account.change-password",
    schema: changeOwnPasswordSchema,
    target: () => "password:self",
  },
  async (input, ctx) => {
    if (getMode() === "demo") {
      return { ok: false as const, error: "demo" as const };
    }
    if (ctx.identity.kind !== "user") {
      return { ok: false as const, error: "unauthenticated" as const };
    }
    if (input.newPassword.length < 12) {
      return { ok: false as const, error: "too-short" as const };
    }
    if (input.newPassword !== input.confirmPassword) {
      return { ok: false as const, error: "mismatch" as const };
    }
    const rt = getAuthRuntime();
    const requestHeaders = await headers();
    const resolved = await resolveIdentity(rt, requestHeaders).catch(() => ({
      session: null,
    }));
    const currentSessionId = resolved.session?.id ?? null;

    const outcome = await changeOwnPassword(
      rt,
      ctx.identity.userId,
      input.currentPassword,
      input.newPassword,
      {
        revokeOthers: Boolean(input.revokeOthers),
        currentSessionId,
      },
    );
    if (!outcome.ok) {
      return { ok: false as const, error: outcome.reason };
    }
    revalidateAccount();
    return {
      ok: true as const,
      revokedOthers: Boolean(input.revokeOthers),
    };
  },
);

export async function changeOwnPasswordAction(
  _previous: ChangeOwnPasswordState,
  formData: FormData,
): Promise<ChangeOwnPasswordState> {
  const result = await changePasswordGuard({
    currentPassword: formData.get("currentPassword") ?? "",
    newPassword: formData.get("newPassword") ?? "",
    confirmPassword: formData.get("confirmPassword") ?? "",
    revokeOthers: formData.get("revokeOthers") ?? undefined,
  });
  if (result.ok) return { done: true, revokedOthers: result.revokedOthers };
  switch (result.error) {
    case "demo":
      return { error: MESSAGES.demo };
    case "too-short":
      return { error: MESSAGES.passwordTooShort };
    case "mismatch":
      return { error: MESSAGES.passwordMismatch };
    case "invalid-password":
      return { error: MESSAGES.wrongCurrentPassword };
    case "locked":
      return { error: MESSAGES.locked };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

// ---- Revoke other sessions ----------------------------------------------------------

const revokeOthersGuard = guardAction(
  {
    id: "account.revoke-other-sessions",
    schema: z.object({}),
    target: () => "sessions:others",
  },
  async (_input, ctx) => {
    if (getMode() === "demo") {
      return { ok: false as const, error: "demo" as const };
    }
    if (ctx.identity.kind !== "user") {
      return { ok: false as const, error: "unauthenticated" as const };
    }
    const rt = getAuthRuntime();
    const requestHeaders = await headers();
    const resolved = await resolveIdentity(rt, requestHeaders).catch(() => ({
      session: null,
    }));
    const currentSessionId = resolved.session?.id ?? null;
    const revokedCount = await revokeOtherSessions(
      rt,
      ctx.identity.userId,
      currentSessionId,
    );
    revalidateAccount();
    return { ok: true as const, revokedCount };
  },
);

export async function revokeOtherSessionsAction(
  _previous: RevokeOtherSessionsState,
  _formData: FormData,
): Promise<RevokeOtherSessionsState> {
  const result = await revokeOthersGuard({});
  if (result.ok) return { done: true, revokedCount: result.revokedCount };
  switch (result.error) {
    case "demo":
      return { error: MESSAGES.demo };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

// ---- Submit service or access request -----------------------------------------------

const submitRequestSchema = z
  .object({
    category: z.enum(USER_REQUEST_CATEGORIES),
    title: z.string().trim().min(3).max(160),
    requestedRole: z.enum(["member", "operator", "admin"]).optional(),
    requestedQuotaMb: z.coerce
      .number()
      .int()
      .min(QUOTA_MB_MIN)
      .max(QUOTA_MB_MAX)
      .optional(),
    sshPublicKey: z.string().trim().max(4096).optional(),
    reason: z.string().trim().min(5).max(800),
  })
  .superRefine((val, ctx) => {
    if (val.category === "sftp-key") {
      if (!val.sshPublicKey || parsePublicKey(val.sshPublicKey) === null) {
        ctx.addIssue({
          code: "custom",
          path: ["sshPublicKey"],
          message: "Provide a valid OpenSSH public key.",
        });
      }
    }
    if (
      (val.category === "sftp-quota" || val.category === "mail-quota") &&
      val.requestedQuotaMb === undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedQuotaMb"],
        message: "Specify the requested quota in MiB.",
      });
    }
    if (val.category === "role-upgrade" && !val.requestedRole) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedRole"],
        message: "Select the target role.",
      });
    }
  });

const submitRequestGuard = guardAction(
  {
    id: "account.submit-request",
    schema: submitRequestSchema,
    target: (i) => `request:${i.category}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo") {
      return { ok: false as const, error: "demo" as const };
    }
    if (ctx.identity.kind !== "user") {
      return { ok: false as const, error: "unauthenticated" as const };
    }
    const rt = getAuthRuntime();
    const { id } = await createUserRequest(rt, {
      userId: ctx.identity.userId,
      category: input.category,
      title: input.title,
      ...(input.requestedRole ? { requestedRole: input.requestedRole } : {}),
      ...(input.requestedQuotaMb !== undefined
        ? { requestedQuotaMb: input.requestedQuotaMb }
        : {}),
      ...(input.sshPublicKey ? { sshPublicKey: input.sshPublicKey } : {}),
      reason: input.reason,
    });
    revalidateAccount();
    return { ok: true as const, requestId: id, title: input.title };
  },
);

export async function submitUserRequestAction(
  _previous: SubmitUserRequestState,
  formData: FormData,
): Promise<SubmitUserRequestState> {
  const rawRole = formData.get("requestedRole");
  const rawQuota = formData.get("requestedQuotaMb");
  const rawKey = formData.get("sshPublicKey");
  const result = await submitRequestGuard({
    category: formData.get("category") ?? undefined,
    title: formData.get("title") ?? "",
    requestedRole: typeof rawRole === "string" && rawRole ? rawRole : undefined,
    requestedQuotaMb:
      typeof rawQuota === "string" && rawQuota.trim() ? rawQuota : undefined,
    sshPublicKey:
      typeof rawKey === "string" && rawKey.trim() ? rawKey : undefined,
    reason: formData.get("reason") ?? "",
  });
  if (result.ok) {
    return { done: true, requestId: result.requestId, title: result.title };
  }
  switch (result.error) {
    case "demo":
      return { error: MESSAGES.demo };
    case "invalid-input":
      return {
        error:
          "Please fill in a summary title, clear justification (at least 5 characters), and valid category details.",
      };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

// ---- Cancel pending request ---------------------------------------------------------

const cancelRequestSchema = z.object({
  requestId: z.string().trim().min(4).max(64),
});

const cancelRequestGuard = guardAction(
  {
    id: "account.cancel-request",
    schema: cancelRequestSchema,
    target: (i) => `request:${i.requestId}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo") {
      return { ok: false as const, error: "demo" as const };
    }
    if (ctx.identity.kind !== "user") {
      return { ok: false as const, error: "unauthenticated" as const };
    }
    const rt = getAuthRuntime();
    const cancelled = await cancelUserRequest(
      rt,
      ctx.identity.userId,
      input.requestId,
    );
    if (!cancelled) {
      return { ok: false as const, error: "not-found" as const };
    }
    revalidateAccount();
    return { ok: true as const, requestId: input.requestId };
  },
);

export async function cancelUserRequestAction(
  _previous: CancelUserRequestState,
  formData: FormData,
): Promise<CancelUserRequestState> {
  const result = await cancelRequestGuard({
    requestId: formData.get("requestId") ?? "",
  });
  if (result.ok) return { done: true, requestId: result.requestId };
  switch (result.error) {
    case "demo":
      return { error: MESSAGES.demo };
    case "not-found":
      return { error: MESSAGES.requestNotFound };
    default:
      return { error: MESSAGES.genericFailure };
  }
}
