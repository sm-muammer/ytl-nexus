"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { ROLES, type Role } from "@/lib/roles";
import {
  generatePassword,
  findUserEmail,
  resetPasswordAsAdmin,
  revokeSessionsAsAdmin,
  changeUserRole,
  setUserBanned,
  resetTwoFactor as resetUserTwoFactor,
  createAccount,
} from "@/lib/server/auth/service";
import {
  MESSAGES,
  type CreateUserState,
  type ChangeRoleState,
  type SetUserEnabledState,
  type ResetTwoFactorState,
  type ResetPasswordState,
  type RevokeSessionsState,
} from "@/lib/server/auth/form-state";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";

// Nexus Control user actions (requirements CTL-02, CTL-08, CTL-09).
// Each is an Administrator-only Server Function that requires a fresh Step_Up,
// validates its input, and writes an audit event.

const target = z.object({ userId: z.string().min(1).max(64) });
const userForm = (data: FormData) => ({
  userId: data.get("userId") ?? undefined,
});

const createUserSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().trim().min(1).max(120),
  role: z.enum(ROLES),
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
    try {
      await createAccount(rt, {
        email,
        name: input.name,
        role: input.role,
        password,
      });
      return { ok: true as const, email, password };
    } catch {
      return { ok: false as const, error: "email-exists" as const };
    }
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
  });
  if (result.ok)
    return { done: true, email: result.email, password: result.password };
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
