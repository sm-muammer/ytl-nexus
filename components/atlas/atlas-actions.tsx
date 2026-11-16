"use client";

import { useActionState, useRef } from "react";
import Link from "next/link";
import { SubmitButton } from "@/components/auth/form-parts";
import { Result } from "@/components/command/ops-panel";
import { allowedActions } from "@/lib/atlas/actions";
import type { Role } from "@/lib/roles";
import {
  healthAction,
  logsAction,
  restartAction,
} from "@/lib/server/ops-actions";

// The actions Task 9 allows for one service (ATL-03). Every button goes through
// the same Server Functions as /command/services, which check the role again,
// call the operations agent and write the audit events.

const quiet =
  "border-border-strong hover:bg-surface-raised min-h-11 rounded-full border px-6 text-sm font-semibold disabled:opacity-60";

function HealthButton({
  check,
  label,
  enabled,
}: {
  check: string;
  label: string;
  enabled: boolean;
}) {
  const [state, action] = useActionState(healthAction, null);
  return (
    <form action={action} className="flex flex-col gap-2" data-atlas-health>
      <input type="hidden" name="check" value={check} />
      <fieldset disabled={!enabled}>
        <legend className="sr-only">{label}</legend>
        <SubmitButton variant="quiet" pendingLabel="Checking">
          {label}
        </SubmitButton>
      </fieldset>
      <Result state={state} />
    </form>
  );
}

function LogsButton({
  unit,
  label,
  enabled,
}: {
  unit: string;
  label: string;
  enabled: boolean;
}) {
  const [state, action] = useActionState(logsAction, null);
  return (
    <form action={action} className="flex flex-col gap-2" data-atlas-logs>
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="lines" value="50" />
      <fieldset disabled={!enabled}>
        <legend className="sr-only">{label}</legend>
        <SubmitButton variant="quiet" pendingLabel="Reading">
          {label}
        </SubmitButton>
      </fieldset>
      <Result state={state} />
      {state && "done" in state && state.done === "logs" ? (
        <pre
          tabIndex={0}
          aria-label={`Log of ${state.unit}`}
          className="border-line bg-surface max-h-64 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
        >
          {state.lines.length === 0 ? "No log lines." : state.lines.join("\n")}
        </pre>
      ) : null}
    </form>
  );
}

function RestartButton({
  unit,
  label,
  enabled,
}: {
  unit: string;
  label: string;
  enabled: boolean;
}) {
  const [state, action] = useActionState(restartAction, null);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="flex flex-col gap-2" data-atlas-restart>
      <div>
        <button
          type="button"
          disabled={!enabled}
          onClick={() => dialog.current?.showModal()}
          className={quiet}
        >
          {label}…
        </button>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby={`atlas-restart-${unit}`}
        className="border-border-strong bg-surface text-ink m-auto max-w-md rounded-lg border p-6 backdrop:bg-black/60"
      >
        <form action={action} onSubmit={() => dialog.current?.close()}>
          <input type="hidden" name="unit" value={unit} />
          <h3
            id={`atlas-restart-${unit}`}
            className="text-heading-3 font-semibold"
          >
            {label}?
          </h3>
          <p className="text-muted mt-2">
            The service stops and starts again. Anyone using it, and every
            service that depends on it, is interrupted for a few seconds.
            {unit === "nexus-web"
              ? " This page is served by Nexus web, so it will be unavailable for a moment."
              : ""}{" "}
            The request and its result are written to the audit trail.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className={quiet}
            >
              Cancel
            </button>
            <SubmitButton pendingLabel="Restarting">
              Confirm restart
            </SubmitButton>
          </div>
        </form>
      </dialog>
      <Result state={state} />
    </div>
  );
}

export function AtlasActions({
  slug,
  role,
  demo,
}: {
  slug: string;
  role: Role | null;
  demo: boolean;
}) {
  const set = allowedActions(slug, role ? { userId: "", role } : null, demo);
  const explainPrompt = encodeURIComponent(
    `Explain service "${slug}": current health, architecture role, and troubleshooting steps.`,
  );

  return (
    <div data-atlas-actions className="flex flex-col gap-4">
      {role ? (
        <div>
          <Link
            href={`/ai?explain=${explainPrompt}`}
            className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition-colors"
          >
            <span>✨</span>
            <span>Explain with Nexus AI</span>
          </Link>
        </div>
      ) : null}
      {set.note ? (
        <p data-actions-note className="text-muted text-data">
          {set.note}
        </p>
      ) : null}
      {set.actions.map((a) =>
        a.kind === "health" ? (
          <HealthButton
            key={a.kind}
            check={a.target}
            label={a.label}
            enabled={set.enabled}
          />
        ) : a.kind === "logs" ? (
          <LogsButton
            key={a.kind}
            unit={a.target}
            label={a.label}
            enabled={set.enabled}
          />
        ) : (
          <RestartButton
            key={a.kind}
            unit={a.target}
            label={a.label}
            enabled={set.enabled}
          />
        ),
      )}
    </div>
  );
}
