"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ModuleHero } from "@/components/layout/module-hero";
import { PageTransition } from "@/components/motion/page-transition";
import { SubmitButton, inputClass } from "@/components/auth/form-parts";
import {
  USER_REQUEST_CATEGORIES,
  USER_REQUEST_CATEGORY_LABEL,
  type OwnSessionDto,
  type UserRequestCategory,
  type UserRequestDto,
} from "@/lib/fixtures/account";
import { pageInfo } from "@/lib/navigation/modules";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import {
  cancelUserRequestAction,
  changeOwnPasswordAction,
  revokeOtherSessionsAction,
  submitUserRequestAction,
  updateProfileAction,
} from "@/lib/server/account-actions";
import type { AccountSnapshot } from "@/lib/server/account";
import { QUOTA_MB_MAX, QUOTA_MB_MIN } from "@/lib/transfer/validation";
import { formatBytes } from "@/lib/transfer/format";

function formatTimestamp(iso: string | null): string {
  if (!iso) return "Never";
  return `${iso.replace("T", " ").slice(0, 16)} UTC`;
}

function roleStageLabel(role: Role): string {
  switch (role) {
    case "viewer":
      return "Stage 0 · Viewer";
    case "member":
      return "Stage 1 · Member";
    case "operator":
      return "Stage 2 · Operator";
    case "admin":
      return "Stage 3 · Administrator";
  }
}

function requestStatusBadge(status: UserRequestDto["status"]) {
  switch (status) {
    case "approved":
      return (
        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 uppercase">
          Approved
        </span>
      );
    case "dismissed":
      return (
        <span className="rounded bg-rose-500/20 px-2 py-0.5 text-[11px] font-semibold text-rose-300 uppercase">
          Dismissed
        </span>
      );
    default:
      return (
        <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-300 uppercase">
          Pending review
        </span>
      );
  }
}

function RequestHistoryRow({
  req,
  demo,
}: {
  req: UserRequestDto;
  demo: boolean;
}) {
  const [cancelState, cancelAction] = useActionState(
    cancelUserRequestAction,
    null,
  );

  return (
    <li
      data-account-request-row
      className="border-line/70 bg-surface-elevated/70 flex flex-col gap-3 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {requestStatusBadge(req.status)}
            <span className="border-line bg-surface rounded border px-2 py-0.5 font-mono text-[11px] text-slate-300">
              {USER_REQUEST_CATEGORY_LABEL[req.category]}
            </span>
          </div>
          <p className="text-ink mt-2 text-sm font-semibold">{req.title}</p>
          <p className="text-muted text-data mt-1 text-xs">
            Submitted {formatTimestamp(req.createdAt)}
            {req.requestedRole
              ? ` · Target role: ${ROLE_LABEL[req.requestedRole]}`
              : ""}
            {req.requestedQuotaMb !== undefined
              ? ` · Requested quota: ${req.requestedQuotaMb} MiB`
              : ""}
          </p>
          <p className="text-muted mt-2 text-xs whitespace-pre-wrap">
            {req.reason}
          </p>
          {req.sshPublicKey ? (
            <p className="text-muted mt-1.5 font-mono text-[11px] break-all">
              Key: {req.sshPublicKey.slice(0, 72)}
              {req.sshPublicKey.length > 72 ? "..." : ""}
            </p>
          ) : null}
          {req.resolutionNote ? (
            <p className="mt-2 rounded-md border border-slate-700/60 bg-slate-900/50 px-3 py-2 text-xs text-slate-200">
              <span className="font-semibold">Administrator note:</span>{" "}
              {req.resolutionNote}
              {req.resolvedBy ? ` (${req.resolvedBy})` : ""}
            </p>
          ) : null}
        </div>

        {req.status === "pending" ? (
          <form action={cancelAction} className="shrink-0">
            <input type="hidden" name="requestId" value={req.id} />
            <SubmitButton
              variant="quiet"
              pendingLabel="Withdrawing"
              disabled={demo}
            >
              Withdraw
              <span className="sr-only"> request {req.title}</span>
            </SubmitButton>
          </form>
        ) : null}
      </div>

      <div role="status" aria-live="polite" className="text-xs">
        {cancelState && "error" in cancelState ? (
          <span className="text-bad-ink">{cancelState.error}</span>
        ) : null}
        {cancelState && "done" in cancelState ? (
          <span className="text-emerald-400">
            Request withdrawn from queue.
          </span>
        ) : null}
      </div>
    </li>
  );
}

function SessionRow({ s }: { s: OwnSessionDto }) {
  return (
    <li className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ink font-mono text-xs font-medium">
            {s.ipAddress ?? "Unknown IP"}
          </span>
          {s.current ? (
            <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-[11px] font-semibold text-cyan-300 uppercase">
              Current session
            </span>
          ) : null}
        </div>
        <p className="text-muted mt-0.5 truncate text-xs">
          {s.userAgent ?? "Browser session"}
        </p>
      </div>
      <div className="text-muted text-data shrink-0 text-xs sm:text-right">
        <p>Active {formatTimestamp(s.updatedAt)}</p>
        <p>Expires {formatTimestamp(s.expiresAt)}</p>
      </div>
    </li>
  );
}

export function AccountView({ snapshot }: { snapshot: AccountSnapshot }) {
  const page = pageInfo("/account");
  const {
    demo,
    user,
    profile,
    requests,
    sessions,
    transfer,
    mail,
    auditEvents,
  } = snapshot;

  const [profileState, profileAction] = useActionState(
    updateProfileAction,
    null,
  );
  const [passwordState, passwordAction] = useActionState(
    changeOwnPasswordAction,
    null,
  );
  const [revokeState, revokeAction] = useActionState(
    revokeOtherSessionsAction,
    null,
  );
  const [requestState, requestAction] = useActionState(
    submitUserRequestAction,
    null,
  );

  const [category, setCategory] = useState<UserRequestCategory>("role-upgrade");
  const nextUpgrades: Role[] = ROLES.filter((r) => {
    if (user.role === "viewer")
      return r === "member" || r === "operator" || r === "admin";
    if (user.role === "member") return r === "operator" || r === "admin";
    if (user.role === "operator") return r === "admin";
    return false;
  });

  const pendingRequestsCount = requests.filter(
    (r) => r.status === "pending",
  ).length;
  const otherSessionsCount = sessions.filter((s) => !s.current).length;

  return (
    <PageTransition>
      <div>
        <ModuleHero page={page} register="workspace" />
        <div className="flex flex-col gap-10 px-(--spacing-gutter) py-8">
          {demo ? (
            <div className="border-line bg-surface-elevated rounded-xl border px-4 py-3">
              <p className="text-muted text-data text-xs">
                Demo session ({ROLE_LABEL[user.role]}): profile edits, password
                changes and request submissions are shown for preview only and
                do not modify a live database.
              </p>
            </div>
          ) : null}

          {/* 1. Identity & Status KPI Summary */}
          <section
            aria-labelledby="overview-title"
            data-account-overview
            className="flex flex-col gap-4"
          >
            <h2 id="overview-title" className="text-heading-3 font-semibold">
              Account overview
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="border-line bg-surface-elevated rounded-xl border p-4">
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Identity & Stage
                </p>
                <p className="font-display text-ink mt-1 truncate text-xl font-semibold">
                  {user.name}
                </p>
                <p className="text-muted text-data mt-1 truncate text-xs">
                  {user.email}
                </p>
                <span className="mt-2 inline-block rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-300">
                  {roleStageLabel(user.role)}
                </span>
              </div>

              <div className="border-line bg-surface-elevated rounded-xl border p-4">
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Security Posture
                </p>
                <p className="font-display text-ink mt-1 text-xl font-semibold">
                  {user.twoFactorEnabled ? "2FA Active" : "2FA Optional"}
                </p>
                <p className="text-muted text-data mt-1 text-xs">
                  {sessions.length}{" "}
                  {sessions.length === 1 ? "active session" : "active sessions"}
                </p>
              </div>

              <div className="border-line bg-surface-elevated rounded-xl border p-4">
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Subsystems
                </p>
                <p className="font-display text-ink mt-1 text-xl font-semibold">
                  {transfer.state === "ready" ? "SFTP Ready" : "No SFTP"}
                </p>
                <p className="text-muted text-data mt-1 text-xs">
                  Mail:{" "}
                  {mail.state === "ready" ? mail.account.address : "Not linked"}
                </p>
              </div>

              <div className="border-line bg-surface-elevated rounded-xl border p-4">
                <p className="text-muted text-xs font-medium tracking-wider uppercase">
                  Service Requests
                </p>
                <p className="font-display text-ink mt-1 text-xl font-semibold">
                  {pendingRequestsCount} pending
                </p>
                <p className="text-muted text-data mt-1 text-xs">
                  {requests.length} total tracked{" "}
                  {requests.length === 1 ? "request" : "requests"}
                </p>
              </div>
            </div>
          </section>

          {/* 2. Profile & Team Details */}
          <section
            aria-labelledby="profile-title"
            data-account-profile
            className="border-line bg-surface-elevated rounded-xl border p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 id="profile-title" className="text-heading-3 font-semibold">
                  Edit profile
                </h2>
                <p className="text-muted mt-1 text-sm">
                  Update your display name, role details, contact information,
                  and default SSH public key.
                </p>
              </div>
              {profile.updatedAt ? (
                <span className="text-muted text-data text-xs">
                  Last saved {formatTimestamp(profile.updatedAt)}
                </span>
              ) : null}
            </div>

            <form action={profileAction} className="mt-5 flex flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-name" className="text-xs font-medium">
                    Full display name
                  </label>
                  <input
                    id="profile-name"
                    name="name"
                    required
                    maxLength={120}
                    defaultValue={user.name}
                    disabled={demo}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="profile-email"
                    className="text-xs font-medium"
                  >
                    Account email (read-only)
                  </label>
                  <input
                    id="profile-email"
                    type="email"
                    readOnly
                    disabled
                    value={user.email}
                    className={`${inputClass} opacity-65`}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-job" className="text-xs font-medium">
                    Job title / team role
                  </label>
                  <input
                    id="profile-job"
                    name="jobTitle"
                    maxLength={120}
                    defaultValue={profile.jobTitle}
                    placeholder="e.g. Network Operations Engineer"
                    disabled={demo}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-dept" className="text-xs font-medium">
                    Department / business unit
                  </label>
                  <input
                    id="profile-dept"
                    name="department"
                    maxLength={120}
                    defaultValue={profile.department}
                    placeholder="e.g. IT Infrastructure"
                    disabled={demo}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="profile-phone"
                    className="text-xs font-medium"
                  >
                    Contact number / extension
                  </label>
                  <input
                    id="profile-phone"
                    name="phone"
                    maxLength={40}
                    defaultValue={profile.phone}
                    placeholder="+60 3-2099 xxxx"
                    disabled={demo}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="profile-ssh" className="text-xs font-medium">
                    Default OpenSSH public key (optional)
                  </label>
                  <input
                    id="profile-ssh"
                    name="sshPublicKey"
                    maxLength={4096}
                    defaultValue={profile.sshPublicKey}
                    placeholder="ssh-ed25519 AAAAC3..."
                    disabled={demo}
                    className={`${inputClass} font-mono text-xs`}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-bio" className="text-xs font-medium">
                  Operational responsibilities & notes
                </label>
                <textarea
                  id="profile-bio"
                  name="bio"
                  rows={3}
                  maxLength={600}
                  defaultValue={profile.bio}
                  placeholder="Describe what systems or shifts you cover..."
                  disabled={demo}
                  className="border-border-strong bg-surface text-ink placeholder:text-muted w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <SubmitButton pendingLabel="Saving profile" disabled={demo}>
                  Save profile changes
                </SubmitButton>
                <div role="status" aria-live="polite" className="text-xs">
                  {profileState && "error" in profileState ? (
                    <span className="text-bad-ink">{profileState.error}</span>
                  ) : null}
                  {profileState && "done" in profileState ? (
                    <span className="text-emerald-400">
                      Profile saved for {profileState.name}.
                    </span>
                  ) : null}
                </div>
              </div>
            </form>
          </section>

          {/* 3. Submit & Track Requests */}
          <section
            id="requests"
            aria-labelledby="requests-title"
            data-account-requests
            className="flex flex-col gap-6"
          >
            <div>
              <h2 id="requests-title" className="text-heading-3 font-semibold">
                Submit a request
              </h2>
              <p className="text-muted mt-1 max-w-(--spacing-prose) text-sm">
                Members, Operators and Viewers can submit role promotion, SFTP
                provisioning, SSH key registration, mailbox, quota, or general
                access requests directly to Nexus Control administrators.
              </p>
            </div>

            <form
              action={requestAction}
              className="border-line bg-surface-elevated flex flex-col gap-4 rounded-xl border p-5 sm:p-6"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="request-category"
                    className="text-xs font-medium"
                  >
                    Request category
                  </label>
                  <select
                    id="request-category"
                    name="category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as UserRequestCategory)
                    }
                    className={inputClass}
                  >
                    {USER_REQUEST_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {USER_REQUEST_CATEGORY_LABEL[cat]}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="request-title"
                    className="text-xs font-medium"
                  >
                    Request summary
                  </label>
                  <input
                    id="request-title"
                    name="title"
                    required
                    minLength={3}
                    maxLength={160}
                    placeholder="e.g. Enable SFTP transfer folder for shift backups"
                    disabled={demo}
                    className={inputClass}
                  />
                </div>
              </div>

              {category === "role-upgrade" ? (
                <div className="flex flex-col gap-1.5 sm:max-w-sm">
                  <label htmlFor="request-role" className="text-xs font-medium">
                    Target stage / role
                  </label>
                  {nextUpgrades.length === 0 ? (
                    <p className="text-muted text-xs">
                      You already hold Administrator (Stage 3) privileges.
                    </p>
                  ) : (
                    <select
                      id="request-role"
                      name="requestedRole"
                      defaultValue={nextUpgrades[0]}
                      className={inputClass}
                    >
                      {nextUpgrades.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : null}

              {category === "sftp-quota" || category === "mail-quota" ? (
                <div className="flex flex-col gap-1.5 sm:max-w-sm">
                  <label
                    htmlFor="request-quota"
                    className="text-xs font-medium"
                  >
                    Requested quota (MiB)
                  </label>
                  <input
                    id="request-quota"
                    name="requestedQuotaMb"
                    type="number"
                    required
                    min={QUOTA_MB_MIN}
                    max={QUOTA_MB_MAX}
                    defaultValue={category === "sftp-quota" ? 4096 : 1024}
                    disabled={demo}
                    className={inputClass}
                  />
                </div>
              ) : null}

              {category === "sftp-key" ? (
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="request-key" className="text-xs font-medium">
                    OpenSSH public key (.pub)
                  </label>
                  <textarea
                    id="request-key"
                    name="sshPublicKey"
                    required
                    rows={2}
                    maxLength={4096}
                    defaultValue={profile.sshPublicKey}
                    placeholder="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAI..."
                    disabled={demo}
                    className="border-border-strong bg-surface text-ink placeholder:text-muted w-full rounded-md border px-3 py-2 font-mono text-xs"
                  />
                </div>
              ) : null}

              <div className="flex flex-col gap-1.5">
                <label htmlFor="request-reason" className="text-xs font-medium">
                  Operational justification & details
                </label>
                <textarea
                  id="request-reason"
                  name="reason"
                  required
                  minLength={5}
                  rows={3}
                  maxLength={800}
                  placeholder="Explain why you need this change, expected duration, or relevant incident/project context..."
                  disabled={demo}
                  className="border-border-strong bg-surface text-ink placeholder:text-muted w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <SubmitButton
                  pendingLabel="Submitting request"
                  disabled={
                    demo ||
                    (category === "role-upgrade" && nextUpgrades.length === 0)
                  }
                >
                  Submit request
                </SubmitButton>
                <div role="status" aria-live="polite" className="text-xs">
                  {requestState && "error" in requestState ? (
                    <span className="text-bad-ink">{requestState.error}</span>
                  ) : null}
                  {requestState && "done" in requestState ? (
                    <span className="text-emerald-400">
                      Submitted &ldquo;{requestState.title}&rdquo;. An
                      Administrator will review it in Nexus Control.
                    </span>
                  ) : null}
                </div>
              </div>
            </form>

            {/* Submitted Requests History */}
            <div className="flex flex-col gap-3" data-account-request-list>
              <h3 className="text-base font-semibold">
                Your submitted requests ({requests.length})
              </h3>
              {requests.length === 0 ? (
                <p className="border-line text-muted rounded-xl border p-6 text-sm">
                  You have not submitted any requests yet. Use the form above to
                  request role upgrades, SFTP/mail accounts, or operational
                  access.
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {requests.map((req) => (
                    <RequestHistoryRow key={req.id} req={req} demo={demo} />
                  ))}
                </ul>
              )}
            </div>
          </section>

          {/* 4. Security: Password & Two-Factor */}
          <section
            aria-labelledby="security-title"
            data-account-security
            className="grid gap-6 lg:grid-cols-2"
          >
            <div className="border-line bg-surface-elevated flex flex-col gap-4 rounded-xl border p-5 sm:p-6">
              <div>
                <h2
                  id="security-title"
                  className="text-heading-3 font-semibold"
                >
                  Change password
                </h2>
                <p className="text-muted mt-1 text-sm">
                  Minimum 12 characters. Requires your current password to
                  verify ownership.
                </p>
              </div>

              <form action={passwordAction} className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="current-password"
                    className="text-xs font-medium"
                  >
                    Current password
                  </label>
                  <input
                    id="current-password"
                    name="currentPassword"
                    type="password"
                    required
                    autoComplete="current-password"
                    maxLength={128}
                    disabled={demo}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="new-password" className="text-xs font-medium">
                    New password
                  </label>
                  <input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    maxLength={128}
                    disabled={demo}
                    className={inputClass}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="text-xs font-medium"
                  >
                    Confirm new password
                  </label>
                  <input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={12}
                    autoComplete="new-password"
                    maxLength={128}
                    disabled={demo}
                    className={inputClass}
                  />
                </div>
                <label className="flex min-h-11 items-center gap-2.5 text-xs">
                  <input
                    type="checkbox"
                    name="revokeOthers"
                    value="true"
                    defaultChecked
                    disabled={demo}
                    className="size-4 rounded border-slate-600"
                  />
                  <span>Sign out all other active sessions</span>
                </label>

                <div className="flex flex-wrap items-center gap-4">
                  <SubmitButton
                    pendingLabel="Updating password"
                    disabled={demo}
                  >
                    Update password
                  </SubmitButton>
                  <div role="status" aria-live="polite" className="text-xs">
                    {passwordState && "error" in passwordState ? (
                      <span className="text-bad-ink">
                        {passwordState.error}
                      </span>
                    ) : null}
                    {passwordState && "done" in passwordState ? (
                      <span className="text-emerald-400">
                        Password updated
                        {passwordState.revokedOthers
                          ? " and other sessions signed out."
                          : "."}
                      </span>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>

            {/* Two-Factor & Linked Services */}
            <div className="flex flex-col gap-6">
              <div className="border-line bg-surface-elevated flex flex-col gap-3 rounded-xl border p-5 sm:p-6">
                <h3 className="text-base font-semibold">
                  Two-factor authentication (TOTP)
                </h3>
                <p className="text-muted text-sm">
                  {user.twoFactorEnabled
                    ? "Your authenticator app is active on this account. If you lose access to your device, an Administrator can reset 2FA in Nexus Control."
                    : "Two-factor authentication adds an authenticator code check at sign-in and is mandatory for Administrator elevation."}
                </p>
                {!user.twoFactorEnabled && !demo ? (
                  <Link
                    href="/signin?step=enrol&next=%2Faccount"
                    className="border-border-strong hover:bg-surface-raised inline-flex min-h-11 items-center self-start rounded-full border px-5 text-xs font-semibold transition-colors"
                  >
                    Enable two-factor authentication →
                  </Link>
                ) : null}
              </div>

              <div className="border-line bg-surface-elevated flex flex-col gap-3 rounded-xl border p-5 sm:p-6">
                <h3 className="text-base font-semibold">
                  Connected platform subsystems
                </h3>
                <div className="grid gap-3 text-xs sm:grid-cols-2">
                  <div className="border-line/60 bg-surface rounded-lg border p-3">
                    <p className="text-muted">Nexus Transfer (SFTPGo)</p>
                    <p className="text-ink mt-1 font-mono font-medium">
                      {transfer.state === "ready"
                        ? `${transfer.account.username} · ${formatBytes(transfer.account.usedBytes)} / ${
                            transfer.account.quotaBytes > 0
                              ? formatBytes(transfer.account.quotaBytes)
                              : "Unlimited"
                          }`
                        : transfer.state === "no-account"
                          ? "Not provisioned"
                          : "Unavailable"}
                    </p>
                    <Link
                      href="/transfer"
                      className="mt-2 inline-flex min-h-11 items-center text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                    >
                      Open Nexus Transfer →
                    </Link>
                  </div>

                  <div className="border-line/60 bg-surface rounded-lg border p-3">
                    <p className="text-muted">Nexus Mail</p>
                    <p className="text-ink mt-1 font-mono font-medium">
                      {mail.state === "ready"
                        ? `${mail.account.address} · ${
                            mail.account.quotaBytes > 0
                              ? formatBytes(mail.account.quotaBytes)
                              : "Unlimited"
                          }`
                        : mail.state === "no-mailbox"
                          ? "Not provisioned"
                          : "Unavailable"}
                    </p>
                    <Link
                      href="/mail"
                      className="mt-2 inline-flex min-h-11 items-center text-cyan-300 underline underline-offset-4 hover:text-cyan-200"
                    >
                      Open Nexus Mail →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Active Sessions */}
          <section
            aria-labelledby="sessions-title"
            data-account-sessions
            className="border-line bg-surface-elevated rounded-xl border p-5 sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2
                  id="sessions-title"
                  className="text-heading-3 font-semibold"
                >
                  Active sessions ({sessions.length})
                </h2>
                <p className="text-muted mt-1 text-sm">
                  Sessions end automatically after 30 minutes of inactivity or
                  12 hours total.
                </p>
              </div>
              {otherSessionsCount > 0 ? (
                <form action={revokeAction}>
                  <SubmitButton
                    variant="quiet"
                    pendingLabel="Signing out"
                    disabled={demo}
                  >
                    Sign out {otherSessionsCount} other{" "}
                    {otherSessionsCount === 1 ? "session" : "sessions"}
                  </SubmitButton>
                </form>
              ) : null}
            </div>

            <div role="status" aria-live="polite" className="mt-2 text-xs">
              {revokeState && "error" in revokeState ? (
                <span className="text-bad-ink">{revokeState.error}</span>
              ) : null}
              {revokeState && "done" in revokeState ? (
                <span className="text-emerald-400">
                  Signed out {revokeState.revokedCount} other{" "}
                  {revokeState.revokedCount === 1 ? "session" : "sessions"}.
                </span>
              ) : null}
            </div>

            {sessions.length === 0 ? (
              <p className="text-muted mt-4 text-sm">
                No active sessions recorded.
              </p>
            ) : (
              <ul className="divide-line/60 mt-4 divide-y border-t border-b border-slate-800/70">
                {sessions.map((s) => (
                  <SessionRow key={s.id} s={s} />
                ))}
              </ul>
            )}
          </section>

          {/* 6. Recent Personal Audit Activity */}
          <section
            aria-labelledby="personal-audit-title"
            data-account-audit
            className="border-line bg-surface-elevated rounded-xl border p-5 sm:p-6"
          >
            <h2
              id="personal-audit-title"
              className="text-heading-3 font-semibold"
            >
              Your recent security & request activity
            </h2>
            {auditEvents.length === 0 ? (
              <p className="text-muted mt-3 text-sm">
                No recent account events recorded yet.
              </p>
            ) : (
              <ul className="divide-line/50 mt-4 divide-y font-mono text-xs">
                {auditEvents.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-cyan-300">{ev.action}</span>
                      <span className="text-muted">({ev.target})</span>
                    </div>
                    <span className="text-muted">
                      {ev.result} · {formatTimestamp(ev.ts)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
