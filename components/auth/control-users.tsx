"use client";

import { useActionState, useState } from "react";
import {
  createUserAction,
  changeRoleAction,
  setUserEnabledAction,
  resetTwoFactorAction,
  resetPasswordAction,
  revokeSessionsAction,
} from "@/lib/server/control-actions";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { SubmitButton, inputClass } from "./form-parts";

export type ControlUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned?: boolean;
  twoFactorEnabled: boolean;
  activeSessions: number;
};

function CreateUser({ demo }: { demo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createUserAction, null);

  return (
    <div className="border-line bg-surface-elevated rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Add user account</h3>
          <p className="text-muted text-sm">
            Create a new authenticated account and assign their platform role.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="border-line hover:border-ink rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
        >
          {open ? "Close form" : "New account"}
        </button>
      </div>

      {open ? (
        <form action={action} className="mt-5 flex flex-col gap-4">
          <fieldset disabled={demo} className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-name" className="text-xs font-medium">
                Full name
              </label>
              <input
                id="create-name"
                name="name"
                required
                maxLength={120}
                placeholder="Logesh Velusamy"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-email" className="text-xs font-medium">
                Email address
              </label>
              <input
                id="create-email"
                name="email"
                type="email"
                required
                maxLength={255}
                placeholder="logesh@ytlcomms.my"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="create-role" className="text-xs font-medium">
                Role
              </label>
              <select
                id="create-role"
                name="role"
                defaultValue="member"
                className={inputClass}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Creating account">
              Create account
            </SubmitButton>
          </div>

          <div role="status" aria-live="polite" className="text-sm">
            {state && "error" in state ? (
              <span className="text-bad-ink font-medium">{state.error}</span>
            ) : null}
            {state && "done" in state ? (
              <div className="border-signal/40 bg-signal/10 rounded-lg border p-4 text-sm">
                <p className="font-semibold text-emerald-400">
                  Account created for {state.email}
                </p>
                <p className="text-muted mt-1 text-xs">
                  A random 24-character password has been generated. It is shown
                  only once and is not stored in plain text:
                </p>
                <p className="mt-2 font-mono text-sm break-all text-white select-all">
                  <code>{state.password}</code>
                </p>
                <p className="text-muted mt-2 text-xs">
                  Pass it on privately. They will be prompted to enrol their
                  authenticator app on their first sign-in.
                </p>
              </div>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ChangeRole({ user, demo }: { user: ControlUser; demo?: boolean }) {
  const [state, action] = useActionState(changeRoleAction, null);
  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="userId" value={user.id} />
      <div className="flex items-center gap-2">
        <label htmlFor={`role-${user.id}`} className="sr-only">
          Role for {user.email}
        </label>
        <select
          id={`role-${user.id}`}
          name="role"
          disabled={demo}
          defaultValue={user.role}
          className="border-line bg-surface rounded-md border px-2 py-1 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <SubmitButton variant="quiet" pendingLabel="Saving">
          {`Update role for ${user.email}`}
        </SubmitButton>
      </div>
      <div role="status" aria-live="polite" className="text-xs">
        {state && "error" in state ? (
          <span className="text-bad-ink">{state.error}</span>
        ) : null}
        {state && "done" in state ? (
          <span className="text-emerald-400">
            Role for {state.email} updated to {ROLE_LABEL[state.role]}.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function ToggleEnabled({ user, demo }: { user: ControlUser; demo?: boolean }) {
  const [state, action] = useActionState(setUserEnabledAction, null);
  const isBanned = Boolean(user.banned);

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="userId" value={user.id} />
      <input type="hidden" name="enabled" value={isBanned ? "true" : "false"} />
      <SubmitButton
        variant="quiet"
        pendingLabel={isBanned ? "Enabling" : "Disabling"}
        disabled={demo}
      >
        {isBanned ? `Enable ${user.email}` : `Disable ${user.email}`}
      </SubmitButton>
      <div role="status" aria-live="polite" className="text-xs">
        {state && "error" in state ? (
          <span className="text-bad-ink">{state.error}</span>
        ) : null}
        {state && "done" in state ? (
          <span className="text-emerald-400">
            {state.email} is now {state.enabled ? "enabled" : "disabled"}.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function ResetTwoFactor({ user, demo }: { user: ControlUser; demo?: boolean }) {
  const [state, action] = useActionState(resetTwoFactorAction, null);
  if (!user.twoFactorEnabled) return null;

  return (
    <form action={action} className="flex flex-col gap-1.5">
      <input type="hidden" name="userId" value={user.id} />
      <SubmitButton
        variant="quiet"
        pendingLabel="Resetting 2FA"
        disabled={demo}
      >
        {`Reset 2FA for ${user.email}`}
      </SubmitButton>
      <div role="status" aria-live="polite" className="text-xs">
        {state && "error" in state ? (
          <span className="text-bad-ink">{state.error}</span>
        ) : null}
        {state && "done" in state ? (
          <span className="text-emerald-400">
            2FA was reset for {state.email}. They will be asked to re-enrol upon
            sign-in.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function ResetPassword({ user, demo }: { user: ControlUser; demo?: boolean }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <SubmitButton variant="quiet" pendingLabel="Resetting" disabled={demo}>
        {`Reset password for ${user.email}`}
      </SubmitButton>
      <div role="status" aria-live="polite" className="text-data">
        {state && "error" in state ? (
          <span className="text-bad-ink">{state.error}</span>
        ) : null}
        {state && "done" in state ? (
          <span>
            New password for {state.email}, shown once:{" "}
            <code className="font-mono break-all select-all">
              {state.password}
            </code>
            . Their other sessions were ended. Pass it on privately.
          </span>
        ) : null}
      </div>
    </form>
  );
}

function RevokeSessions({ user, demo }: { user: ControlUser; demo?: boolean }) {
  const [state, action] = useActionState(revokeSessionsAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <SubmitButton variant="quiet" pendingLabel="Ending" disabled={demo}>
        {`End sessions for ${user.email}`}
      </SubmitButton>
      <div role="status" aria-live="polite" className="text-data">
        {state && "error" in state ? (
          <span className="text-bad-ink">{state.error}</span>
        ) : null}
        {state && "done" in state ? (
          <span>All sessions for {state.email} were ended.</span>
        ) : null}
      </div>
    </form>
  );
}

/** Complete accounts management in Nexus Control (CTL-02). */
export function ControlUsers({
  users,
  demo = false,
}: {
  users: readonly ControlUser[];
  demo?: boolean;
}) {
  return (
    <div className="flex flex-col gap-6">
      <CreateUser demo={demo} />

      <ul className="divide-line border-line divide-y border-y">
        {users.map((user) => (
          <li
            key={user.id}
            className="flex flex-col gap-4 py-5 lg:flex-row lg:items-start lg:justify-between"
            data-user-row
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium break-words">{user.name}</p>
                {user.banned ? (
                  <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs font-semibold text-rose-300 uppercase">
                    Disabled
                  </span>
                ) : (
                  <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300 uppercase">
                    Active
                  </span>
                )}
              </div>
              <p className="text-muted text-data break-all">{user.email}</p>
              <p className="text-muted text-data mt-1">
                {ROLE_LABEL[user.role]}
                {" · "}
                {user.twoFactorEnabled
                  ? "Two-factor active"
                  : "Two-factor not enrolled"}
                {" · "}
                {user.activeSessions === 1
                  ? "1 active session"
                  : `${user.activeSessions} active sessions`}
              </p>
            </div>

            <div className="flex flex-wrap items-start gap-3">
              <ChangeRole user={user} demo={demo} />
              <ToggleEnabled user={user} demo={demo} />
              <ResetPassword user={user} demo={demo} />
              <ResetTwoFactor user={user} demo={demo} />
              <RevokeSessions user={user} demo={demo} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
