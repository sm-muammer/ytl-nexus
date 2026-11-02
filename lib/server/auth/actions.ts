"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { requiresTwoFactor } from "@/lib/server/auth/rules";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { safeNext } from "@/lib/server/auth/safe-next";
import {
  confirmEnrolment,
  performStepUp,
  startEnrolment,
} from "@/lib/server/auth/service";
import {
  MESSAGES,
  type EnrolState,
  type SignInState,
  type StepUpState,
  type TotpState,
} from "@/lib/server/auth/form-state";

// Server Functions for signing in and out, enrolling two-factor and Step_Up.
// Each is a public endpoint, so each goes through guardAction: the policy table
// decides who may call it, Zod validates the input, and refusals are audited.
// Better Auth audits the outcome of its own endpoints, so these use
// "refusals-only" where it does; Step_Up audits itself in the service.
//
// A Server Function cannot call redirect() inside guardAction's try/catch, so
// each handler returns where to go and the exported function redirects.

type Failure<E extends string> = { ok: false; error: E };

const demoOnly = (): Failure<"demo"> | null =>
  getMode() === "demo" ? { ok: false, error: "demo" } : null;

const form = (data: FormData, ...names: string[]) =>
  Object.fromEntries(names.map((n) => [n, data.get(n) ?? undefined]));

// ---- Sign in ----------------------------------------------------------------------

const signInSchema = z.object({
  email: z.string().trim().min(3).max(255),
  password: z.string().min(1).max(128),
  next: z.string().max(512).optional(),
});

const signIn = guardAction(
  {
    id: "auth.sign-in",
    schema: signInSchema,
    target: (i) => i.email.toLowerCase(),
    audit: "refusals-only",
  },
  async (input) => {
    const demo = demoOnly();
    if (demo) return demo;
    const next = safeNext(input.next);
    try {
      const result = await getAuthRuntime().auth.api.signInEmail({
        body: { email: input.email, password: input.password },
        headers: await headers(),
      });
      if ("twoFactorRedirect" in result && result.twoFactorRedirect) {
        return {
          ok: true as const,
          to: `/signin?step=totp&next=${encodeURIComponent(next)}`,
        };
      }
      const user = result.user as { role?: string; twoFactorEnabled?: boolean };
      const needsEnrolment =
        (user.role === "operator" || user.role === "admin") &&
        requiresTwoFactor(user.role) &&
        !user.twoFactorEnabled;
      return {
        ok: true as const,
        to: needsEnrolment
          ? `/signin?step=enrol&next=${encodeURIComponent(next)}`
          : next,
      };
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      return {
        ok: false as const,
        error:
          status === 429
            ? ("locked" as const)
            : ("invalid-credentials" as const),
      };
    }
  },
);

export async function signInAction(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const result = await signIn(form(formData, "email", "password", "next"));
  if (result.ok) redirect(result.to);
  switch (result.error) {
    case "locked":
      return { error: MESSAGES.locked };
    case "demo":
      return { error: MESSAGES.demo };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    case "invalid-credentials":
      return { error: MESSAGES.invalidCredentials };
    default:
      return { error: MESSAGES.genericFailure };
  }
}

// ---- Second step of sign-in -----------------------------------------------------------

const totpSchema = z
  .object({
    method: z.enum(["totp", "backup"]),
    code: z.string().trim().min(6).max(32),
    next: z.string().max(512).optional(),
  })
  .refine(
    (v) =>
      v.method === "totp"
        ? /^\d{6}$/.test(v.code)
        : /^[A-Za-z0-9-]{8,32}$/.test(v.code),
    { path: ["code"], message: "format" },
  );

const verifyTwoFactor = guardAction(
  {
    id: "auth.verify-two-factor",
    schema: totpSchema,
    target: (i) => `sign-in:${i.method}`,
    audit: "refusals-only",
  },
  async (input) => {
    const demo = demoOnly();
    if (demo) return demo;
    const { auth } = getAuthRuntime();
    try {
      const h = await headers();
      if (input.method === "totp") {
        await auth.api.verifyTOTP({ body: { code: input.code }, headers: h });
      } else {
        await auth.api.verifyBackupCode({
          body: { code: input.code },
          headers: h,
        });
      }
      return { ok: true as const, to: safeNext(input.next) };
    } catch {
      return { ok: false as const, error: "invalid-code" as const };
    }
  },
);

export async function verifyTwoFactorAction(
  _previous: TotpState,
  formData: FormData,
): Promise<TotpState> {
  const result = await verifyTwoFactor(
    form(formData, "method", "code", "next"),
  );
  if (result.ok) redirect(result.to);
  return {
    error: result.error === "demo" ? MESSAGES.demo : MESSAGES.invalidCode,
  };
}

// ---- Sign out ---------------------------------------------------------------------------

const signOut = guardAction(
  {
    id: "auth.sign-out",
    schema: z.object({}),
    target: () => "session",
    audit: "refusals-only",
  },
  async () => {
    if (getMode() === "live") {
      await getAuthRuntime()
        .auth.api.signOut({ headers: await headers() })
        .catch(() => undefined);
    }
    return { ok: true as const };
  },
);

export async function signOutAction(): Promise<void> {
  await signOut({});
  redirect("/");
}

// ---- Two-factor enrolment -----------------------------------------------------------------

const startSchema = z.object({ password: z.string().min(1).max(128) });

const start = guardAction(
  {
    id: "auth.start-enrolment",
    schema: startSchema,
    target: () => "two-factor",
    audit: "refusals-only",
  },
  async (input) => {
    const demo = demoOnly();
    if (demo) return demo;
    const result = await startEnrolment(
      getAuthRuntime(),
      await headers(),
      input.password,
    );
    return result.ok
      ? {
          ok: true as const,
          qrSvg: result.qrSvg,
          manualKey: result.manualKey,
          backupCodes: result.backupCodes,
        }
      : { ok: false as const, error: result.reason };
  },
);

export async function startEnrolmentAction(
  _previous: EnrolState,
  formData: FormData,
): Promise<EnrolState> {
  const result = await start(form(formData, "password"));
  if (result.ok) {
    return {
      step: "code",
      qrSvg: result.qrSvg,
      manualKey: result.manualKey,
      backupCodes: result.backupCodes,
    };
  }
  if (result.error === "already-enrolled") redirect("/");
  switch (result.error) {
    case "locked":
      return { error: MESSAGES.locked, step: "password" };
    case "demo":
      return { error: MESSAGES.demo, step: "password" };
    case "invalid-password":
      return { error: MESSAGES.invalidStepUp, step: "password" };
    default:
      return { error: MESSAGES.genericFailure, step: "password" };
  }
}

const confirmSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  next: z.string().max(512).optional(),
});

const confirm = guardAction(
  {
    id: "auth.confirm-enrolment",
    schema: confirmSchema,
    target: () => "two-factor",
    audit: "refusals-only",
  },
  async (input) => {
    const demo = demoOnly();
    if (demo) return demo;
    const result = await confirmEnrolment(
      getAuthRuntime(),
      await headers(),
      input.code,
    );
    return result.ok
      ? { ok: true as const, to: safeNext(input.next) }
      : { ok: false as const, error: result.reason };
  },
);

export async function confirmEnrolmentAction(
  _previous: EnrolState,
  formData: FormData,
): Promise<EnrolState> {
  const result = await confirm(form(formData, "code", "next"));
  if (result.ok) redirect(result.to);
  // The form keeps the QR code on screen from the first step; only the message changes.
  return {
    error: result.error === "locked" ? MESSAGES.locked : MESSAGES.invalidCode,
    step: "code",
  };
}

// ---- Step_Up ------------------------------------------------------------------------------------

const stepUpSchema = z.object({
  password: z.string().min(1).max(128),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

const stepUp = guardAction(
  {
    id: "auth.step-up",
    schema: stepUpSchema,
    target: () => "step-up",
    audit: "refusals-only",
  },
  async (input) => {
    const demo = demoOnly();
    if (demo) return demo;
    const result = await performStepUp(
      getAuthRuntime(),
      await headers(),
      input,
    );
    return result.ok
      ? { ok: true as const, to: "/control" }
      : { ok: false as const, error: result.reason };
  },
);

export async function stepUpAction(
  _previous: StepUpState,
  formData: FormData,
): Promise<StepUpState> {
  const result = await stepUp(form(formData, "password", "code"));
  if (result.ok) redirect(result.to);
  switch (result.error) {
    case "locked":
      return { error: MESSAGES.locked };
    case "demo":
      return { error: MESSAGES.demo };
    case "not-found":
      return { error: MESSAGES.forbidden };
    case "invalid-input":
      return { error: MESSAGES.invalidInput };
    default:
      return { error: MESSAGES.invalidStepUp };
  }
}
