import {
  ASSET_CATEGORIES,
  ASSET_STATUSES,
  SITE_KINDS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from "@/lib/server/db/schema";

// The three tables Nexus Data shows and edits (DAT-01, DAT-02). Pure data and
// validation with no database or server import, so the page, the Server
// Functions and the tests share one definition. Every write passes through
// `recordInput` before any statement runs; the database then re-checks what it
// can (enums, unique keys, foreign keys, NOT NULL).

export const DATA_TABLES = [
  "data_sites",
  "data_assets",
  "data_tickets",
] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export const TABLE_LABEL: Readonly<Record<DataTable, string>> = {
  data_sites: "Sites",
  data_assets: "Assets",
  data_tickets: "Maintenance tickets",
};

export type FieldKind =
  "code" | "text" | "long-text" | "enum" | "reference" | "date";

export type FieldSpec = {
  name: string;
  label: string;
  kind: FieldKind;
  /** Maximum length of text kinds. */
  max?: number;
  /** Values of an enum field. */
  options?: readonly string[];
  /** Required fields reject an empty value; optional ones store null. */
  required: boolean;
  /** Part of the free-text search. */
  searchable?: boolean;
  /** The table a reference points to. */
  references?: DataTable;
};

const CODE = /^[A-Za-z0-9][A-Za-z0-9-]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const REFERENCE = /^[1-9]\d{0,8}$/;
// C0 controls except tab and newline, plus DEL. A notice or a field has no use for them.
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export const FIELDS: Readonly<Record<DataTable, readonly FieldSpec[]>> = {
  data_sites: [
    {
      name: "code",
      label: "Code",
      kind: "code",
      max: 16,
      required: true,
      searchable: true,
    },
    {
      name: "name",
      label: "Name",
      kind: "text",
      max: 120,
      required: true,
      searchable: true,
    },
    {
      name: "city",
      label: "City",
      kind: "text",
      max: 80,
      required: true,
      searchable: true,
    },
    { name: "state", label: "State", kind: "text", max: 80, required: true },
    {
      name: "kind",
      label: "Kind",
      kind: "enum",
      options: SITE_KINDS,
      required: true,
    },
  ],
  data_assets: [
    {
      name: "asset_tag",
      label: "Asset tag",
      kind: "code",
      max: 32,
      required: true,
      searchable: true,
    },
    {
      name: "name",
      label: "Name",
      kind: "text",
      max: 120,
      required: true,
      searchable: true,
    },
    {
      name: "category",
      label: "Category",
      kind: "enum",
      options: ASSET_CATEGORIES,
      required: true,
    },
    {
      name: "site_id",
      label: "Site",
      kind: "reference",
      required: true,
      references: "data_sites",
    },
    {
      name: "status",
      label: "Status",
      kind: "enum",
      options: ASSET_STATUSES,
      required: true,
    },
    {
      name: "vendor",
      label: "Vendor",
      kind: "text",
      max: 100,
      required: true,
      searchable: true,
    },
    { name: "model", label: "Model", kind: "text", max: 100, required: true },
    {
      name: "purchased_on",
      label: "Purchased on",
      kind: "date",
      required: false,
    },
  ],
  data_tickets: [
    {
      name: "ticket_no",
      label: "Ticket number",
      kind: "code",
      max: 24,
      required: true,
      searchable: true,
    },
    {
      name: "title",
      label: "Title",
      kind: "text",
      max: 200,
      required: true,
      searchable: true,
    },
    {
      name: "asset_id",
      label: "Asset",
      kind: "reference",
      required: false,
      references: "data_assets",
    },
    {
      name: "site_id",
      label: "Site",
      kind: "reference",
      required: true,
      references: "data_sites",
    },
    {
      name: "priority",
      label: "Priority",
      kind: "enum",
      options: TICKET_PRIORITIES,
      required: true,
    },
    {
      name: "status",
      label: "Status",
      kind: "enum",
      options: TICKET_STATUSES,
      required: true,
    },
    {
      name: "scheduled_for",
      label: "Scheduled for",
      kind: "date",
      required: false,
    },
    {
      name: "description",
      label: "Description",
      kind: "long-text",
      max: 2000,
      required: true,
    },
  ],
};

export type RecordValue = string | number | null;
export type RecordValues = Record<string, RecordValue>;

export type FieldIssue = { field: string; message: string };

export type InputResult =
  { ok: true; values: RecordValues } | { ok: false; issues: FieldIssue[] };

export function isDataTable(value: unknown): value is DataTable {
  return (
    typeof value === "string" &&
    (DATA_TABLES as readonly string[]).includes(value)
  );
}

export function fieldsOf(table: DataTable): readonly FieldSpec[] {
  return FIELDS[table];
}

export function enumFields(table: DataTable): FieldSpec[] {
  return FIELDS[table].filter((f) => f.kind === "enum");
}

function isRealDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function checkOne(
  spec: FieldSpec,
  raw: string,
): { ok: true; value: RecordValue } | { ok: false; message: string } {
  const value = raw.trim();
  if (value === "") {
    if (spec.required) return { ok: false, message: "Required." };
    return { ok: true, value: null };
  }
  switch (spec.kind) {
    case "code":
      if (value.length > (spec.max ?? 64))
        return { ok: false, message: `Use at most ${spec.max} characters.` };
      if (!CODE.test(value))
        return { ok: false, message: "Use letters, digits and hyphens only." };
      return { ok: true, value };
    case "text":
    case "long-text":
      if (value.length > (spec.max ?? 255))
        return { ok: false, message: `Use at most ${spec.max} characters.` };
      if (CONTROL.test(value))
        return { ok: false, message: "Remove control characters." };
      return { ok: true, value };
    case "enum":
      if (!spec.options?.includes(value))
        return { ok: false, message: "Choose a value from the list." };
      return { ok: true, value };
    case "reference":
      if (!REFERENCE.test(value))
        return { ok: false, message: "Choose a record from the list." };
      return { ok: true, value: Number(value) };
    case "date":
      if (!isRealDate(value))
        return { ok: false, message: "Use a real date as YYYY-MM-DD." };
      return { ok: true, value };
  }
}

/**
 * Checks and types the values of one record. Unknown fields are refused, not
 * ignored, so a crafted request cannot write a column the form does not show.
 */
export function recordInput(
  table: DataTable,
  raw: Record<string, string | undefined>,
): InputResult {
  const specs = FIELDS[table];
  const known = new Set(specs.map((s) => s.name));
  const issues: FieldIssue[] = [];
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) issues.push({ field: key, message: "Unknown field." });
  }
  const values: RecordValues = {};
  for (const spec of specs) {
    const result = checkOne(spec, raw[spec.name] ?? "");
    if (result.ok) values[spec.name] = result.value;
    else issues.push({ field: spec.name, message: result.message });
  }
  return issues.length === 0 ? { ok: true, values } : { ok: false, issues };
}
