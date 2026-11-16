"use client";

import { useActionState, type ReactNode } from "react";
import { SubmitButton, inputClass } from "@/components/auth/form-parts";
import {
  createMailboxAction,
  deleteMailboxAction,
  resetMailboxPasswordAction,
  setMailboxEnabledAction,
  setMailboxQuotaAction,
} from "@/lib/server/mail-actions";
import {
  QUOTA_MB_MAX,
  QUOTA_MB_MIN,
  type MailAccount,
  type MailActionState,
} from "@/lib/mail";
import { formatBytes } from "@/lib/transfer/format";

export type ControlPerson = { id: string; name: string; email: string };

const DONE_TEXT: Record<
  Extract<MailActionState, { done: string }>["done"],
  (name: string) => string
> = {
  created: (n) => `Mailbox ${n} was created.`,
  password: (n) => `The password of ${n} was reset.`,
  enabled: (n) => `${n} is enabled.`,
  disabled: (n) => `${n} is disabled.`,
  quota: (n) => `The quota of ${n} was changed.`,
  deleted: (n) => `Mailbox ${n} was deleted.`,
};

function Result({ state }: { state: MailActionState }) {
  return (
    <div role="status" aria-live="polite" className="text-data">
      {state && "error" in state ? (
        <span className="text-bad-ink">{state.error}</span>
      ) : null}
      {state && "done" in state ? (
        <span>
          {DONE_TEXT[state.done](state.address)}
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
    previous: MailActionState,
    data: FormData,
  ) => Promise<MailActionState>;
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
      action={createMailboxAction}
      demo={demo}
      className="flex max-w-xl flex-col gap-3"
    >
      <Labelled label="Local part" htmlFor="new-localpart">
        <input
          id="new-localpart"
          name="localPart"
          required
          minLength={3}
          maxLength={64}
          pattern="[a-z][a-z0-9._-]{1,62}[a-z0-9]"
          autoComplete="off"
          spellCheck={false}
          autoCapitalize="none"
          className={inputClass}
          aria-describedby="new-localpart-hint"
        />
        <p id="new-localpart-hint" className="text-muted text-data">
          3 to 64 characters: lowercase letters, digits, dots, hyphens and
          underscores. It becomes the part before @ytl-nexus.internal.
        </p>
      </Labelled>
      <Labelled label="Nexus user (optional)" htmlFor="new-userId">
        <select
          id="new-userId"
          name="userId"
          className={inputClass}
          defaultValue=""
        >
          <option value="">No linked Nexus user (service account)</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.email})
            </option>
          ))}
        </select>
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
        <SubmitButton pendingLabel="Creating">Create mailbox</SubmitButton>
      </div>
    </ActionForm>
  );
}

function AccountRow({
  account,
  owner,
  demo,
}: {
  account: MailAccount;
  owner: ControlPerson | null;
  demo: boolean;
}) {
  const id = account.address;
  return (
    <li className="py-5" data-mail-row={id}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-mono font-medium break-all">{id}</p>
        <p className="text-muted text-data">
          {account.enabled ? "Enabled" : "Disabled"}
          {" · "}
          {owner ? owner.email : "service account"}
        </p>
      </div>
      <p className="text-muted text-data mt-1">
        Storage limit:{" "}
        {account.quotaBytes > 0 ? formatBytes(account.quotaBytes) : "no limit"}
      </p>

      <details className="mt-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">
          Manage {id}
        </summary>
        <div className="mt-3 grid gap-6 lg:grid-cols-2">
          <ActionForm action={setMailboxEnabledAction} demo={demo}>
            <input type="hidden" name="address" value={id} />
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

          <ActionForm action={resetMailboxPasswordAction} demo={demo}>
            <input type="hidden" name="address" value={id} />
            <div>
              <SubmitButton variant="quiet" pendingLabel="Resetting">
                {`Reset password for ${id}`}
              </SubmitButton>
            </div>
          </ActionForm>

          <ActionForm action={setMailboxQuotaAction} demo={demo}>
            <input type="hidden" name="address" value={id} />
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

          <ActionForm action={deleteMailboxAction} demo={demo}>
            <input type="hidden" name="address" value={id} />
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
                Only empty mailboxes can be deleted. A mailbox with stored mail
                must be disabled instead.
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

export function ControlMail({
  accounts,
  people,
  demo,
}: {
  accounts: readonly MailAccount[];
  people: readonly ControlPerson[];
  demo: boolean;
}) {
  const byId = new Map(people.map((p) => [p.id, p]));
  const linked = new Set(
    accounts
      .map((a) => a.nexusUserId)
      .filter((id): id is string => Boolean(id)),
  );
  const available = people.filter((p) => !linked.has(p.id));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="text-lg font-semibold">New mailbox</h3>
        <p className="text-muted text-data mb-3 max-w-(--spacing-prose)">
          Create a virtual mailbox under ytl-nexus.internal. Link it to a team
          member or leave it unlinked for an alerts or service address.
        </p>
        <CreateForm people={available} demo={demo} />
      </div>
      {accounts.length === 0 ? (
        <p className="text-muted">No mailboxes exist yet.</p>
      ) : (
        <ul className="divide-line border-line divide-y border-y">
          {accounts.map((account) => (
            <AccountRow
              key={account.address}
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
