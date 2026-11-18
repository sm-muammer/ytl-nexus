"use client";

import { useActionState, useState } from "react";
import {
  confirmEnrolmentAction,
  signInAction,
  signUpAction,
  startEnrolmentAction,
  stepUpAction,
  verifyTwoFactorAction,
} from "@/lib/server/auth/actions";
import { Field, FormError, SubmitButton } from "./form-parts";

const formClass = "flex max-w-md flex-col gap-5";

export function SignInForm({ next }: { next: string }) {
  const [state, action] = useActionState(signInAction, null);
  const [showForgotNotice, setShowForgotNotice] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <form action={action} className={formClass} noValidate={false}>
        <input type="hidden" name="next" value={next} />
        <Field
          label="Email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          maxLength={255}
          autoFocus
        />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          action={
            <button
              type="button"
              onClick={() => setShowForgotNotice((prev) => !prev)}
              className="text-xs text-cyan-400 transition-colors hover:text-cyan-300"
            >
              Forgot password?
            </button>
          }
        />
        <FormError message={state?.error} />
        <div>
          <SubmitButton pendingLabel="Signing in">Sign in</SubmitButton>
        </div>
      </form>

      {showForgotNotice ? (
        <div className="max-w-md rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-4 text-xs text-slate-300">
          <p className="font-semibold text-cyan-300">Password Recovery</p>
          <p className="mt-1">
            YTL Nexus accounts are protected under enterprise operational
            controls. If you forgot your password, please request an
            Administrator in Nexus Control → User Management (
            <code className="font-mono text-cyan-200">/control/users</code>) to
            issue a secure password reset.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function SignUpForm() {
  const [state, action] = useActionState(signUpAction, null);
  return (
    <form action={action} className={formClass} noValidate={false}>
      <p className="text-sm text-slate-400">
        Create your YTL Nexus account. New accounts join at{" "}
        <span className="font-medium text-slate-200">Stage 1 (Member)</span>.
        You can subsequently request promotion to Operator or Administrator.
      </p>
      <Field
        label="Full Name"
        name="name"
        type="text"
        autoComplete="name"
        maxLength={120}
        autoFocus
      />
      <Field
        label="Work Email"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        maxLength={255}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        maxLength={128}
        hint="Minimum 12 characters."
      />
      <FormError
        message={state && "error" in state ? state.error : undefined}
      />
      <div>
        <SubmitButton pendingLabel="Creating account">
          Create account
        </SubmitButton>
      </div>
    </form>
  );
}

/** The second step: a code from the authenticator app, or a backup code. */
export function TotpForm({ next }: { next: string }) {
  const [state, action] = useActionState(verifyTwoFactorAction, null);
  const [backup, setBackup] = useState(false);
  return (
    <form action={action} className={formClass}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="method" value={backup ? "backup" : "totp"} />
      <Field
        key={backup ? "backup" : "totp"}
        label={backup ? "Backup code" : "6-digit code"}
        name="code"
        autoComplete="one-time-code"
        inputMode={backup ? "text" : "numeric"}
        pattern={backup ? "[A-Za-z0-9\\-]{8,32}" : "[0-9]{6}"}
        maxLength={backup ? 32 : 6}
        hint={
          backup
            ? "Each backup code works once."
            : "Open your authenticator app and enter the current code."
        }
        autoFocus
      />
      <FormError message={state?.error} />
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel="Checking">Continue</SubmitButton>
        <button
          type="button"
          onClick={() => setBackup((b) => !b)}
          className="text-muted hover:text-ink min-h-11 text-sm underline underline-offset-4"
        >
          {backup ? "Use the authenticator app" : "Use a backup code"}
        </button>
      </div>
    </form>
  );
}

/**
 * Two-factor enrolment for Operators and Administrators. Step one asks for the
 * password and shows the QR code and the backup codes once; step two checks the
 * first code, which switches two-factor on.
 */
export function EnrolForm({ next }: { next: string }) {
  const [startState, start] = useActionState(startEnrolmentAction, null);
  const [confirmState, confirm] = useActionState(confirmEnrolmentAction, null);
  const shown = startState && "qrSvg" in startState ? startState : null;

  if (!shown) {
    return (
      <form action={start} className={formClass}>
        <p className="text-muted max-w-prose">
          Administrators sign in with a second factor. Enter your password to
          get a QR code for your authenticator app.
        </p>
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          autoFocus
        />
        <FormError message={startState?.error} />
        <div>
          <SubmitButton pendingLabel="Preparing">Continue</SubmitButton>
        </div>
      </form>
    );
  }

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <section aria-labelledby="scan-title" className="flex flex-col gap-4">
        <h2 id="scan-title" className="text-heading-3 font-semibold">
          1. Scan the code
        </h2>
        <div
          role="img"
          aria-label="QR code for your authenticator app"
          className="size-52 self-start rounded-md bg-white p-2 [&>svg]:size-full"
          dangerouslySetInnerHTML={{ __html: shown.qrSvg }}
        />
        <p className="text-data">
          Cannot scan? Enter this key in your app:{" "}
          <code className="font-mono break-all">{shown.manualKey}</code>
        </p>
      </section>

      <section aria-labelledby="backup-title" className="flex flex-col gap-3">
        <h2 id="backup-title" className="text-heading-3 font-semibold">
          2. Keep your backup codes
        </h2>
        <p className="text-muted max-w-prose">
          Each code works once if you lose your phone. They are shown only now.
          Store them in your password manager.
        </p>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-sm sm:grid-cols-3">
          {shown.backupCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
      </section>

      <form action={confirm} className={formClass}>
        <h2 className="text-heading-3 font-semibold">
          3. Enter the first code
        </h2>
        <input type="hidden" name="next" value={next} />
        <Field
          label="6-digit code"
          name="code"
          autoComplete="one-time-code"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
        />
        <FormError message={confirmState?.error} />
        <div>
          <SubmitButton pendingLabel="Checking">
            Turn on two-factor
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

/** Asked on /control when the last password-and-code check is older than 10 minutes. */
export function StepUpForm({ next = "/control" }: { next?: string }) {
  const [state, action] = useActionState(stepUpAction, null);
  return (
    <form action={action} className={formClass}>
      <input type="hidden" name="next" value={next} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        maxLength={128}
        autoFocus
      />
      <Field
        label="6-digit code"
        name="code"
        autoComplete="one-time-code"
        inputMode="numeric"
        pattern="[0-9]{6}"
        maxLength={6}
      />
      <FormError message={state?.error} />
      <div>
        <SubmitButton pendingLabel="Checking">Confirm</SubmitButton>
      </div>
    </form>
  );
}
