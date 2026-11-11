"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  DATA_TABLES,
  recordInput,
  type DataTable,
  type RecordValues,
} from "@/lib/data/tables";
import { getDb } from "@/lib/server/db";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from "@/lib/server/data-writes";

// Operators and Administrators create, change and delete records (DAT-02).
// Each Server Function: checks the role (policy row `data.record.*`), validates
// the input with Zod and the table definitions, writes one row change and one
// audit event. Demo sessions refuse before any database call.

export type DataActionState =
  | null
  | { done: "created" | "updated" | "deleted"; id: number }
  | { error: string; fields?: string[] };

const tableSchema = z.enum(DATA_TABLES);
const idSchema = z.coerce.number().int().positive().max(999_999_999);
const rawValues = z.record(z.string().max(64), z.string().max(4000));

/** Checks the values against the table definitions; each problem is reported on its field. */
function typedValues(
  table: DataTable,
  values: Record<string, string>,
  ctx: z.RefinementCtx,
): RecordValues | typeof z.NEVER {
  const result = recordInput(table, values);
  if (result.ok) return result.values;
  for (const issue of result.issues) {
    ctx.addIssue({
      code: "custom",
      path: ["values", issue.field],
      message: issue.message,
    });
  }
  return z.NEVER;
}

const createInput = z
  .object({ table: tableSchema, values: rawValues })
  .transform((input, ctx) => ({
    table: input.table,
    values: typedValues(input.table, input.values, ctx),
  }));

const updateInput = z
  .object({ table: tableSchema, id: idSchema, values: rawValues })
  .transform((input, ctx) => ({
    table: input.table,
    id: input.id,
    values: typedValues(input.table, input.values, ctx),
  }));

const deleteInput = z.object({ table: tableSchema, id: idSchema });

const MESSAGES: Record<string, string> = {
  demo: "Demo session: nothing is saved.",
  "not-found": "That record no longer exists. Reload the table.",
  duplicate: "Another record already uses that code or number.",
  "missing-reference": "The linked site or asset does not exist.",
  "in-use":
    "This record is still used by another record and cannot be deleted.",
  forbidden: "Your role does not allow this change.",
  unauthenticated: "Sign in again to make this change.",
  "invalid-input": "Check the highlighted fields.",
  failed: "The change could not be saved. Nothing was changed.",
};

function dataMessage(error: string): string {
  return MESSAGES[error] ?? MESSAGES.failed!;
}

/** Field names from the guard's validation paths, e.g. "values.code" becomes "code". */
function fieldsFrom(paths: readonly string[] | undefined): string[] {
  return (paths ?? []).map((p) => p.replace(/^values\./, ""));
}

const create = guardAction(
  { id: "data.record.create", schema: createInput, target: (i) => i.table },
  async (input) => {
    if (getMode() === "demo") return { ok: false as const, error: "demo" };
    const result = await createRecord(getDb(), input.table, input.values);
    if (!result.ok) return { ok: false as const, error: result.error };
    revalidatePath("/data");
    return { ok: true as const, id: result.id };
  },
);

const update = guardAction(
  {
    id: "data.record.update",
    schema: updateInput,
    target: (i) => `${i.table}:${i.id}`,
  },
  async (input) => {
    if (getMode() === "demo") return { ok: false as const, error: "demo" };
    const result = await updateRecord(
      getDb(),
      input.table,
      input.id,
      input.values,
    );
    if (!result.ok) return { ok: false as const, error: result.error };
    revalidatePath("/data");
    return { ok: true as const, id: result.id };
  },
);

const remove = guardAction(
  {
    id: "data.record.delete",
    schema: deleteInput,
    target: (i) => `${i.table}:${i.id}`,
  },
  async (input) => {
    if (getMode() === "demo") return { ok: false as const, error: "demo" };
    const result = await deleteRecord(getDb(), input.table, input.id);
    if (!result.ok) return { ok: false as const, error: result.error };
    revalidatePath("/data");
    return { ok: true as const, id: result.id };
  },
);

/** Form fields other than the table and id, all as strings. */
function valuesFrom(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "table" || key === "id" || typeof value !== "string") continue;
    values[key] = value;
  }
  return values;
}

function failure(result: {
  error: string;
  fields?: readonly string[];
}): DataActionState {
  const fields = fieldsFrom(result.fields);
  const base = dataMessage(result.error);
  return {
    error: fields.length > 0 ? `${base} (${fields.join(", ")})` : base,
    fields,
  };
}

export async function createRecordAction(
  _previous: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const result = await create({
    table: formData.get("table") ?? undefined,
    values: valuesFrom(formData),
  });
  return result.ok ? { done: "created", id: result.id } : failure(result);
}

export async function updateRecordAction(
  _previous: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const result = await update({
    table: formData.get("table") ?? undefined,
    id: formData.get("id") ?? undefined,
    values: valuesFrom(formData),
  });
  return result.ok ? { done: "updated", id: result.id } : failure(result);
}

export async function deleteRecordAction(
  _previous: DataActionState,
  formData: FormData,
): Promise<DataActionState> {
  const result = await remove({
    table: formData.get("table") ?? undefined,
    id: formData.get("id") ?? undefined,
  });
  return result.ok ? { done: "deleted", id: result.id } : failure(result);
}
