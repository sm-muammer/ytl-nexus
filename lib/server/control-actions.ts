"use server";

import { headers } from "next/headers";
import { z } from "zod";
import {
  generatePassword,
  findUserEmail,
  resetPasswordAsAdmin,
  revokeSessionsAsAdmin,
} from "@/lib/server/auth/service";
import {
  MESSAGES,
  type ResetPasswordState,
  type RevokeSessionsState,
} from "@/lib/server/auth/form-state";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";

// Nexus Control actions available in Task 6 (requirements 6.13, 6.17). Task 19
// adds the rest. Each one is an Administrator-only Server Function that needs a
// fresh Step_Up, validates its input, and writes exactly one audit event.

const target = z.object({ userId: z.string().min(1).max(64) });
const form = (data: FormData) => ({ userId: data.get("userId") ?? undefined });

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
    // No email is sent. The new password is shown once to the Administrator,
    // who passes it on; it is not stored anywhere in readable form.
    const password = generatePassword();
    await resetPasswordAsAdmin(rt, await headers(), input.userId, password);
    return { ok: true as const, email, password };
  },
);

export async function resetPasswordAction(
  _previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const result = await resetPassword(form(formData));
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
  const result = await revokeSessions(form(formData));
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
