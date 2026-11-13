"use client";

import { useActionState, type ReactNode } from "react";
import {
  FormError,
  SubmitButton,
  inputClass,
} from "@/components/auth/form-parts";
import {
  FIELDS,
  TABLE_LABEL,
  type DataTable,
  type FieldSpec,
} from "@/lib/data/tables";
import {
  createRecordAction,
  deleteRecordAction,
  updateRecordAction,
  type DataActionState,
} from "@/lib/server/data-actions";
import type { DataRow, ReferenceOptions } from "@/lib/server/data";

// Client forms for Nexus Data (DAT-02). Each one posts to a Server Function,
// which checks the role and validates the input again. The field list comes
// from the table definitions, so the form and the validation cannot drift.
// A demo session shows the controls disabled with the reason.

const DEMO_NOTE = "Demo session: changes are shown but nothing is saved.";

function valueOf(row: DataRow | undefined, field: FieldSpec): string {
  if (!row) return "";
  const value = row[field.name];
  return value === null || value === undefined ? "" : String(value);
}

function FieldInput({
  field,
  defaultValue,
  options,
  disabled,
  invalid,
}: {
  field: FieldSpec;
  defaultValue: string;
  options: ReferenceOptions;
  disabled: boolean;
  invalid: boolean;
}) {
  const id = `field-${field.name}`;
  const common = {
    id,
    name: field.name,
    defaultValue,
    disabled,
    required: field.required,
    "aria-invalid": invalid || undefined,
    className: inputClass,
  };
  let control: ReactNode;
  switch (field.kind) {
    case "enum":
      control = (
        <select {...common}>
          {!field.required ? <option value="">None</option> : null}
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
      break;
    case "reference": {
      const list = field.references ? (options[field.references] ?? []) : [];
      control = (
        <select {...common}>
          {!field.required ? <option value="">None</option> : null}
          {list.map((o) => (
            <option key={o.id} value={String(o.id)}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "long-text":
      control = <textarea {...common} rows={4} maxLength={field.max} />;
      break;
    case "date":
      control = <input {...common} type="date" />;
      break;
    default:
      control = <input {...common} type="text" maxLength={field.max} />;
  }
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {field.label}
        {field.required ? null : (
          <span className="text-muted"> (optional)</span>
        )}
      </label>
      {control}
    </div>
  );
}

function FormMessages({ state }: { state: DataActionState }) {
  const error = state && "error" in state ? state.error : undefined;
  const done = state && "done" in state ? state.done : undefined;
  return (
    <>
      <FormError message={error} />
      {done ? (
        <p role="status" className="text-accent-ink text-sm font-medium">
          {done === "created"
            ? "Record added."
            : done === "updated"
              ? "Record saved."
              : "Record deleted."}
        </p>
      ) : null}
    </>
  );
}

function invalidFields(state: DataActionState): string[] {
  return state && "fields" in state && state.fields ? state.fields : [];
}

export function RecordForm({
  table,
  mode,
  row,
  options,
  demo,
}: {
  table: DataTable;
  mode: "create" | "update";
  row?: DataRow;
  options: ReferenceOptions;
  demo: boolean;
}) {
  const [state, action] = useActionState(
    mode === "create" ? createRecordAction : updateRecordAction,
    null,
  );
  const bad = invalidFields(state);
  return (
    <form
      action={action}
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2"
      aria-label={`${mode === "create" ? "New" : "Edit"} ${TABLE_LABEL[table]}`}
    >
      <input type="hidden" name="table" value={table} />
      {row ? <input type="hidden" name="id" value={row.id} /> : null}
      {FIELDS[table].map((field) => (
        <div
          key={field.name}
          className={field.kind === "long-text" ? "md:col-span-2" : undefined}
        >
          <FieldInput
            field={field}
            defaultValue={valueOf(row, field)}
            options={options}
            disabled={demo}
            invalid={bad.includes(field.name)}
          />
        </div>
      ))}
      <div className="flex flex-col gap-3 md:col-span-2">
        {demo ? (
          <p className="text-muted text-sm" data-demo-note>
            {DEMO_NOTE}
          </p>
        ) : null}
        <FormMessages state={state} />
        <div>
          <fieldset disabled={demo} className="contents">
            <SubmitButton pendingLabel="Saving">
              {mode === "create" ? "Add record" : "Save changes"}
            </SubmitButton>
          </fieldset>
        </div>
      </div>
    </form>
  );
}

export function DeleteRecordForm({
  table,
  id,
  demo,
}: {
  table: DataTable;
  id: number;
  demo: boolean;
}) {
  const [state, action] = useActionState(deleteRecordAction, null);
  return (
    <form
      action={action}
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        if (!window.confirm("Delete this record? This cannot be undone."))
          event.preventDefault();
      }}
    >
      <input type="hidden" name="table" value={table} />
      <input type="hidden" name="id" value={id} />
      <FormError
        message={state && "error" in state ? state.error : undefined}
      />
      {state && "done" in state ? (
        <p role="status" className="text-sm font-medium">
          Record deleted.
        </p>
      ) : null}
      <div>
        <fieldset disabled={demo} className="contents">
          <SubmitButton variant="quiet" pendingLabel="Deleting">
            Delete record
          </SubmitButton>
        </fieldset>
      </div>
    </form>
  );
}
