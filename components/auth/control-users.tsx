"use client";

import { useActionState, useState } from "react";
import {
  createUserAction,
  changeRoleAction,
  setUserEnabledAction,
  resetTwoFactorAction,
  resetPasswordAction,
  revokeSessionsAction,
  updateUserNameAction,
  dismissStageRequestAction,
  resolveUserRequestAction,
  deleteUserAction,
} from "@/lib/server/control-actions";
import {
  USER_REQUEST_CATEGORY_LABEL,
  type UserRequestDto,
} from "@/lib/fixtures/account";
import {
  createAccountAction,
  setEnabledAction as setTransferEnabledAction,
  setQuotaAction,
  resetPasswordAction as resetTransferPasswordAction,
  addKeyAction,
  removeKeyAction,
} from "@/lib/server/transfer-actions";
import {
  createMailboxAction,
  setMailboxEnabledAction,
  setMailboxQuotaAction,
  resetMailboxPasswordAction,
} from "@/lib/server/mail-actions";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import { SubmitButton, inputClass } from "./form-parts";
import type { TransferAccount } from "@/lib/transfer/types";
import type { MailAccount } from "@/lib/mail/types";
import type { AuditEventDto } from "@/lib/server/audit";
import { formatBytes, usagePercent } from "@/lib/transfer/format";
import { QUOTA_MB_MAX, QUOTA_MB_MIN } from "@/lib/transfer/validation";
import {
  MAIL_DOMAIN,
  QUOTA_MB_MAX as MAIL_QUOTA_MB_MAX,
  QUOTA_MB_MIN as MAIL_QUOTA_MB_MIN,
} from "@/lib/mail";

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
  createdAt?: string;
  transferAccount?: TransferAccount | null;
  mailAccount?: MailAccount | null;
};

type StatusFilter =
  | "all"
  | "active"
  | "disabled"
  | "pending-stage"
  | "2fa-enabled"
  | "2fa-missing";

function defaultHandleFromEmail(email: string): string {
  const local = email.split("@")[0]?.toLowerCase() ?? "user";
  let clean = local.replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z]/.test(clean)) clean = `u-${clean}`;
  if (clean.length < 3) clean = `${clean}000`.slice(0, 3);
  return clean.slice(0, 32);
}

function defaultMailLocalFromEmail(email: string): string {
  const local = email.split("@")[0]?.toLowerCase() ?? "user";
  let clean = local
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/\.{2,}/g, ".")
    .replace(/^[^a-z]+/, "")
    .replace(/[^a-z0-9]+$/, "");
  if (clean.length < 3) clean = `u-${clean || "mail"}`.slice(0, 12);
  return clean.slice(0, 64);
}

function UserMetrics({ users }: { users: readonly ControlUser[] }) {
  const total = users.length;
  const activeCount = users.filter((u) => !u.banned).length;
  const disabledCount = total - activeCount;
  const pendingStages = users.filter((u) => Boolean(u.stageRequest)).length;
  const twoFactorCount = users.filter((u) => u.twoFactorEnabled).length;
  const sftpCount = users.filter((u) => Boolean(u.transferAccount)).length;
  const mailCount = users.filter((u) => Boolean(u.mailAccount)).length;
  const activeSessions = users.reduce((sum, u) => sum + u.activeSessions, 0);

  const byRole = {
    admin: users.filter((u) => u.role === "admin").length,
    operator: users.filter((u) => u.role === "operator").length,
    member: users.filter((u) => u.role === "member").length,
    viewer: users.filter((u) => u.role === "viewer").length,
  };

  return (
    <div data-user-metrics className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="border-line bg-surface-elevated rounded-xl border p-4">
        <p className="text-muted text-xs font-medium tracking-wider uppercase">
          Total Accounts
        </p>
        <p className="font-display text-ink mt-1 text-2xl font-semibold">
          {total}
        </p>
        <p className="text-muted text-data mt-1.5 text-xs">
          {byRole.admin} Admin · {byRole.operator} Operator · {byRole.member}{" "}
          Member · {byRole.viewer} Viewer
        </p>
      </div>

      <div className="border-line bg-surface-elevated rounded-xl border p-4">
        <p className="text-muted text-xs font-medium tracking-wider uppercase">
          Account Status
        </p>
        <p className="font-display text-ink mt-1 text-2xl font-semibold">
          {activeCount}{" "}
          <span className="text-muted text-sm font-normal">active</span>
        </p>
        <p className="text-muted text-data mt-1.5 text-xs">
          {disabledCount} disabled · {activeSessions}{" "}
          {activeSessions === 1 ? "active session" : "active sessions"}
        </p>
      </div>

      <div className="border-line bg-surface-elevated rounded-xl border p-4">
        <p className="text-muted text-xs font-medium tracking-wider uppercase">
          Stage Promotions
        </p>
        <p className="font-display text-ink mt-1 text-2xl font-semibold">
          {pendingStages}
        </p>
        <p className="text-muted text-data mt-1.5 text-xs">
          {pendingStages === 0
            ? "No stage upgrade requests waiting"
            : pendingStages === 1
              ? "1 request awaiting Administrator review"
              : `${pendingStages} requests awaiting Administrator review`}
        </p>
      </div>

      <div className="border-line bg-surface-elevated rounded-xl border p-4">
        <p className="text-muted text-xs font-medium tracking-wider uppercase">
          2FA & Subsystems
        </p>
        <p className="font-display text-ink mt-1 text-2xl font-semibold">
          {twoFactorCount}/{total}{" "}
          <span className="text-muted text-sm font-normal">TOTP</span>
        </p>
        <p className="text-muted text-data mt-1.5 text-xs">
          {sftpCount} SFTP {sftpCount === 1 ? "account" : "accounts"} ·{" "}
          {mailCount} {mailCount === 1 ? "mailbox" : "mailboxes"}
        </p>
      </div>
    </div>
  );
}

function StageRequestItem({
  user,
  demo,
}: {
  user: ControlUser;
  demo?: boolean;
}) {
  const [approveState, approveAction] = useActionState(changeRoleAction, null);
  const [dismissState, dismissAction] = useActionState(
    dismissStageRequestAction,
    null,
  );
  const req = user.stageRequest;
  if (!req) return null;

  return (
    <li className="border-line/60 bg-surface/60 flex flex-col gap-3 rounded-lg border p-3.5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {user.name}{" "}
            <span className="text-muted text-data font-normal">
              ({user.email})
            </span>
          </p>
          <p className="text-muted text-data mt-0.5 text-xs">
            {ROLE_LABEL[user.role]} →{" "}
            <span className="font-semibold text-amber-300">
              {ROLE_LABEL[req.role]}
            </span>
            {" · "}
            Requested {req.requestedAt.slice(0, 10)}
          </p>
          {req.reason ? (
            <p className="text-muted mt-1 text-xs italic">
              &ldquo;{req.reason}&rdquo;
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <form action={approveAction}>
            <input type="hidden" name="userId" value={user.id} />
            <input type="hidden" name="role" value={req.role} />
            <SubmitButton pendingLabel="Approving" disabled={demo}>
              Approve {ROLE_LABEL[req.role]}
              <span className="sr-only"> for {user.email}</span>
            </SubmitButton>
          </form>
          <form action={dismissAction}>
            <input type="hidden" name="userId" value={user.id} />
            <SubmitButton
              variant="quiet"
              pendingLabel="Dismissing"
              disabled={demo}
            >
              Dismiss
              <span className="sr-only"> request for {user.email}</span>
            </SubmitButton>
          </form>
        </div>
      </div>

      <div role="status" aria-live="polite" className="text-xs">
        {approveState && "error" in approveState ? (
          <span className="text-bad-ink">{approveState.error}</span>
        ) : null}
        {approveState && "done" in approveState ? (
          <span className="text-emerald-400">
            Promoted to {ROLE_LABEL[approveState.role]}.
          </span>
        ) : null}
        {dismissState && "error" in dismissState ? (
          <span className="text-bad-ink">{dismissState.error}</span>
        ) : null}
        {dismissState && "done" in dismissState ? (
          <span className="text-muted">Request dismissed.</span>
        ) : null}
      </div>
    </li>
  );
}

function StageUpgradeQueue({
  users,
  demo,
}: {
  users: readonly ControlUser[];
  demo?: boolean;
}) {
  const pending = users.filter((u) => Boolean(u.stageRequest));
  if (pending.length === 0) return null;

  return (
    <div
      data-stage-requests-queue
      className="rounded-xl border border-amber-500/40 bg-amber-950/20 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-amber-200">
            Pending Stage Promotion Requests ({pending.length})
          </h3>
          <p className="text-muted mt-0.5 text-xs">
            Members and Operators requesting elevated access stages. Approving a
            promotion updates their role and records an audit event.
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {pending.map((u) => (
          <StageRequestItem key={u.id} user={u} demo={demo} />
        ))}
      </ul>
    </div>
  );
}

function ServiceRequestItem({
  req,
  demo,
}: {
  req: UserRequestDto;
  demo?: boolean;
}) {
  const [state, action] = useActionState(resolveUserRequestAction, null);
  const [note, setNote] = useState("");

  return (
    <li
      data-service-request-row
      className="border-line/60 bg-surface/60 flex flex-col gap-3 rounded-lg border p-3.5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-cyan-500/40 bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
              {USER_REQUEST_CATEGORY_LABEL[req.category]}
            </span>
            <span className="text-muted font-mono text-xs">
              {req.createdAt.slice(0, 10)}
            </span>
          </div>
          <p className="text-ink mt-1.5 text-sm font-medium">{req.title}</p>
          <p className="text-muted text-data mt-0.5 text-xs">
            From {req.userName} ({req.userEmail} · {ROLE_LABEL[req.userRole]})
            {req.requestedRole
              ? ` · Target role: ${ROLE_LABEL[req.requestedRole]}`
              : ""}
            {req.requestedQuotaMb !== undefined
              ? ` · Requested quota: ${req.requestedQuotaMb} MiB`
              : ""}
          </p>
          <p className="text-muted mt-1.5 text-xs italic">
            &ldquo;{req.reason}&rdquo;
          </p>
          {req.sshPublicKey ? (
            <p className="text-muted mt-1 font-mono text-[11px] break-all">
              Public key: {req.sshPublicKey.slice(0, 80)}
              {req.sshPublicKey.length > 80 ? "..." : ""}
            </p>
          ) : null}
        </div>

        <form
          action={action}
          className="flex flex-col gap-2 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="requestId" value={req.id} />
          <input
            type="text"
            name="resolutionNote"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={300}
            disabled={demo}
            aria-label={`Administrator note for request ${req.title}`}
            placeholder="Optional resolution note..."
            className="border-line bg-surface min-h-11 rounded-md border px-3 text-xs sm:w-56"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="submit"
              name="decision"
              value="approve"
              disabled={demo}
              className="bg-accent-ink text-canvas min-h-11 rounded-full px-4 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              Approve &amp; Fulfill
              <span className="sr-only"> {req.title}</span>
            </button>
            <button
              type="submit"
              name="decision"
              value="dismiss"
              disabled={demo}
              className="border-border-strong hover:bg-surface-raised min-h-11 rounded-full border px-4 text-xs font-medium disabled:opacity-60"
            >
              Dismiss
              <span className="sr-only"> {req.title}</span>
            </button>
          </div>
        </form>
      </div>

      <div role="status" aria-live="polite" className="text-xs">
        {state && "error" in state ? (
          <span className="text-bad-ink">{state.error}</span>
        ) : null}
        {state && "done" in state ? (
          <span className="text-emerald-400">
            Request marked {state.status}.
          </span>
        ) : null}
      </div>
    </li>
  );
}

function ServiceRequestsQueue({
  serviceRequests,
  demo,
}: {
  serviceRequests?: readonly UserRequestDto[];
  demo?: boolean;
}) {
  const pending = (serviceRequests ?? []).filter((r) => r.status === "pending");
  if (pending.length === 0) return null;

  return (
    <div
      data-service-requests-queue
      className="rounded-xl border border-cyan-500/35 bg-cyan-950/15 p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-cyan-200">
            Pending Member &amp; Operator Service Requests ({pending.length})
          </h3>
          <p className="text-muted mt-0.5 text-xs">
            Self-service requests submitted via Account &amp; Requests
            (/account): stage promotions, SFTP accounts, SSH keys, quotas, and
            internal mailboxes.
          </p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-3">
        {pending.map((req) => (
          <ServiceRequestItem key={req.id} req={req} demo={demo} />
        ))}
      </ul>
    </div>
  );
}

function CreateUser({ demo }: { demo?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createUserAction, null);

  return (
    <div className="border-line bg-surface-elevated rounded-xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold">Add user account</h3>
          <p className="text-muted text-sm">
            Create a new authenticated account, assign their platform role, and
            optionally provision SFTP and internal mail storage.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="border-line hover:border-ink inline-flex min-h-11 items-center rounded-md border px-4 text-xs font-medium transition-colors"
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

          <fieldset
            disabled={demo}
            className="border-line/60 bg-surface/50 grid gap-4 rounded-lg border p-4 sm:grid-cols-3"
          >
            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs">
              <input
                type="checkbox"
                name="provisionTransfer"
                value="true"
                className="size-4 rounded"
              />
              <span>Provision SFTP transfer account</span>
            </label>

            <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-xs">
              <input
                type="checkbox"
                name="provisionMail"
                value="true"
                className="size-4 rounded"
              />
              <span>Provision @{MAIL_DOMAIN} mailbox</span>
            </label>

            <div className="flex items-center gap-2">
              <label
                htmlFor="create-quota-mb"
                className="text-muted shrink-0 text-xs font-medium"
              >
                Default quota (MB)
              </label>
              <input
                id="create-quota-mb"
                name="quotaMb"
                type="number"
                min={64}
                max={20480}
                defaultValue={1024}
                className="border-border-strong bg-surface text-ink min-h-11 w-28 rounded-md border px-2.5 font-mono text-xs"
              />
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Creating account" disabled={demo}>
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
                {state.transferUsername || state.mailboxAddress ? (
                  <ul className="text-muted mt-2 list-disc space-y-1 pl-4 text-xs">
                    {state.transferUsername ? (
                      <li>
                        SFTP account provisioned:{" "}
                        <code className="text-ink font-mono">
                          {state.transferUsername}
                        </code>
                      </li>
                    ) : null}
                    {state.mailboxAddress ? (
                      <li>
                        Internal mailbox provisioned:{" "}
                        <code className="text-ink font-mono">
                          {state.mailboxAddress}
                        </code>
                      </li>
                    ) : null}
                  </ul>
                ) : null}
                <p className="text-muted mt-2 text-xs">
                  Pass it on privately. Administrators will be prompted to enrol
                  their authenticator app on first sign-in.
                </p>
              </div>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ResetPassword({ user }: { user: ControlUser }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <SubmitButton variant="quiet" pendingLabel="Resetting">
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
          className="border-line bg-surface min-h-11 rounded-md border px-2.5 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        <SubmitButton variant="quiet" pendingLabel="Saving" disabled={demo}>
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
  const [transferQuotaState, transferQuotaAction] = useActionState(
    setQuotaAction,
    null,
  );
  const [transferCreateState, transferCreateAction] = useActionState(
    createAccountAction,
    null,
  );
  const [transferToggleState, transferToggleAction] = useActionState(
    setTransferEnabledAction,
    null,
  );
  const [transferSecretState, transferSecretAction] = useActionState(
    resetTransferPasswordAction,
    null,
  );

  const [mailQuotaState, mailQuotaAction] = useActionState(
    setMailboxQuotaAction,
    null,
  );
  const [mailCreateState, mailCreateAction] = useActionState(
    createMailboxAction,
    null,
  );
  const [mailToggleState, mailToggleAction] = useActionState(
    setMailboxEnabledAction,
    null,
  );
  const [mailSecretState, mailSecretAction] = useActionState(
    resetMailboxPasswordAction,
    null,
  );

  const [keyState, keyAction] = useActionState(addKeyAction, null);
  const [, removeKey] = useActionState(removeKeyAction, null);

  const transfer = user.transferAccount;
  const mail = user.mailAccount;

  const transferPercent = transfer
    ? usagePercent(transfer.usedBytes, transfer.quotaBytes)
    : null;

  return (
    <div className="border-line/60 bg-surface/50 mt-2 rounded-xl border p-4.5">
      <div className="border-line/40 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h4 className="text-muted text-xs font-semibold tracking-wider uppercase">
            Storage & Subsystem Access
          </h4>
          <p className="text-data text-muted mt-0.5">
            Single-account provisioning, storage quotas, and credentials for
            SFTP transfers and internal mailboxes.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* File Transfer Quota & Provisioning */}
        <div className="border-line/40 bg-surface-raised/30 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">File Portal & SFTP</span>
              {transfer ? (
                <span
                  className={`text-data text-xs ${transfer.enabled ? "text-emerald-400" : "text-rose-300"}`}
                >
                  {transfer.enabled ? "Active" : "Disabled"}
                </span>
              ) : (
                <span className="text-data text-muted text-xs">
                  Not provisioned
                </span>
              )}
            </div>
            {transfer ? (
              <div className="mt-2 text-xs">
                <p className="text-ink font-mono text-xs">
                  {transfer.username}
                </p>
                <p className="text-muted text-data mt-0.5">
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
            <div className="flex flex-col gap-3">
              <form
                action={transferQuotaAction}
                className="flex flex-col gap-2"
              >
                <input
                  type="hidden"
                  name="username"
                  value={transfer.username}
                />
                <div className="flex flex-wrap items-center gap-2">
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
                    className="border-line bg-surface min-h-11 w-24 rounded px-2.5 font-mono text-xs"
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
                  {transferQuotaState && "error" in transferQuotaState ? (
                    <span className="text-bad-ink">
                      {transferQuotaState.error}
                    </span>
                  ) : null}
                  {transferQuotaState && "done" in transferQuotaState ? (
                    <span className="text-emerald-400">
                      File transfer limit updated.
                    </span>
                  ) : null}
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <form action={transferToggleAction}>
                  <input
                    type="hidden"
                    name="username"
                    value={transfer.username}
                  />
                  <input
                    type="hidden"
                    name="enabled"
                    value={transfer.enabled ? "false" : "true"}
                  />
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Saving"
                    disabled={demo}
                  >
                    {transfer.enabled ? "Disable SFTP" : "Enable SFTP"}
                    <span className="sr-only"> for {user.email}</span>
                  </SubmitButton>
                </form>

                <form action={transferSecretAction}>
                  <input
                    type="hidden"
                    name="username"
                    value={transfer.username}
                  />
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Rotating"
                    disabled={demo}
                  >
                    New SFTP secret
                    <span className="sr-only"> for {user.email}</span>
                  </SubmitButton>
                </form>
              </div>

              <div role="status" aria-live="polite" className="text-xs">
                {transferToggleState && "error" in transferToggleState ? (
                  <span className="text-bad-ink">
                    {transferToggleState.error}
                  </span>
                ) : null}
                {transferToggleState && "done" in transferToggleState ? (
                  <span className="text-emerald-400">
                    SFTP account {transferToggleState.done}.
                  </span>
                ) : null}
                {transferSecretState && "error" in transferSecretState ? (
                  <span className="text-bad-ink">
                    {transferSecretState.error}
                  </span>
                ) : null}
                {transferSecretState &&
                "done" in transferSecretState &&
                transferSecretState.password ? (
                  <span className="text-emerald-400">
                    New SFTP password (shown once):{" "}
                    <code className="font-mono text-white select-all">
                      {transferSecretState.password}
                    </code>
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <details className="text-xs">
              <summary className="text-muted hover:text-ink flex min-h-11 cursor-pointer items-center font-medium">
                Provision SFTP account for {user.name}
              </summary>
              <form
                action={transferCreateAction}
                className="mt-2 flex flex-col gap-2.5"
              >
                <input type="hidden" name="userId" value={user.id} />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`create-sftp-user-${user.id}`}
                    className="text-muted text-xs"
                  >
                    SFTP username
                  </label>
                  <input
                    id={`create-sftp-user-${user.id}`}
                    name="username"
                    required
                    minLength={3}
                    maxLength={32}
                    pattern="[a-z][a-z0-9_\-]{2,31}"
                    defaultValue={defaultHandleFromEmail(user.email)}
                    disabled={demo}
                    className="border-line bg-surface min-h-11 rounded px-2.5 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`create-sftp-quota-${user.id}`}
                    className="text-muted shrink-0 text-xs"
                  >
                    Quota (MB):
                  </label>
                  <input
                    id={`create-sftp-quota-${user.id}`}
                    name="quotaMb"
                    type="number"
                    min={QUOTA_MB_MIN}
                    max={QUOTA_MB_MAX}
                    defaultValue={1024}
                    disabled={demo}
                    className="border-line bg-surface min-h-11 w-24 rounded px-2.5 font-mono text-xs"
                  />
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Provisioning"
                    disabled={demo}
                  >
                    Provision SFTP
                    <span className="sr-only"> for {user.email}</span>
                  </SubmitButton>
                </div>
                <div role="status" aria-live="polite" className="text-xs">
                  {transferCreateState && "error" in transferCreateState ? (
                    <span className="text-bad-ink">
                      {transferCreateState.error}
                    </span>
                  ) : null}
                  {transferCreateState && "done" in transferCreateState ? (
                    <span className="text-emerald-400">
                      SFTP account {transferCreateState.username} created.
                      {transferCreateState.password ? (
                        <>
                          {" "}
                          Password:{" "}
                          <code className="font-mono text-white select-all">
                            {transferCreateState.password}
                          </code>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </form>
            </details>
          )}
        </div>

        {/* Mailbox Quota & Provisioning */}
        <div className="border-line/40 bg-surface-raised/30 flex flex-col justify-between gap-3 rounded-lg border p-3.5">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Internal Mailbox</span>
              {mail ? (
                <span
                  className={`text-data text-xs ${mail.enabled ? "text-emerald-400" : "text-rose-300"}`}
                >
                  {mail.enabled ? "Active" : "Disabled"}
                </span>
              ) : (
                <span className="text-data text-muted text-xs">
                  Not provisioned
                </span>
              )}
            </div>
            {mail ? (
              <div className="mt-2 text-xs">
                <p className="text-ink truncate font-mono">{mail.address}</p>
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
            <div className="flex flex-col gap-3">
              <form action={mailQuotaAction} className="flex flex-col gap-2">
                <input type="hidden" name="address" value={mail.address} />
                <div className="flex flex-wrap items-center gap-2">
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
                    min={MAIL_QUOTA_MB_MIN}
                    max={MAIL_QUOTA_MB_MAX}
                    disabled={demo}
                    defaultValue={
                      mail.quotaBytes > 0
                        ? Math.min(
                            MAIL_QUOTA_MB_MAX,
                            Math.round(mail.quotaBytes / (1024 * 1024)),
                          )
                        : 1024
                    }
                    className="border-line bg-surface min-h-11 w-24 rounded px-2.5 font-mono text-xs"
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
                  {mailQuotaState && "error" in mailQuotaState ? (
                    <span className="text-bad-ink">{mailQuotaState.error}</span>
                  ) : null}
                  {mailQuotaState && "done" in mailQuotaState ? (
                    <span className="text-emerald-400">
                      Mailbox limit updated.
                    </span>
                  ) : null}
                </div>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <form action={mailToggleAction}>
                  <input type="hidden" name="address" value={mail.address} />
                  <input
                    type="hidden"
                    name="enabled"
                    value={mail.enabled ? "false" : "true"}
                  />
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Saving"
                    disabled={demo}
                  >
                    {mail.enabled ? "Disable mailbox" : "Enable mailbox"}
                    <span className="sr-only"> for {user.email}</span>
                  </SubmitButton>
                </form>

                <form action={mailSecretAction}>
                  <input type="hidden" name="address" value={mail.address} />
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Rotating"
                    disabled={demo}
                  >
                    New mailbox secret
                    <span className="sr-only"> for {user.email}</span>
                  </SubmitButton>
                </form>
              </div>

              <div role="status" aria-live="polite" className="text-xs">
                {mailToggleState && "error" in mailToggleState ? (
                  <span className="text-bad-ink">{mailToggleState.error}</span>
                ) : null}
                {mailToggleState && "done" in mailToggleState ? (
                  <span className="text-emerald-400">
                    Mailbox {mailToggleState.done}.
                  </span>
                ) : null}
                {mailSecretState && "error" in mailSecretState ? (
                  <span className="text-bad-ink">{mailSecretState.error}</span>
                ) : null}
                {mailSecretState &&
                "done" in mailSecretState &&
                mailSecretState.password ? (
                  <span className="text-emerald-400">
                    New mailbox password (shown once):{" "}
                    <code className="font-mono text-white select-all">
                      {mailSecretState.password}
                    </code>
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <details className="text-xs">
              <summary className="text-muted hover:text-ink flex min-h-11 cursor-pointer items-center font-medium">
                Provision mailbox for {user.name}
              </summary>
              <form
                action={mailCreateAction}
                className="mt-2 flex flex-col gap-2.5"
              >
                <input type="hidden" name="userId" value={user.id} />
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor={`create-mail-local-${user.id}`}
                    className="text-muted text-xs"
                  >
                    Local part (@{MAIL_DOMAIN})
                  </label>
                  <input
                    id={`create-mail-local-${user.id}`}
                    name="localPart"
                    required
                    minLength={3}
                    maxLength={64}
                    pattern="[a-z][a-z0-9._-]{1,62}[a-z0-9]"
                    defaultValue={defaultMailLocalFromEmail(user.email)}
                    disabled={demo}
                    className="border-line bg-surface min-h-11 rounded px-2.5 font-mono text-xs"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={`create-mail-quota-${user.id}`}
                    className="text-muted shrink-0 text-xs"
                  >
                    Quota (MB):
                  </label>
                  <input
                    id={`create-mail-quota-${user.id}`}
                    name="quotaMb"
                    type="number"
                    min={MAIL_QUOTA_MB_MIN}
                    max={MAIL_QUOTA_MB_MAX}
                    defaultValue={512}
                    disabled={demo}
                    className="border-line bg-surface min-h-11 w-24 rounded px-2.5 font-mono text-xs"
                  />
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Provisioning"
                    disabled={demo}
                  >
                    Provision mailbox
                    <span className="sr-only"> for {user.email}</span>
                  </SubmitButton>
                </div>
                <div role="status" aria-live="polite" className="text-xs">
                  {mailCreateState && "error" in mailCreateState ? (
                    <span className="text-bad-ink">
                      {mailCreateState.error}
                    </span>
                  ) : null}
                  {mailCreateState && "done" in mailCreateState ? (
                    <span className="text-emerald-400">
                      Mailbox {mailCreateState.address} created.
                      {mailCreateState.password ? (
                        <>
                          {" "}
                          Password:{" "}
                          <code className="font-mono text-white select-all">
                            {mailCreateState.password}
                          </code>
                        </>
                      ) : null}
                    </span>
                  ) : null}
                </div>
              </form>
            </details>
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
              <summary className="text-muted hover:text-ink flex min-h-11 cursor-pointer items-center font-medium">
                Add public key for {transfer.username}
              </summary>
              <form action={keyAction} className="mt-2 flex flex-col gap-2">
                <input
                  type="hidden"
                  name="username"
                  value={transfer.username}
                />
                <label htmlFor={`ssh-key-${user.id}`} className="sr-only">
                  OpenSSH public key for {transfer.username}
                </label>
                <textarea
                  id={`ssh-key-${user.id}`}
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

function AccountLifecycleDrawer({
  user,
  auditEvents,
  demo,
}: {
  user: ControlUser;
  auditEvents?: readonly AuditEventDto[];
  demo?: boolean;
}) {
  const [nameState, nameAction] = useActionState(updateUserNameAction, null);
  const [deleteState, deleteAction] = useActionState(deleteUserAction, null);

  const userEvents = (auditEvents ?? [])
    .filter(
      (e) =>
        e.actorId === user.id ||
        e.target.includes(user.id) ||
        e.target.toLowerCase().includes(user.email.toLowerCase()),
    )
    .slice(0, 5);

  return (
    <details className="border-line/50 rounded-xl border px-4 py-2 text-xs">
      <summary className="text-muted hover:text-ink flex min-h-11 cursor-pointer items-center font-medium">
        Account settings, activity & removal for {user.email}
      </summary>
      <div className="border-line/40 mt-3 grid gap-6 border-t pt-4 md:grid-cols-2">
        {/* Edit display name */}
        <form action={nameAction} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <label htmlFor={`edit-name-${user.id}`} className="font-medium">
            Display name
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`edit-name-${user.id}`}
              name="name"
              required
              maxLength={120}
              defaultValue={user.name}
              disabled={demo}
              className="border-line bg-surface min-h-11 flex-1 rounded-md border px-3 text-xs"
            />
            <SubmitButton variant="quiet" pendingLabel="Saving" disabled={demo}>
              Save name
              <span className="sr-only"> for {user.email}</span>
            </SubmitButton>
          </div>
          <div role="status" aria-live="polite">
            {nameState && "error" in nameState ? (
              <span className="text-bad-ink">{nameState.error}</span>
            ) : null}
            {nameState && "done" in nameState ? (
              <span className="text-emerald-400">
                Updated name to {nameState.name}.
              </span>
            ) : null}
          </div>
        </form>

        {/* Delete account (CTL-09 exact target confirmation) */}
        <form action={deleteAction} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <label
            htmlFor={`delete-user-${user.id}`}
            className="font-medium text-rose-300"
          >
            Type {user.email} to permanently delete account
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id={`delete-user-${user.id}`}
              name="confirmEmail"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder={user.email}
              disabled={demo}
              className="border-line bg-surface min-h-11 flex-1 rounded-md border px-3 font-mono text-xs"
            />
            <SubmitButton
              variant="quiet"
              pendingLabel="Deleting"
              disabled={demo}
            >
              Delete account
              <span className="sr-only"> {user.email}</span>
            </SubmitButton>
          </div>
          <p className="text-muted text-xs">
            Removes login credentials, sessions, and 2FA secrets. Linked SFTP
            folders and mailboxes are preserved until removed separately.
          </p>
          <div role="status" aria-live="polite">
            {deleteState && "error" in deleteState ? (
              <span className="text-bad-ink">{deleteState.error}</span>
            ) : null}
            {deleteState && "done" in deleteState ? (
              <span className="text-emerald-400">
                Account {deleteState.email} was deleted.
              </span>
            ) : null}
          </div>
        </form>
      </div>

      {auditEvents ? (
        <div className="border-line/40 mt-4 border-t pt-3">
          <p className="text-muted mb-2 font-medium">
            Recent activity involving {user.email}
          </p>
          {userEvents.length === 0 ? (
            <p className="text-muted text-xs">
              No recent audit events recorded for this account in the loaded
              window.
            </p>
          ) : (
            <ul className="divide-line/30 divide-y font-mono text-xs">
              {userEvents.map((ev) => (
                <li
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-1.5"
                >
                  <span className="text-sky-300">{ev.action}</span>
                  <span className="text-muted">
                    {ev.result} · {ev.ts.replace("T", " ").slice(0, 19)} UTC
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </details>
  );
}

/** Complete accounts management in Nexus Control (CTL-02). */
export function ControlUsers({
  users,
  auditEvents,
  serviceRequests,
  demo = false,
}: {
  users: readonly ControlUser[];
  auditEvents?: readonly AuditEventDto[];
  serviceRequests?: readonly UserRequestDto[];
  demo?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const query = search.trim().toLowerCase();
  const filteredUsers = users.filter((u) => {
    if (query) {
      const hay = [
        u.name,
        u.email,
        u.transferAccount?.username ?? "",
        u.mailAccount?.address ?? "",
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    switch (statusFilter) {
      case "active":
        if (u.banned) return false;
        break;
      case "disabled":
        if (!u.banned) return false;
        break;
      case "pending-stage":
        if (!u.stageRequest) return false;
        break;
      case "2fa-enabled":
        if (!u.twoFactorEnabled) return false;
        break;
      case "2fa-missing":
        if (u.twoFactorEnabled) return false;
        break;
    }
    return true;
  });

  const hasActiveFilter =
    query !== "" || roleFilter !== "all" || statusFilter !== "all";

  return (
    <div className="flex flex-col gap-6">
      <UserMetrics users={users} />

      <ServiceRequestsQueue serviceRequests={serviceRequests} demo={demo} />

      <StageUpgradeQueue users={users} demo={demo} />

      <CreateUser demo={demo} />

      {/* Search & Filter Toolbar */}
      <div
        data-user-filters
        className="border-line bg-surface-elevated rounded-xl border p-4"
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="user-filter-search" className="text-xs font-medium">
              Search accounts
            </label>
            <input
              id="user-filter-search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name, email, SFTP or mailbox..."
              className="border-line bg-surface min-h-11 rounded-md border px-3 text-xs"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="user-filter-role" className="text-xs font-medium">
              Filter by role
            </label>
            <select
              id="user-filter-role"
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as "all" | Role)}
              className="border-line bg-surface min-h-11 rounded-md border px-3 text-xs"
            >
              <option value="all">All roles</option>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="user-filter-status" className="text-xs font-medium">
              Filter by status
            </label>
            <select
              id="user-filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="border-line bg-surface min-h-11 rounded-md border px-3 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="active">Active only</option>
              <option value="disabled">Disabled only</option>
              <option value="pending-stage">Pending stage upgrade</option>
              <option value="2fa-enabled">Two-factor enrolled</option>
              <option value="2fa-missing">Two-factor not enrolled</option>
            </select>
          </div>

          <div className="flex items-end justify-between gap-2">
            <span className="text-muted text-data self-center text-xs">
              Showing {filteredUsers.length} of {users.length}
            </span>
            {hasActiveFilter ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("all");
                  setStatusFilter("all");
                }}
                className="border-line hover:border-ink inline-flex min-h-11 items-center rounded-md border px-3 text-xs font-medium transition-colors"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {filteredUsers.length === 0 ? (
        <div className="border-line rounded-xl border p-8 text-center">
          <p className="text-muted text-sm">
            No user accounts match the active search or filter criteria.
          </p>
        </div>
      ) : (
        <ul className="divide-line border-line divide-y border-y">
          {filteredUsers.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-5 py-5"
              data-user-row
            >
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
                      <span className="rounded border border-amber-500/40 bg-amber-500/20 px-1.5 py-0.5 text-xs font-semibold text-amber-300">
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
                    {user.createdAt
                      ? ` · Joined ${user.createdAt.slice(0, 10)}`
                      : ""}
                  </p>
                  {user.banned &&
                  user.banReason &&
                  !user.banReason.startsWith("STAGE_REQUEST:") ? (
                    <p className="mt-1 text-xs text-rose-300">
                      Reason: {user.banReason}
                    </p>
                  ) : null}
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
                      <p className="mt-1.5 text-xs text-amber-300">
                        Use the Promotion Queue above or choose{" "}
                        {ROLE_LABEL[user.stageRequest.role]} in the role
                        selector.
                      </p>
                    </div>
                  ) : null}
                </div>

                {/* ResetPassword MUST stay first <form> in [data-user-row] */}
                <div className="flex min-w-0 flex-1 flex-wrap items-start justify-start gap-2.5 lg:justify-end">
                  <ResetPassword user={user} />
                  <ChangeRole user={user} demo={demo} />
                  <ToggleEnabled user={user} demo={demo} />
                  <ResetTwoFactor user={user} demo={demo} />
                  <RevokeSessions user={user} demo={demo} />
                </div>
              </div>

              {/* Storage Quotas & Service Provisioning per User */}
              <UserStorage user={user} demo={demo} />

              {/* Display Name, Audit History & Account Removal */}
              <AccountLifecycleDrawer
                user={user}
                auditEvents={auditEvents}
                demo={demo}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
