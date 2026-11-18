// Shapes the sign-in, enrolment, Step_Up and Control forms exchange with their
// Server Functions. Types only, so client components can import them. Every
// message is written for the person at the keyboard: no codes, no hostnames,
// nothing that tells an attacker which half of a login was wrong.

import type { Role } from "@/lib/roles";

export type FormMessage = { error: string } | null;

export type SignInState = FormMessage;
export type TotpState = FormMessage;
export type StepUpState = FormMessage;

export type EnrolState =
  | null
  | { error: string; step?: "password" | "code" }
  | {
      step: "code";
      error?: string;
      qrSvg: string;
      manualKey: string;
      backupCodes: string[];
    };

export type ResetPasswordState =
  null | { error: string } | { done: true; email: string; password: string };

export type RevokeSessionsState =
  null | { error: string } | { done: true; email: string };

export type CreateUserState =
  | null
  | { error: string }
  | {
      done: true;
      email: string;
      password: string;
      transferUsername?: string | null;
      mailboxAddress?: string | null;
    };

export type UpdateUserNameState =
  null | { error: string } | { done: true; email: string; name: string };

export type DismissStageRequestState =
  null | { error: string } | { done: true; email: string };

export type DeleteUserState =
  null | { error: string } | { done: true; email: string };

export type ChangeRoleState =
  null | { error: string } | { done: true; email: string; role: Role };

export type SetUserEnabledState =
  null | { error: string } | { done: true; email: string; enabled: boolean };

export type ResetTwoFactorState =
  null | { error: string } | { done: true; email: string };

export type SignUpState =
  null | { error: string } | { done: true; email: string };

export type RequestStageUpgradeState =
  null | { error: string } | { done: true; requestedRole: Role };

export const MESSAGES = {
  invalidCredentials: "The email or password is not correct.",
  locked: "Too many failed attempts. Try again in 15 minutes.",
  invalidInput: "Check the highlighted fields and try again.",
  invalidCode:
    "That code did not work. Check it and try again, or sign in again.",
  invalidStepUp: "The password or the code is not correct.",
  genericFailure: "Something went wrong. Nothing was changed. Try again.",
  demo: "This is a demo session. Nothing was changed.",
  forbidden: "You do not have access to do that.",
  stepUpRequired: "Confirm your password and code again to continue.",
  self: "Use another Administrator account to reset your own password.",
  selfRole: "You cannot change your own role in Control.",
  selfDisable: "You cannot disable your own account.",
  selfDelete: "You cannot delete your own account.",
  confirmEmailMismatch:
    "Type the exact account email address to confirm deletion.",
  emailExists: "An account with that email already exists.",
  notFound: "That account no longer exists.",
} as const;
