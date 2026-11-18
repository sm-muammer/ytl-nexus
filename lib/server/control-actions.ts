"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { ROLES, type Role } from "@/lib/roles";
import {
  generatePassword,
  findUserEmail,
  resetPasswordAsAdmin,
  revokeSessionsAsAdmin,
  changeUserRole,
  clearStageRequest,
  setUserBanned,
  resetTwoFactor as resetUserTwoFactor,
  createAccount,
  updateUserName,
  deleteUserAccount,
} from "@/lib/server/auth/service";
import {
  MESSAGES,
  type CreateUserState,
  type ChangeRoleState,
  type SetUserEnabledState,
  type ResetTwoFactorState,
  type ResetPasswordState,
  type RevokeSessionsState,
  type UpdateUserNameState,
  type DismissStageRequestState,
  type DeleteUserState,
} from "@/lib/server/auth/form-state";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { createSftpgoClient, readSftpgoConfig } from "@/lib/server/sftpgo";
import { usernameSchema } from "@/lib/transfer/validation";
import { createMailDb, readMailDbConfig } from "@/lib/server/mail-db";
import { hashMailPassword } from "@/lib/mail/sha512-crypt";
import {
  MAIL_DOMAIN,
  QUOTA_MB_MAX as MAIL_QUOTA_MB_MAX,
  localPartSchema,
} from "@/lib/mail";

// Nexus Control user actions (requirements CTL-02, CTL-08, CTL-09).
// Each is an Administrator-only Server Function that requires a fresh Step_Up,
// validates its input, and writes an audit event.

const MB = 1024 * 1024;

function revalidateControl() {
  revalidatePath("/control");
  revalidatePath("/control/users");
}

function deriveSubsystemHandle(email: string): string {
  const local = email.split("@")[0]?.toLowerCase() ?? "user";
  let clean = local.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z]/.test(clean)) clean = `u-${clean}`;
  if (clean.length < 3) clean = `${clean}000`.slice(0, 3);
  return clean.slice(0, 32);
}

const target = z.object({ userId: z.string().min(1).max(64) });
const userForm = (data: FormData) => ({
  userId: data.get("userId") ?? undefined,
});

const boolFlag = z.preprocess(
  (v) => v === "true" || v === "on" || v === true,
  z.boolean(),
);

const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
  provisionTransfer: boolFlag.optional(),
  provisionMail: boolFlag.optional(),
  quotaMb: z.coerce.number().int().min(64).max(20480).optional(),
});

const createUser = guardAction(
  {
    id: "control.user.create",
    schema: createUserSchema,
    target: (i) => `user:${i.email.toLowerCase()}`,
  },
  async (input) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    const rt = getAuthRuntime();
    const email = input.email.toLowerCase();
    const password = generatePassword();
    let createdId: string;
    try {
      const created = await createAccount(rt, {
        email,
        name: input.name,
        role: input.role,
        password,
      });
      createdId = created.id;
    } catch {
      return { ok: false as const, error: "email-exists" as const };
    }

    const quotaMb = input.quotaMb ?? 1024;
    const handle = deriveSubsystemHandle(email);
    let transferUsername: string | null = null;
    let mailboxAddress: string | null = null;

    if (input.provisionTransfer) {
      const sftpgoConfig = readSftpgoConfig();
      const parsedHandle = usernameSchema.safeParse(handle);
      if (sftpgoConfig && parsedHandle.success) {
        try {
          const client = createSftpgoClient(sftpgoConfig);
          await client.createAccount({
            username: parsedHandle.data,
            password,
            nexusUserId: createdId,
            quotaBytes: quotaMb * MB,
            email,
          });
          transferUsername = parsedHandle.data;
        } catch {
          // Best-effort subsystem provisioning; primary account is created.
        }
      }
    }

    if (input.provisionMail) {
      const mailConfig = readMailDbConfig();
      const parsedLocal = localPartSchema.safeParse(handle);
      if (mailConfig && parsedLocal.success) {
        const db = createMailDb(mailConfig);
        try {
          const domain = await db
            .selectFrom("virtual_domains")
            .select("id")
            .where("name", "=", MAIL_DOMAIN)
            .executeTakeFirst();
          if (domain) {
            const existing = await db
              .selectFrom("virtual_users")
              .select("id")
              .where("domain_id", "=", domain.id)
              .where("local_part", "=", parsedLocal.data)
              .executeTakeFirst();
            if (!existing) {
              const address = `${parsedLocal.data}@${MAIL_DOMAIN}`;
              const mailQuota = Math.min(quotaMb, MAIL_QUOTA_MB_MAX) * MB;
              await db
                .insertInto("virtual_users")
                .values({
                  domain_id: domain.id,
                  local_part: parsedLocal.data,
                  email: address,
                  password: hashMailPassword(password),
                  quota_bytes: mailQuota,
                  enabled: 1,
                  nexus_user_id: createdId,
                })
                .execute();
              mailboxAddress = address;
            }
          }
        } catch {
          // Best-effort subsystem provisioning; primary account is created.
        } finally {
          await db.destroy().catch(() => {});
        }
      }
    }

    revalidateControl();
    return {
      ok: true as const,
      email,
      password,
      transferUsername,
      mailboxAddress,
    };
  },
);

export async function createUserAction(
  _previous: CreateUserState,
  formData: FormData,
): Promise<CreateUserState> {
  const result = await createUser({
    email: formData.get("email") ?? undefined,
    name: formData.get("name") ?? undefined,
    role: formData.get("role") ?? undefined,
    provisionTransfer: formData.get("provisionTransfer") ?? undefined,
    provisionMail: formData.get("provisionMail") ?? undefined,
    quotaMb: formData.get("quotaMb") || undefined,
  });
  if (result.ok) {
    return {
      done: true,
      email: result.email,
      password: result.password,
      ...(result.transferUsername
        ? { transferUsername: result.transferUsername }
        : {}),
      ...(result.mailboxAddress
        ? { mailboxAddress: result.mailboxAddress }
        : {}),
    };
  }
  switch (result.error) {
    case "email-exists":
      return { error: MESSAGES.emailExists };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const changeRoleSchema = z.object({
  userId: z.string().min(1).max(64),
  role: z.enum(ROLES),
});

const changeRole = guardAction(
  {
    id: "control.user.change-role",
    schema: changeRoleSchema,
    target: (i) => `user:${i.userId}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    if (ctx.identity.kind === "user" && ctx.owns(input.userId)) {
      return { ok: false as const, error: "self-role" as const };
    }
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    await changeUserRole(rt, input.userId, input.role as Role);
    await clearStageRequest(rt, input.userId);
    revalidateControl();
    return { ok: true as const, email, role: input.role as Role };
  },
);

export async function changeRoleAction(
  _previous: ChangeRoleState,
  formData: FormData,
): Promise<ChangeRoleState> {
  const result = await changeRole({
    userId: formData.get("userId") ?? undefined,
    role: formData.get("role") ?? undefined,
  });
  if (result.ok) return { done: true, email: result.email, role: result.role };
  switch (result.error) {
    case "self-role":
      return { error: MESSAGES.selfRole };
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const setUserEnabledSchema = z.object({
  userId: z.string().min(1).max(64),
  enabled: z.preprocess((v) => v === "true" || v === true, z.boolean()),
});

const setUserEnabled = guardAction(
  {
    id: "control.user.set-enabled",
    schema: setUserEnabledSchema,
    target: (i) => `user:${i.userId}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    if (
      !input.enabled &&
      ctx.identity.kind === "user" &&
      ctx.owns(input.userId)
    ) {
      return { ok: false as const, error: "self-disable" as const };
    }
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    await setUserBanned(rt, await headers(), input.userId, !input.enabled);
    revalidateControl();
    return { ok: true as const, email, enabled: input.enabled };
  },
);

export async function setUserEnabledAction(
  _previous: SetUserEnabledState,
  formData: FormData,
): Promise<SetUserEnabledState> {
  const result = await setUserEnabled({
    userId: formData.get("userId") ?? undefined,
    enabled: formData.get("enabled") ?? undefined,
  });
  if (result.ok)
    return { done: true, email: result.email, enabled: result.enabled };
  switch (result.error) {
    case "self-disable":
      return { error: MESSAGES.selfDisable };
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const resetTwoFactor = guardAction(
  {
    id: "control.user.reset-2fa",
    schema: target,
    target: (i) => `user:${i.userId}`,
  },
  async (input) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    await resetUserTwoFactor(rt, await headers(), input.userId);
    revalidateControl();
    return { ok: true as const, email };
  },
);

export async function resetTwoFactorAction(
  _previous: ResetTwoFactorState,
  formData: FormData,
): Promise<ResetTwoFactorState> {
  const result = await resetTwoFactor(userForm(formData));
  if (result.ok) return { done: true, email: result.email };
  switch (result.error) {
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const resetPassword = guardAction(
  {
    id: "control.user.reset-password",
    schema: target,
    target: (i) => `user:${i.userId}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    if (ctx.identity.kind === "user" && ctx.owns(input.userId)) {
      return { ok: false as const, error: "self" as const };
    }
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    const password = generatePassword();
    await resetPasswordAsAdmin(rt, await headers(), input.userId, password);
    revalidateControl();
    return { ok: true as const, email, password };
  },
);

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const result = await resetPassword(userForm(formData));
  if (result.ok)
    return { done: true, email: result.email, password: result.password };
  switch (result.error) {
    case "self":
      return { error: MESSAGES.self };
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const revokeSessions = guardAction(
  {
    id: "control.user.revoke-sessions",
    schema: target,
    target: (i) => `user:${i.userId}`,
  },
  async (input) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    await revokeSessionsAsAdmin(rt, await headers(), input.userId);
    revalidateControl();
    return { ok: true as const, email };
  },
);

export async function revokeSessionsAction(
  _previous: RevokeSessionsState,
  formData: FormData,
): Promise<RevokeSessionsState> {
  const result = await revokeSessions(userForm(formData));
  if (result.ok) return { done: true, email: result.email };
  switch (result.error) {
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const updateUserNameSchema = z.object({
  userId: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(120),
});

const updateName = guardAction(
  {
    id: "control.user.update-name",
    schema: updateUserNameSchema,
    target: (i) => `user:${i.userId}`,
  },
  async (input) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    await updateUserName(rt, input.userId, input.name);
    revalidateControl();
    return { ok: true as const, email, name: input.name };
  },
);

export async function updateUserNameAction(
  _previous: UpdateUserNameState,
  formData: FormData,
): Promise<UpdateUserNameState> {
  const result = await updateName({
    userId: formData.get("userId") ?? undefined,
    name: formData.get("name") ?? undefined,
  });
  if (result.ok) return { done: true, email: result.email, name: result.name };
  switch (result.error) {
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const dismissStageRequest = guardAction(
  {
    id: "control.user.dismiss-stage-request",
    schema: target,
    target: (i) => `user:${i.userId}`,
  },
  async (input) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    await clearStageRequest(rt, input.userId);
    revalidateControl();
    return { ok: true as const, email };
  },
);

export async function dismissStageRequestAction(
  _previous: DismissStageRequestState,
  formData: FormData,
): Promise<DismissStageRequestState> {
  const result = await dismissStageRequest(userForm(formData));
  if (result.ok) return { done: true, email: result.email };
  switch (result.error) {
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

const deleteUserSchema = z.object({
  userId: z.string().min(1).max(64),
  confirmEmail: z.string().trim().min(1).max(255),
});

const deleteUser = guardAction(
  {
    id: "control.user.delete",
    schema: deleteUserSchema,
    target: (i) => `user:${i.userId}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    if (ctx.identity.kind === "user" && ctx.owns(input.userId)) {
      return { ok: false as const, error: "self-delete" as const };
    }
    const rt = getAuthRuntime();
    const email = await findUserEmail(rt, input.userId);
    if (!email) return { ok: false as const, error: "not-found" as const };
    if (email.toLowerCase() !== input.confirmEmail.toLowerCase()) {
      return { ok: false as const, error: "confirm-mismatch" as const };
    }
    await deleteUserAccount(rt, await headers(), input.userId);
    revalidateControl();
    return { ok: true as const, email };
  },
);

export async function deleteUserAction(
  _previous: DeleteUserState,
  formData: FormData,
): Promise<DeleteUserState> {
  const result = await deleteUser({
    userId: formData.get("userId") ?? undefined,
    confirmEmail: formData.get("confirmEmail") ?? undefined,
  });
  if (result.ok) return { done: true, email: result.email };
  switch (result.error) {
    case "self-delete":
      return { error: MESSAGES.selfDelete };
    case "confirm-mismatch":
      return { error: MESSAGES.confirmEmailMismatch };
    case "not-found":
      return { error: MESSAGES.notFound };
    case "demo":
      return { error: MESSAGES.demo };
    case "step-up-required":
      return { error: MESSAGES.stepUpRequired };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.genericFailure };
  }
}
