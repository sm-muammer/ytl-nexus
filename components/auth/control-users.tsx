"use client";

import { useActionState } from "react";
import {
  resetPasswordAction,
  revokeSessionsAction,
} from "@/lib/server/control-actions";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { SubmitButton } from "./form-parts";

export type ControlUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  activeSessions: number;
};

function ResetPassword({ user }: { user: ControlUser }) {
  const [state, action] = useActionState(resetPasswordAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <SubmitButton variant="quiet" pendingLabel="Resetting">
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

function RevokeSessions({ user }: { user: ControlUser }) {
  const [state, action] = useActionState(revokeSessionsAction, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="userId" value={user.id} />
      <SubmitButton variant="quiet" pendingLabel="Ending">
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

/** The accounts and the two actions available in Task 6. */
export function ControlUsers({ users }: { users: readonly ControlUser[] }) {
  return (
    <ul className="divide-line border-line divide-y border-y">
      {users.map((user) => (
        <li
          key={user.id}
          className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-start"
          data-user-row
        >
          <div className="min-w-0">
            <p className="font-medium break-words">{user.name}</p>
            <p className="text-muted text-data break-all">{user.email}</p>
            <p className="text-muted text-data mt-1">
              {ROLE_LABEL[user.role]}
              {" · "}
              {user.twoFactorEnabled
                ? "Two-factor on"
                : "Two-factor not set up"}
              {" · "}
              {user.activeSessions === 1
                ? "1 active session"
                : `${user.activeSessions} active sessions`}
            </p>
          </div>
          <ResetPassword user={user} />
          <RevokeSessions user={user} />
        </li>
      ))}
    </ul>
  );
}
