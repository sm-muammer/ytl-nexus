import "server-only";
import { sql, type Kysely, type RawBuilder } from "kysely";
import {
  DATA_TABLES,
  FIELDS,
  TABLE_LABEL,
  type DataTable,
  type RecordValue,
} from "@/lib/data/tables";
import { PAGE_SIZE, type ListQuery } from "@/lib/data/query";
import { schemaFromDefinitions, type SchemaView } from "@/lib/data/schema-view";
import { demoRows } from "@/lib/fixtures/data";
import { getDb } from "@/lib/server/db";
import type { Database } from "@/lib/server/db/schema";
import { getMode } from "@/lib/server/mode";

// The one reader of Nexus Data (DAT-01, DAT-03, DAT-04). Every statement is
// built with Kysely's `sql` tag: values are bound parameters, and identifiers
// (table and column names) come only from the definitions in lib/data/tables,
// never from the request. Reads run as `nexus_app`.

export const EXPORT_LIMIT = 5000;
const CHANGES_SHOWN = 10;

export type DataRow = { id: number } & Record<string, RecordValue>;

export type ListResult = {
  source: "live" | "demo";
  rows: DataRow[];
  total: number;
  page: number;
  pages: number;
};

export type ChangeEntry = {
  ts: number;
  action: string;
  target: string;
  result: string;
  role: string | null;
};

const DATE_KINDS = new Set(["date"]);

/** Turns a driver row into the DTO: ids as numbers, dates as YYYY-MM-DD. */
export function toDataRow(
  table: DataTable,
  raw: Record<string, unknown>,
): DataRow {
  const row: Record<string, RecordValue> = {};
  for (const field of FIELDS[table]) {
    const value = raw[field.name];
    if (value === null || value === undefined) row[field.name] = null;
    else if (DATE_KINDS.has(field.kind)) {
      row[field.name] =
        value instanceof Date
          ? value.toISOString().slice(0, 10)
          : String(value).slice(0, 10);
    } else if (field.kind === "reference") row[field.name] = Number(value);
    else row[field.name] = String(value);
  }
  return { id: Number(raw.id), ...row };
}

/** WHERE clause for the search text and enum filters. */
function conditions(query: ListQuery): RawBuilder<unknown> {
  const parts: RawBuilder<unknown>[] = [];
  const searchable = FIELDS[query.table].filter((f) => f.searchable);
  if (query.q !== "") {
    const pattern = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    parts.push(
      sql`(${sql.join(
        searchable.map((f) => sql`${sql.ref(f.name)} LIKE ${pattern}`),
        sql` OR `,
      )})`,
    );
  }
  for (const [name, value] of Object.entries(query.filters)) {
    parts.push(sql`${sql.ref(name)} = ${value}`);
  }
  if (parts.length === 0) return sql``;
  return sql`WHERE ${sql.join(parts, sql` AND `)}`;
}

function selectedColumns(table: DataTable): RawBuilder<unknown> {
  return sql.join(
    [sql.ref("id"), ...FIELDS[table].map((f) => sql.ref(f.name))],
    sql`, `,
  );
}

/** One page of records, in id order. */
export async function readPage(
  db: Kysely<Database>,
  query: ListQuery,
): Promise<Omit<ListResult, "source">> {
  const where = conditions(query);
  const counted = await sql<{ n: number | string }>`
    SELECT COUNT(*) AS n FROM ${sql.table(query.table)} ${where}`.execute(db);
  const total = Number(counted.rows[0]?.n ?? 0);
  const offset = (query.page - 1) * PAGE_SIZE;
  const rows = await sql<Record<string, unknown>>`
    SELECT ${selectedColumns(query.table)} FROM ${sql.table(query.table)} ${where}
    ORDER BY id ASC LIMIT ${PAGE_SIZE} OFFSET ${offset}`.execute(db);
  return {
    rows: rows.rows.map((r) => toDataRow(query.table, r)),
    total,
    page: query.page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}

/** Every row of the filtered view for the CSV export, capped at EXPORT_LIMIT. */
export async function readAllRows(
  db: Kysely<Database>,
  query: ListQuery,
): Promise<{ rows: DataRow[]; truncated: boolean }> {
  const where = conditions(query);
  const rows = await sql<Record<string, unknown>>`
    SELECT ${selectedColumns(query.table)} FROM ${sql.table(query.table)} ${where}
    ORDER BY id ASC LIMIT ${EXPORT_LIMIT + 1}`.execute(db);
  const truncated = rows.rows.length > EXPORT_LIMIT;
  return {
    rows: rows.rows
      .slice(0, EXPORT_LIMIT)
      .map((r) => toDataRow(query.table, r)),
    truncated,
  };
}

/** The schema from information_schema: columns, keys and foreign keys of the three tables. */
export async function readSchema(db: Kysely<Database>): Promise<SchemaView> {
  const names = sql.join(DATA_TABLES.map((t) => sql`${t}`));
  const columns = await sql<{
    TABLE_NAME: string;
    COLUMN_NAME: string;
    COLUMN_TYPE: string;
    IS_NULLABLE: string;
    COLUMN_KEY: string;
  }>`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${names})
    ORDER BY TABLE_NAME, ORDINAL_POSITION`.execute(db);
  const relations = await sql<{
    TABLE_NAME: string;
    COLUMN_NAME: string;
    REFERENCED_TABLE_NAME: string;
    REFERENCED_COLUMN_NAME: string;
  }>`
    SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME IS NOT NULL
      AND TABLE_NAME IN (${names})`.execute(db);
  return {
    tables: DATA_TABLES.map((name) => ({
      name,
      label: TABLE_LABEL[name],
      columns: columns.rows
        .filter((c) => c.TABLE_NAME === name)
        .map((c) => ({
          name: c.COLUMN_NAME,
          type: c.COLUMN_TYPE,
          nullable: c.IS_NULLABLE === "YES",
          key: c.COLUMN_KEY,
        })),
      relations: relations.rows
        .filter((r) => r.TABLE_NAME === name)
        .map((r) => ({
          column: r.COLUMN_NAME,
          references: r.REFERENCED_TABLE_NAME,
          referencedColumn: r.REFERENCED_COLUMN_NAME,
        })),
    })),
  };
}

/** The latest changes made through Nexus Data, from the audit trail. */
export async function readChanges(
  db: Kysely<Database>,
): Promise<ChangeEntry[]> {
  const rows = await sql<{
    ts: Date;
    action: string;
    target: string;
    result: string;
    role: string | null;
  }>`
    SELECT ts, action, target, result, role FROM audit_events
    WHERE action LIKE 'data.record.%'
    ORDER BY ts DESC, id DESC LIMIT ${CHANGES_SHOWN}`.execute(db);
  return rows.rows.map((r) => ({
    ts: r.ts.getTime(),
    action: r.action,
    target: r.target,
    result: r.result,
    role: r.role,
  }));
}

// ---- Entry points used by the page and the export route ----------------------

/** The demo rows that match the same search and filters the live query uses. */
function demoMatches(query: ListQuery): DataRow[] {
  const needle = query.q.toLowerCase();
  const searchable = FIELDS[query.table].filter((f) => f.searchable);
  return demoRows(query.table)
    .filter((row) => {
      if (needle === "") return true;
      return searchable.some((f) =>
        String(row[f.name] ?? "")
          .toLowerCase()
          .includes(needle),
      );
    })
    .filter((row) =>
      Object.entries(query.filters).every(
        ([name, value]) => row[name] === value,
      ),
    )
    .map((r) => toDataRow(query.table, r));
}

function demoPage(query: ListQuery): Omit<ListResult, "source"> {
  const all = demoMatches(query);
  const start = (query.page - 1) * PAGE_SIZE;
  return {
    rows: all.slice(start, start + PAGE_SIZE),
    total: all.length,
    page: query.page,
    pages: Math.max(1, Math.ceil(all.length / PAGE_SIZE)),
  };
}

export async function getPage(query: ListQuery): Promise<ListResult> {
  if (getMode() === "demo") return { source: "demo", ...demoPage(query) };
  return { source: "live", ...(await readPage(getDb(), query)) };
}

export async function getExportRows(
  query: ListQuery,
): Promise<{ rows: DataRow[]; truncated: boolean }> {
  if (getMode() === "demo") {
    const all = demoMatches(query);
    return {
      rows: all.slice(0, EXPORT_LIMIT),
      truncated: all.length > EXPORT_LIMIT,
    };
  }
  return readAllRows(getDb(), query);
}

export type ReferenceOption = { id: number; label: string };

/** Options for every reference field of a table, keyed by the table they point to. */
export type ReferenceOptions = Partial<Record<DataTable, ReferenceOption[]>>;

const OPTION_CODE: Partial<Record<DataTable, "code" | "asset_tag">> = {
  data_sites: "code",
  data_assets: "asset_tag",
};

const OPTION_LIMIT = 500;

async function readOptions(
  db: Kysely<Database>,
  table: DataTable,
): Promise<ReferenceOption[]> {
  const codeColumn = OPTION_CODE[table];
  if (!codeColumn) return [];
  const rows = await sql<{ id: number; code: string; name: string }>`
    SELECT id, ${sql.ref(codeColumn)} AS code, name FROM ${sql.table(table)}
    ORDER BY id ASC LIMIT ${OPTION_LIMIT}`.execute(db);
  return rows.rows.map((r) => ({
    id: Number(r.id),
    label: `${r.code} · ${r.name}`,
  }));
}

/** The records a form can point to: the sites and assets a table references. */
export async function getReferenceOptions(
  table: DataTable,
): Promise<ReferenceOptions> {
  const targets = [
    ...new Set(
      FIELDS[table].flatMap((f) => (f.references ? [f.references] : [])),
    ),
  ];
  const out: ReferenceOptions = {};
  if (getMode() === "demo") {
    for (const target of targets) {
      out[target] = demoRows(target).map((r) => ({
        id: r.id,
        label: `${String(r[OPTION_CODE[target] ?? "code"])} · ${String(r.name ?? "")}`,
      }));
    }
    return out;
  }
  const db = getDb();
  for (const target of targets) out[target] = await readOptions(db, target);
  return out;
}

export async function getSchema(): Promise<SchemaView> {
  if (getMode() === "demo") return schemaFromDefinitions();
  return readSchema(getDb());
}

export async function getChanges(): Promise<ChangeEntry[]> {
  if (getMode() === "demo") return [];
  return readChanges(getDb());
}
