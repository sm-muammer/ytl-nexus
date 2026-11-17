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
import {
  setQuotaAction,
  addKeyAction,
  removeKeyAction,
} from "@/lib/server/transfer-actions";
import { setMailboxQuotaAction } from "@/lib/server/mail-actions";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { SubmitButton, inputClass } from "./form-parts";
import type { TransferAccount } from "@/lib/transfer/types";
import type { MailAccount } from "@/lib/mail/types";
import { formatBytes, usagePercent } from "@/lib/transfer/format";
import { QUOTA_MB_MAX, QUOTA_MB_MIN } from "@/lib/transfer/validation";

export type ControlUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  banned?: boolean;
  banReason?: string | null;
  stageRequest?: {
    role: Role;
    requestedAt: string;
    reason?: string;
  } | null;
  twoFactorEnabled: boolean;
  activeSessions: number;
  transferAccount?: TransferAccount | null;
  mailAccount?: MailAccount | null;
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
          Update role
          <span className="sr-only"> for {user.email}</span>
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
        {isBanned ? "Enable" : "Disable"}
        <span className="sr-only"> {user.email}</span>
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
        Reset 2FA
        <span className="sr-only"> for {user.email}</span>
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
        Reset password
        <span className="sr-only"> for {user.email}</span>
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
        End sessions
        <span className="sr-only"> for {user.email}</span>
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

function UserStorage({ user, demo }: { user: ControlUser; demo?: boolean }) {
  const [transferState, transferAction] = useActionState(setQuotaAction, null);
  const [mailState, mailAction] = useActionState(setMailboxQuotaAction, null);
  const [keyState, keyAction] = useActionState(addKeyAction, null);
  const [, removeKey] = useActionState(removeKeyAction, null);

  const transfer = user.transferAccount;
  const mail = user.mailAccount;

  const transferPercent = transfer
    ? usagePercent(transfer.usedBytes, transfer.quotaBytes)
    : null;

  return (
    <div className="border-line/60 bg-surface/50 mt-4 rounded-xl border p-4.5">
      <div className="border-line/40 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h4 className="text-muted text-xs font-semibold tracking-wider uppercase">
            Storage & Subsystem Access
          </h4>
          <p className="text-data text-muted mt-0.5">
            Single-account storage limits and quotas for SFTP transfers and
            mailbox storage.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* File Transfer Quota */}
        <div className="border-line/40 bg-surface-raised/30 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">File Portal & SFTP</span>
              {transfer ? (
                <span className="text-data text-xs text-emerald-400">
                  {transfer.enabled ? "Active" : "Disabled"}
                </span>
              ) : (
                <span className="text-data text-muted text-xs">
                  Auto-provisioned on login
                </span>
              )}
            </div>
            {transfer ? (
              <div className="mt-2 text-xs">
                <p className="text-muted text-data">
                  {formatBytes(transfer.usedBytes)} used of{" "}
                  {transfer.quotaBytes > 0
                    ? formatBytes(transfer.quotaBytes)
                    : "no limit"}
                  {transferPercent !== null ? ` (${transferPercent}%)` : ""}
                </p>
                {transferPercent !== null ? (
                  <div className="bg-surface-elevated mt-1.5 h-1.5 w-full overflow-hidden rounded-full">
                    <div
                      className={`h-full ${transferPercent >= 90 ? "bg-rose-500" : "bg-sky-400"}`}
                      style={{ width: `${Math.min(transferPercent, 100)}%` }}
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {transfer ? (
            <form action={transferAction} className="flex flex-col gap-2">
              <input type="hidden" name="username" value={transfer.username} />
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`transfer-quota-${user.id}`}
                  className="text-muted text-data shrink-0 text-xs"
                >
                  Limit (MB):
                </label>
                <input
                  id={`transfer-quota-${user.id}`}
                  name="quotaMb"
                  type="number"
                  min={QUOTA_MB_MIN}
                  max={QUOTA_MB_MAX}
                  disabled={demo}
                  defaultValue={
                    transfer.quotaBytes > 0
                      ? Math.round(transfer.quotaBytes / (1024 * 1024))
                      : 1024
                  }
                  className="border-line bg-surface w-24 rounded px-2 py-1 font-mono text-xs"
                />
                <SubmitButton
                  variant="quiet"
                  pendingLabel="Saving"
                  disabled={demo}
                >
                  Save
                  <span className="sr-only">
                    {" "}
                    transfer quota for {user.email}
                  </span>
                </SubmitButton>
              </div>
              <div role="status" aria-live="polite" className="text-xs">
                {transferState && "error" in transferState ? (
                  <span className="text-bad-ink">{transferState.error}</span>
                ) : null}
                {transferState && "done" in transferState ? (
                  <span className="text-emerald-400">
                    File transfer limit updated.
                  </span>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="text-muted text-data text-xs">
              Portal account initializes automatically when {user.name} visits
              Nexus Transfer.
            </p>
          )}
        </div>

        {/* Mailbox Quota */}
        <div className="border-line/40 bg-surface-raised/30 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Internal Mailbox</span>
              {mail ? (
                <span className="text-data text-xs text-emerald-400">
                  {mail.enabled ? "Active" : "Disabled"}
                </span>
              ) : (
                <span className="text-data text-muted text-xs">
                  Auto-provisioned on login
                </span>
              )}
            </div>
            {mail ? (
              <div className="mt-2 text-xs">
                <p className="text-muted text-data truncate font-mono">
                  {mail.address}
                </p>
                <p className="text-muted text-data mt-0.5">
                  Limit:{" "}
                  {mail.quotaBytes > 0
                    ? formatBytes(mail.quotaBytes)
                    : "no limit"}
                </p>
              </div>
            ) : null}
          </div>

          {mail ? (
            <form action={mailAction} className="flex flex-col gap-2">
              <input type="hidden" name="address" value={mail.address} />
              <div className="flex items-center gap-2">
                <label
                  htmlFor={`mail-quota-${user.id}`}
                  className="text-muted text-data shrink-0 text-xs"
                >
                  Limit (MB):
                </label>
                <input
                  id={`mail-quota-${user.id}`}
                  name="quotaMb"
                  type="number"
                  min={QUOTA_MB_MIN}
                  max={QUOTA_MB_MAX}
                  disabled={demo}
                  defaultValue={
                    mail.quotaBytes > 0
                      ? Math.round(mail.quotaBytes / (1024 * 1024))
                      : 1024
                  }
                  className="border-line bg-surface w-24 rounded px-2 py-1 font-mono text-xs"
                />
                <SubmitButton
                  variant="quiet"
                  pendingLabel="Saving"
                  disabled={demo}
                >
                  Save
                  <span className="sr-only">
                    {" "}
                    mailbox quota for {user.email}
                  </span>
                </SubmitButton>
              </div>
              <div role="status" aria-live="polite" className="text-xs">
                {mailState && "error" in mailState ? (
                  <span className="text-bad-ink">{mailState.error}</span>
                ) : null}
                {mailState && "done" in mailState ? (
                  <span className="text-emerald-400">
                    Mailbox limit updated.
                  </span>
                ) : null}
              </div>
            </form>
          ) : (
            <p className="text-muted text-data text-xs">
              Mailbox initializes automatically when {user.name} visits Nexus
              Mail.
            </p>
          )}
        </div>
      </div>

      {/* SSH Keys (if user has transfer account) */}
      {transfer ? (
        <div className="border-line/30 mt-4 border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Public SSH Keys (SFTP)</span>
            <span className="text-muted text-data text-xs">
              {transfer.keys.length} of 10 keys
            </span>
          </div>
          {transfer.keys.length > 0 ? (
            <ul className="divide-line/20 border-line/20 mt-2 divide-y border-y">
              {transfer.keys.map((k) => (
                <li
                  key={k.fingerprint}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5 font-mono text-xs"
                >
                  <span className="text-muted break-all">
                    {k.fingerprint}{" "}
                    <span className="font-sans text-xs">
                      ({k.comment || k.type})
                    </span>
                  </span>
                  <form action={removeKey}>
                    <input
                      type="hidden"
                      name="username"
                      value={transfer.username}
                    />
                    <input
                      type="hidden"
                      name="fingerprint"
                      value={k.fingerprint}
                    />
                    <SubmitButton
                      variant="quiet"
                      pendingLabel="Removing"
                      disabled={demo}
                    >
                      Remove
                      <span className="sr-only"> key {k.fingerprint}</span>
                    </SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-data mt-1 text-xs">
              No SSH keys registered. Authenticates with SSO password.
            </p>
          )}

          {transfer.keys.length < 10 ? (
            <details className="mt-2 text-xs">
              <summary className="text-muted hover:text-ink cursor-pointer font-medium">
                Add public key for {transfer.username}
              </summary>
              <form action={keyAction} className="mt-2 flex flex-col gap-2">
                <input
                  type="hidden"
                  name="username"
                  value={transfer.username}
                />
                <textarea
                  name="publicKey"
                  required
                  placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5... user@host"
                  rows={2}
                  disabled={demo}
                  className="border-line bg-surface w-full rounded-md border p-2 font-mono text-xs"
                />
                <div className="flex items-center gap-2">
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Adding"
                    disabled={demo}
                  >
                    Add key
                  </SubmitButton>
                  {keyState && "error" in keyState ? (
                    <span className="text-bad-ink">{keyState.error}</span>
                  ) : null}
                  {keyState && "done" in keyState ? (
                    <span className="text-emerald-400">Public key added.</span>
                  ) : null}
                </div>
              </form>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
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
          <li key={user.id} className="flex flex-col gap-5 py-5" data-user-row>
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-sm min-w-0 flex-1 shrink-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{user.name}</p>
                  {user.banned ? (
                    <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-xs font-semibold text-rose-300 uppercase">
                      Disabled
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-xs font-semibold text-emerald-300 uppercase">
                      Active
                    </span>
                  )}
                  {user.stageRequest ? (
                    <span className="animate-pulse rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
                      Pending Request: {ROLE_LABEL[user.stageRequest.role]}
                    </span>
                  ) : null}
                </div>
                <p className="text-muted text-data mt-0.5 truncate">
                  {user.email}
                </p>
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
                {user.stageRequest ? (
                  <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-950/20 p-2.5 text-xs text-amber-200">
                    <p className="font-medium">
                      Stage Promotion Requested:{" "}
                      <span className="text-white">
                        {ROLE_LABEL[user.stageRequest.role]}
                      </span>
                    </p>
                    {user.stageRequest.reason ? (
                      <p className="mt-1 text-slate-300 italic">
                        &ldquo;{user.stageRequest.reason}&rdquo;
                      </p>
                    ) : null}
                    <p className="mt-1.5 text-[10px] text-amber-300/80">
                      To approve, select {ROLE_LABEL[user.stageRequest.role]}{" "}
                      from the role dropdown and click Save.
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-start gap-2.5 lg:justify-end">
                <ChangeRole user={user} demo={demo} />
                <ToggleEnabled user={user} demo={demo} />
                <ResetPassword user={user} demo={demo} />
                <ResetTwoFactor user={user} demo={demo} />
                <RevokeSessions user={user} demo={demo} />
              </div>
            </div>

            {/* Storage Quotas & Service Management per User */}
            <UserStorage user={user} demo={demo} />
          </li>
        ))}
      </ul>
    </div>
  );
}
