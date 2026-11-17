"use client";

import { useActionState, useState } from "react";
import { requestStageUpgradeAction } from "@/lib/server/auth/actions";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { SubmitButton } from "./form-parts";

export function StageUpgradeBanner({ currentRole }: { currentRole: Role }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(requestStageUpgradeAction, null);

  // If user is already an admin (Stage 3), no upgrade needed
  if (currentRole === "admin") return null;

  const targetRole = currentRole === "member" ? "operator" : "admin";
  const stageNum = currentRole === "member" ? 2 : 3;

  return (
    <div className="mx-(--spacing-gutter) my-4 rounded-xl border border-cyan-500/25 bg-slate-900/60 p-4 backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-cyan-300 uppercase">
              Stage {currentRole === "member" ? 1 : 2}:{" "}
              {ROLE_LABEL[currentRole]}
            </span>
            <span className="text-xs text-slate-400">Platform Role</span>
          </div>
          <p className="mt-1 text-xs text-slate-300">
            {currentRole === "member"
              ? "You have Member privileges (Stage 1). Need system restart, metrics control, or incident management?"
              : "You have Operator privileges (Stage 2). Need platform administration and user management access?"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-300 transition-colors hover:border-cyan-400 hover:bg-cyan-500/20"
        >
          {open
            ? "Close"
            : `Request Stage ${stageNum} (${ROLE_LABEL[targetRole]})`}
        </button>
      </div>

      {open ? (
        <form
          action={action}
          className="mt-4 flex flex-col gap-3 border-t border-slate-800/80 pt-4"
        >
          <input type="hidden" name="role" value={targetRole} />
          <div>
            <label
              htmlFor="reason"
              className="block text-xs font-medium text-slate-200"
            >
              Reason for request (optional):
            </label>
            <input
              id="reason"
              name="reason"
              maxLength={500}
              placeholder="e.g. Need access to manage service restarts and Prometheus metrics"
              className="mt-1 w-full max-w-lg rounded-md border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Submitting request" variant="quiet">
              Submit request for Administrator approval
            </SubmitButton>
            {state && "done" in state ? (
              <span className="text-xs font-medium text-emerald-400">
                Request submitted! An Administrator will review your stage
                promotion in Nexus Control.
              </span>
            ) : null}
            {state && "error" in state ? (
              <span className="text-xs font-medium text-rose-400">
                {state.error}
              </span>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}
