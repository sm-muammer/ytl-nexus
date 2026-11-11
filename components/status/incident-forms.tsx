"use client";

import { useActionState } from "react";
import {
  FormError,
  SubmitButton,
  inputClass,
} from "@/components/auth/form-parts";
import {
  openIncidentAction,
  updateIncidentAction,
} from "@/lib/server/status-actions";
import { INCIDENT_STATES, type IncidentState } from "@/lib/status/types";

const STATE_TEXT: Record<IncidentState, string> = {
  open: "Open",
  investigating: "Investigating",
  monitoring: "Monitoring",
  resolved: "Resolved",
};

function DemoNote({ demo }: { demo: boolean }) {
  return demo ? (
    <p className="text-muted text-data" data-demo-note>
      Demo session: incident controls are disabled. Nothing is saved.
    </p>
  ) : null;
}

export function OpenIncidentForm({
  services,
  demo,
}: {
  services: ReadonlyArray<{ slug: string; name: string }>;
  demo: boolean;
}) {
  const [state, action] = useActionState(openIncidentAction, null);
  return (
    <form
      action={action}
      className="flex max-w-xl flex-col gap-4"
      data-open-incident
    >
      <fieldset disabled={demo} className="flex flex-col gap-4">
        <legend className="text-heading-3 font-semibold">
          Open an incident
        </legend>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="open-service" className="text-sm font-medium">
            Service
          </label>
          <select
            id="open-service"
            name="serviceSlug"
            required
            className={inputClass}
          >
            {services.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="open-title" className="text-sm font-medium">
            Title
          </label>
          <input
            id="open-title"
            name="title"
            required
            minLength={3}
            maxLength={200}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="open-body" className="text-sm font-medium">
            What is happening
          </label>
          <textarea
            id="open-body"
            name="body"
            required
            maxLength={2000}
            rows={3}
            className={inputClass}
          />
        </div>
        <div>
          <SubmitButton pendingLabel="Opening">Open incident</SubmitButton>
        </div>
      </fieldset>
      <DemoNote demo={demo} />
      <div role="status" aria-live="polite" className="text-data">
        {state && "done" in state ? <span>Incident opened.</span> : null}
      </div>
      <FormError
        message={state && "error" in state ? state.error : undefined}
      />
    </form>
  );
}

export function UpdateIncidentForm({
  id,
  current,
  demo,
}: {
  id: number;
  current: IncidentState;
  demo: boolean;
}) {
  const [state, action] = useActionState(updateIncidentAction, null);
  return (
    <details className="group">
      <summary className="text-data hover:text-ink inline-flex min-h-11 cursor-pointer items-center font-medium underline-offset-4 hover:underline md:min-h-6">
        Post an update
      </summary>
      <form action={action} className="mt-3 flex max-w-xl flex-col gap-3">
        <fieldset disabled={demo} className="flex flex-col gap-3">
          <legend className="sr-only">Update incident {id}</legend>
          <input type="hidden" name="id" value={id} />
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`state-${id}`} className="text-sm font-medium">
              State
            </label>
            <select
              id={`state-${id}`}
              name="state"
              defaultValue=""
              className={inputClass}
            >
              <option value="">Keep as {STATE_TEXT[current]}</option>
              {INCIDENT_STATES.filter((s) => s !== current).map((s) => (
                <option key={s} value={s}>
                  Change to {STATE_TEXT[s]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`body-${id}`} className="text-sm font-medium">
              Update
            </label>
            <textarea
              id={`body-${id}`}
              name="body"
              required
              maxLength={2000}
              rows={3}
              className={inputClass}
            />
          </div>
          <div>
            <SubmitButton variant="quiet" pendingLabel="Saving">
              Post update
            </SubmitButton>
          </div>
        </fieldset>
        <DemoNote demo={demo} />
        <div role="status" aria-live="polite" className="text-data">
          {state && "done" in state ? <span>Update posted.</span> : null}
        </div>
        <FormError
          message={state && "error" in state ? state.error : undefined}
        />
      </form>
    </details>
  );
}
