"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton, inputClass } from "@/components/auth/form-parts";
import {
  addKeyAction,
  createAccountAction,
  deleteAccountAction,
  removeKeyAction,
  resetPasswordAction,
  setEnabledAction,
  setQuotaAction,
} from "@/lib/server/transfer-actions";
import type { TransferActionState } from "@/lib/transfer/form-state";
import { formatBytes, usagePercent } from "@/lib/transfer/format";
import type { TransferAccount } from "@/lib/transfer/types";
import { MAX_KEYS } from "@/lib/transfer/keys";
import { QUOTA_MB_MAX, QUOTA_MB_MIN } from "@/lib/transfer/validation";

// Nexus Control, file transfer accounts (requirement 12.16). Every control posts
// to a guarded Server Function. In a demo session every control is disabled and
// says why. The messages mirror what the server returns; nothing here decides
// access.

export type ControlPerson = { id: string; name: string; email: string };

const DONE_TEXT: Record<
  Extract<TransferActionState, { done: string }>["done"],
  (name: string) => string
> = {
  created: (n) => `Account ${n} was created.`,
  password: (n) => `The password of ${n} was reset and their sessions ended.`,
  enabled: (n) => `${n} is enabled.`,
  disabled: (n) => `${n} is disabled and was signed out.`,
  quota: (n) => `The quota of ${n} was changed.`,
  deleted: (n) =>
    `The account ${n} was deleted. Its files stay on the server until someone removes the folder.`,
  "key-added": (n) => `A key was added to ${n}.`,
  "key-removed": (n) => `A key was removed from ${n} and its sessions ended.`,
};

function Result({ state }: { state: TransferActionState }) {
  return (
    <div role="status" aria-live="polite" className="text-data">
      {state && "error" in state ? (
        <span className="text-bad-ink">{state.error}</span>
      ) : null}
      {state && "done" in state ? (
        <span>
          {DONE_TEXT[state.done](state.username)}
          {state.password ? (
            <>
              {" "}
              Password, shown once:{" "}
              <code className="font-mono break-all select-all">
                {state.password}
              </code>
              . Pass it on privately.
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function ActionForm({
  action,
  demo,
  className = "flex flex-col gap-2",
  children,
}: {
  action: (
    previous: TransferActionState,
    data: FormData,
  ) => Promise<TransferActionState>;
  demo: boolean;
  className?: string;
  children: ReactNode;
}) {
  const [state, run] = useActionState(action, null);
  return (
    <form action={run} className={className}>
      <fieldset
        disabled={demo}
        className="m-0 flex min-w-0 flex-col gap-2 border-0 p-0"
      >
        {children}
      </fieldset>
      <Result state={state} />
    </form>
  );
}

function Labelled({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

function CreateForm({
  people,
  demo,
}: {
  people: readonly ControlPerson[];
  demo: boolean;
}) {
  return (
    <ActionForm
      action={createAccountAction}
      demo={demo}
      className="flex max-w-xl flex-col gap-3"
    >
      <Labelled label="Nexus account" htmlFor="new-userId">
        <select
          id="new-userId"
          name="userId"
          required
          className={inputClass}
          defaultValue=""
        >
          <option value="" disabled>
            Choose a person
          </option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
      </Labelled>
      <Labelled label="SFTP name" htmlFor="new-username">
        <input
          id="new-username"
          name="username"
          required
          minLength={3}
          maxLength={32}
          pattern="[a-z][a-z0-9_\-]{2,31}"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          className={inputClass}
          aria-describedby="new-username-hint"
        />
        <p id="new-username-hint" className="text-muted text-data">
          3 to 32 characters: lowercase letters, digits, - and _. It becomes the
          name of the account&apos;s folder.
        </p>
      </Labelled>
      <Labelled label="Storage limit (MB)" htmlFor="new-quota">
        <input
          id="new-quota"
          name="quotaMb"
          type="number"
          required
          min={QUOTA_MB_MIN}
          max={QUOTA_MB_MAX}
          defaultValue={1024}
          inputMode="numeric"
          className={inputClass}
        />
      </Labelled>
      <div>
        <SubmitButton pendingLabel="Creating">Create account</SubmitButton>
      </div>
    </ActionForm>
  );
}

function KeyRow({
  account,
  fingerprint,
  label,
  demo,
}: {
  account: string;
  fingerprint: string;
  label: string;
  demo: boolean;
}) {
  return (
    <li className="flex flex-col gap-1 py-2">
      <ActionForm
        action={removeKeyAction}
        demo={demo}
        className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
      >
        <input type="hidden" name="username" value={account} />
        <input type="hidden" name="fingerprint" value={fingerprint} />
        <span className="font-mono text-sm break-all">
          {fingerprint}
          <span className="text-muted font-sans"> · {label}</span>
        </span>
        <SubmitButton variant="quiet" pendingLabel="Removing">
          {`Remove key ${fingerprint.slice(7, 15)}`}
        </SubmitButton>
      </ActionForm>
    </li>
  );
}

function AccountRow({
  account,
  owner,
  demo,
}: {
  account: TransferAccount;
  owner: ControlPerson | null;
  demo: boolean;
}) {
  const percent = usagePercent(account.usedBytes, account.quotaBytes);
  const id = account.username;
  return (
    <li className="py-5" data-transfer-row={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-mono font-medium break-all">{id}</p>
        <p className="text-muted text-data">
          {account.enabled ? "Enabled" : "Disabled"}
          {" · "}
          {owner ? owner.email : "not linked to a Nexus account"}
        </p>
      </div>
      <p className="text-muted text-data mt-1">
        {formatBytes(account.usedBytes)} of{" "}
        {account.quotaBytes > 0 ? formatBytes(account.quotaBytes) : "no limit"}
        {percent !== null ? ` (${percent}%)` : ""}
        {" · "}
        {account.keys.length === 1 ? "1 key" : `${account.keys.length} keys`}
      </p>

      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          Manage {id}
        </summary>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <ActionForm action={setEnabledAction} demo={demo}>
            <input type="hidden" name="username" value={id} />
            <input
              type="hidden"
              name="enabled"
              value={account.enabled ? "false" : "true"}
            />
            <div>
              <SubmitButton variant="quiet" pendingLabel="Saving">
                {account.enabled ? `Disable ${id}` : `Enable ${id}`}
              </SubmitButton>
            </div>
          </ActionForm>

          <ActionForm action={resetPasswordAction} demo={demo}>
            <input type="hidden" name="username" value={id} />
            <div>
              <SubmitButton variant="quiet" pendingLabel="Resetting">
                {`Reset password for ${id}`}
              </SubmitButton>
            </div>
          </ActionForm>

          <ActionForm action={setQuotaAction} demo={demo}>
            <input type="hidden" name="username" value={id} />
            <Labelled label="Storage limit (MB)" htmlFor={`quota-${id}`}>
              <input
                id={`quota-${id}`}
                name="quotaMb"
                type="number"
                required
                min={QUOTA_MB_MIN}
                max={QUOTA_MB_MAX}
                defaultValue={
                  account.quotaBytes > 0
                    ? Math.max(
                        QUOTA_MB_MIN,
                        Math.round(account.quotaBytes / (1024 * 1024)),
                      )
                    : 1024
                }
                inputMode="numeric"
                className={inputClass}
              />
            </Labelled>
            <div>
              <SubmitButton variant="quiet" pendingLabel="Saving">
                {`Set limit for ${id}`}
              </SubmitButton>
            </div>
          </ActionForm>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Public keys ({account.keys.length} of {MAX_KEYS})
            </p>
            {account.keys.length > 0 ? (
              <ul className="divide-line divide-y">
                {account.keys.map((key) => (
                  <KeyRow
                    key={key.fingerprint}
                    account={id}
                    fingerprint={key.fingerprint}
                    label={`${key.type}${key.comment ? ` · ${key.comment}` : ""}`}
                    demo={demo}
                  />
                ))}
              </ul>
            ) : (
              <p className="text-muted text-data">No keys registered.</p>
            )}
            <ActionForm action={addKeyAction} demo={demo}>
              <input type="hidden" name="username" value={id} />
              <Labelled label="Add a public key" htmlFor={`key-${id}`}>
                <textarea
                  id={`key-${id}`}
                  name="publicKey"
                  required
                  rows={3}
                  maxLength={8192}
                  spellCheck={false}
                  autoCapitalize="none"
                  placeholder="ssh-ed25519 AAAA… name@computer"
                  className={`${inputClass} font-mono`}
                />
              </Labelled>
              <div>
                <SubmitButton variant="quiet" pendingLabel="Adding">
                  {`Add key to ${id}`}
                </SubmitButton>
              </div>
            </ActionForm>
          </div>

          <ActionForm action={deleteAccountAction} demo={demo}>
            <input type="hidden" name="username" value={id} />
            <Labelled
              label={`Type ${id} to delete it`}
              htmlFor={`delete-${id}`}
            >
              <input
                id={`delete-${id}`}
                name="confirm"
                required
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                className={inputClass}
                aria-describedby={`delete-${id}-hint`}
              />
              <p id={`delete-${id}-hint`} className="text-muted text-data">
                This removes the login. The files stay on the server until
                someone removes the folder by hand.
              </p>
            </Labelled>
            <div>
              <SubmitButton variant="quiet" pendingLabel="Deleting">
                {`Delete ${id}`}
              </SubmitButton>
            </div>
          </ActionForm>
        </div>
      </details>
    </li>
  );
}

export function ControlTransfer({
  accounts,
  people,
  demo,
}: {
  accounts: readonly TransferAccount[];
  people: readonly ControlPerson[];
  demo: boolean;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const linked = new Set(accounts.map((a) => a.nexusUserId));
  const available = people.filter((p) => !linked.has(p.id));
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-lg font-semibold">New account</h3>
        <p className="text-muted text-data mb-3 max-w-(--spacing-prose)">
          An account is never created on its own. Choose the person, set the
          name and the limit. The first password is shown once.
        </p>
        <CreateForm people={available} demo={demo} />
      </div>
      {accounts.length === 0 ? (
        <p className="text-muted">No file transfer accounts exist yet.</p>
      ) : (
        <ul className="divide-line border-line divide-y border-y">
          {accounts.map((account) => (
            <AccountRow
              key={account.username}
              account={account}
              owner={
                account.nexusUserId
                  ? (byId.get(account.nexusUserId) ?? null)
                  : null
              }
              demo={demo}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
