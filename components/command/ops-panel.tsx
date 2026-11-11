"use client";

import { useActionState, useRef, useState } from "react";
import {
  FormError,
  SubmitButton,
  inputClass,
} from "@/components/auth/form-parts";
import { HealthBadge } from "@/components/command/health-badge";
import type { OpsFormState } from "@/lib/ops/form-state";
import {
  HEALTH_CHECK_IDS,
  HEALTH_CHECK_LABEL,
  OPS_UNITS,
  OPS_UNIT_LABEL,
  type OpsUnit,
} from "@/lib/ops/units";
import {
  healthAction,
  logsAction,
  restartAction,
} from "@/lib/server/ops-actions";
import { badgeHealth } from "@/lib/status/format";

// The Operator controls: log viewer, health checks and restart with a
// confirmation (requirement 9.11). Every control is disabled in a demo
// session with an explanation (9.19). The server re-checks the role and writes
// the audit events; hiding this panel from lower roles is presentation only.

function UnitSelect({ id }: { id: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        Service
      </label>
      <select
        id={id}
        name="unit"
        className={inputClass}
        defaultValue={OPS_UNITS[0]}
      >
        {OPS_UNITS.map((u) => (
          <option key={u} value={u}>
            {OPS_UNIT_LABEL[u]} ({u})
          </option>
        ))}
      </select>
    </div>
  );
}

function Result({ state }: { state: OpsFormState }) {
  return (
    <>
      <FormError
        message={state && "error" in state ? state.error : undefined}
      />
      <div role="status" aria-live="polite" className="text-data">
        {state && "done" in state && state.done === "health" ? (
          <span
            className="flex flex-wrap items-center gap-x-3"
            data-health-result
          >
            <HealthBadge
              health={badgeHealth(state.state)}
              label={`${HEALTH_CHECK_LABEL[state.check as keyof typeof HEALTH_CHECK_LABEL] ?? state.check}: ${state.detail}`}
            />
            {state.latencyMs === null ? null : (
              <span className="text-muted">{state.latencyMs} ms</span>
            )}
          </span>
        ) : null}
        {state && "done" in state && state.done === "restart" ? (
          <span data-restart-result>
            Restart of {state.unit} was accepted. It finishes in the background;
            run a health check in a few seconds.
          </span>
        ) : null}
      </div>
    </>
  );
}

function HealthForm({ demo }: { demo: boolean }) {
  const [state, action] = useActionState(healthAction, null);
  return (
    <form action={action} className="flex flex-col gap-3" data-ops-health>
      <fieldset disabled={demo} className="flex flex-col gap-3">
        <legend className="font-semibold">Run a health check</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="ops-check" className="text-sm font-medium">
            Check
          </label>
          <select id="ops-check" name="check" className={inputClass}>
            {HEALTH_CHECK_IDS.map((c) => (
              <option key={c} value={c}>
                {HEALTH_CHECK_LABEL[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <SubmitButton variant="quiet" pendingLabel="Checking">
            Run check
          </SubmitButton>
        </div>
      </fieldset>
      <Result state={state} />
    </form>
  );
}

function LogsForm({ demo }: { demo: boolean }) {
  const [state, action] = useActionState(logsAction, null);
  return (
    <form action={action} className="flex flex-col gap-3" data-ops-logs>
      <fieldset disabled={demo} className="flex flex-col gap-3">
        <legend className="font-semibold">Read recent log lines</legend>
        <UnitSelect id="logs-unit" />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="logs-lines" className="text-sm font-medium">
            Lines (1 to 500)
          </label>
          <input
            id="logs-lines"
            name="lines"
            type="number"
            min={1}
            max={500}
            step={1}
            defaultValue={100}
            required
            inputMode="numeric"
            className={inputClass}
          />
        </div>
        <div>
          <SubmitButton variant="quiet" pendingLabel="Reading">
            Show log
          </SubmitButton>
        </div>
      </fieldset>
      <Result state={state} />
      {state && "done" in state && state.done === "logs" ? (
        <div>
          <p className="text-muted text-data mb-2">
            {state.unit}: {state.lines.length} lines
            {state.truncated ? " (older lines were cut)" : ""}. Secrets, email
            addresses and internal addresses are masked.
          </p>
          <pre
            tabIndex={0}
            aria-label={`Log of ${state.unit}`}
            className="border-line bg-surface max-h-96 overflow-auto rounded-md border p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap"
          >
            {state.lines.length === 0
              ? "No log lines."
              : state.lines.join("\n")}
          </pre>
        </div>
      ) : null}
    </form>
  );
}

function RestartForm({ demo }: { demo: boolean }) {
  const [state, action] = useActionState(restartAction, null);
  const [unit, setUnit] = useState<OpsUnit>(OPS_UNITS[0]);
  const dialog = useRef<HTMLDialogElement>(null);
  return (
    <div className="flex flex-col gap-3" data-ops-restart>
      <fieldset disabled={demo} className="flex flex-col gap-3">
        <legend className="font-semibold">Restart a service</legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="restart-unit" className="text-sm font-medium">
            Service
          </label>
          <select
            id="restart-unit"
            className={inputClass}
            value={unit}
            onChange={(e) => {
              const next = OPS_UNITS.find((u) => u === e.target.value);
              if (next) setUnit(next);
            }}
          >
            {OPS_UNITS.map((u) => (
              <option key={u} value={u}>
                {OPS_UNIT_LABEL[u]} ({u})
              </option>
            ))}
          </select>
        </div>
        <div>
          <button
            type="button"
            onClick={() => dialog.current?.showModal()}
            className="border-border-strong hover:bg-surface-raised min-h-11 rounded-full border px-6 text-sm font-semibold"
          >
            Restart…
          </button>
        </div>
      </fieldset>
      <dialog
        ref={dialog}
        aria-labelledby="restart-title"
        className="border-border-strong bg-surface text-ink m-auto max-w-md rounded-lg border p-6 backdrop:bg-black/60"
      >
        <form action={action} onSubmit={() => dialog.current?.close()}>
          <input type="hidden" name="unit" value={unit} />
          <h3 id="restart-title" className="text-heading-3 font-semibold">
            Restart {OPS_UNIT_LABEL[unit]}?
          </h3>
          <p className="text-muted mt-2">
            The service stops and starts again. Anyone using it is interrupted
            for a few seconds.
            {unit === "nexus-web"
              ? " This page is served by Nexus web, so it will be unavailable for a moment."
              : ""}{" "}
            The request and its result are written to the audit trail.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="border-border-strong hover:bg-surface-raised min-h-11 rounded-full border px-6 text-sm font-semibold"
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

export function OpsPanel({ demo }: { demo: boolean }) {
  return (
    <section
      aria-labelledby="ops-title"
      data-ops-panel
      className="border-line border-t px-(--spacing-gutter) py-10"
    >
      <h2 id="ops-title" className="text-heading-3 font-semibold">
        Operations
      </h2>
      <p className="text-muted text-data mt-2 max-w-(--spacing-prose)">
        Only these predefined actions are available. Nexus has no shell. Every
        request and its result is written to the audit trail.
      </p>
      {demo ? (
        <p
          data-demo-note
          className="border-border-strong mt-4 max-w-(--spacing-prose) border-l-2 pl-4"
        >
          Demo session: operations controls are disabled and nothing is run.
        </p>
      ) : null}
      <div className="mt-8 grid gap-10 lg:grid-cols-3">
        <HealthForm demo={demo} />
        <LogsForm demo={demo} />
        <RestartForm demo={demo} />
      </div>
    </section>
  );
}
