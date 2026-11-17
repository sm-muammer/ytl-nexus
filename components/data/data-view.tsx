import Link from "next/link";
import { DeleteRecordForm, RecordForm } from "@/components/data/record-forms";
import type { SchemaView } from "@/lib/data/schema-view";
import { PAGE_SIZE, type ListQuery } from "@/lib/data/query";
import {
  DATA_TABLES,
  enumFields,
  FIELDS,
  TABLE_LABEL,
  type DataTable,
  type FieldSpec,
} from "@/lib/data/tables";
import {
  EXPORT_LIMIT,
  type ChangeEntry,
  type DataRow,
  type ListResult,
  type ReferenceOptions,
} from "@/lib/server/data";

// Server-rendered Nexus Data page (DAT-01 to DAT-05). The forms are client
// components; everything else works without JavaScript: search, filters and
// pagination are plain GET links and a GET form.

export type DataViewProps = {
  query: ListQuery;
  list: ListResult;
  options: ReferenceOptions;
  schema: SchemaView;
  changes: ChangeEntry[];
  canWrite: boolean;
  demo: boolean;
};

/** The current address with some parameters replaced. Empty values are left out. */
function hrefFor(
  query: ListQuery,
  patch: {
    page?: number;
    table?: DataTable;
    filters?: Record<string, string>;
  } = {},
): string {
  const params = new URLSearchParams();
  params.set("table", patch.table ?? query.table);
  if (query.q && !patch.table) params.set("q", query.q);
  for (const [name, value] of Object.entries(patch.filters ?? query.filters)) {
    if (value !== "") params.set(name, value);
  }
  const page = patch.page ?? (patch.table ? 1 : query.page);
  if (page > 1) params.set("page", String(page));
  return `/data?${params.toString()}`;
}

function formatTime(ts: number): string {
  return `${new Date(ts).toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function cellText(
  row: DataRow,
  field: FieldSpec,
  options: ReferenceOptions,
): string {
  const value = row[field.name];
  if (value === null || value === undefined) return "";
  if (field.kind === "reference" && field.references) {
    const label = options[field.references]?.find((o) => o.id === value)?.label;
    return label ?? String(value);
  }
  return String(value);
}

function Tabs({ current }: { current: DataTable }) {
  return (
    <nav aria-label="Tables" className="flex flex-wrap gap-2">
      {DATA_TABLES.map((t) => (
        <Link
          key={t}
          href={`/data?table=${t}`}
          aria-current={t === current ? "page" : undefined}
          className={`rounded-full border px-4 py-2 text-sm font-medium ${
            t === current
              ? "border-accent-ink bg-surface-raised"
              : "border-border-strong"
          }`}
        >
          {TABLE_LABEL[t]}
        </Link>
      ))}
    </nav>
  );
}

function FilterForm({ query }: { query: ListQuery }) {
  return (
    <form
      method="get"
      action="/data"
      className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3 md:grid-cols-[minmax(0,2fr)_repeat(auto-fit,minmax(0,1fr))_auto]"
    >
      <input type="hidden" name="table" value={query.table} />
      <div className="flex flex-col gap-1">
        <label htmlFor="data-q" className="text-sm font-medium">
          Search
        </label>
        <input
          id="data-q"
          name="q"
          defaultValue={query.q}
          maxLength={100}
          className="border-border-strong bg-surface min-h-11 rounded-md border px-3"
        />
      </div>
      {enumFields(query.table).map((field) => (
        <div key={field.name} className="flex flex-col gap-1">
          <label htmlFor={`data-${field.name}`} className="text-sm font-medium">
            {field.label}
          </label>
          <select
            id={`data-${field.name}`}
            name={field.name}
            defaultValue={query.filters[field.name] ?? ""}
            className="border-border-strong bg-surface min-h-11 rounded-md border px-3"
          >
            <option value="">All</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex items-end gap-3">
        <button
          type="submit"
          className="border-border-strong min-h-11 rounded-full border px-5 text-sm font-semibold"
        >
          Apply
        </button>
        <Link href={`/data?table=${query.table}`} className="text-sm underline">
          Clear
        </Link>
      </div>
    </form>
  );
}

function RecordTable({ props }: { props: DataViewProps }) {
  const { query, list, options, canWrite, demo } = props;
  const fields = FIELDS[query.table];
  return (
    <div
      role="region"
      aria-label={`${TABLE_LABEL[query.table]} records`}
      tabIndex={0}
      className="relative min-w-0 overflow-x-auto"
    >
      <table className="w-full min-w-max text-left text-sm">
        <thead>
          <tr className="border-border-strong border-b">
            <th scope="col" className="px-3 py-2">
              ID
            </th>
            {fields.map((f) => (
              <th key={f.name} scope="col" className="px-3 py-2">
                {f.label}
              </th>
            ))}
            {canWrite ? (
              <th scope="col" className="px-3 py-2">
                Change
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {list.rows.length === 0 ? (
            <tr>
              <td
                colSpan={fields.length + (canWrite ? 2 : 1)}
                className="text-muted px-3 py-6"
              >
                No records match. Clear the search or filters to see more.
              </td>
            </tr>
          ) : null}
          {list.rows.map((row) => (
            <tr key={row.id} className="border-border border-b align-top">
              <th scope="row" className="px-3 py-2 font-medium">
                {row.id}
              </th>
              {fields.map((f) => (
                <td key={f.name} className="max-w-xs px-3 py-2">
                  {cellText(row, f, options)}
                </td>
              ))}
              {canWrite ? (
                <td className="px-3 py-2">
                  <details className="flex flex-col gap-3">
                    <summary className="cursor-pointer font-medium underline">
                      Edit record {row.id}
                    </summary>
                    <RecordForm
                      table={query.table}
                      mode="update"
                      row={row}
                      options={options}
                      demo={demo}
                    />
                  </details>
                  <div className="mt-3">
                    <DeleteRecordForm
                      table={query.table}
                      id={row.id}
                      demo={demo}
                    />
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pagination({ query, list }: { query: ListQuery; list: ListResult }) {
  return (
    <nav aria-label="Pages" className="flex items-center gap-4 text-sm">
      {list.page > 1 ? (
        <Link
          href={hrefFor(query, { page: list.page - 1 })}
          className="underline"
        >
          Previous page
        </Link>
      ) : (
        <span className="text-muted">Previous page</span>
      )}
      <span>
        Page {list.page} of {list.pages}
      </span>
      {list.page < list.pages ? (
        <Link
          href={hrefFor(query, { page: list.page + 1 })}
          className="underline"
        >
          Next page
        </Link>
      ) : (
        <span className="text-muted">Next page</span>
      )}
    </nav>
  );
}

function ChangesList({
  changes,
  demo,
}: {
  changes: ChangeEntry[];
  demo: boolean;
}) {
  return (
    <section
      aria-labelledby="data-changes"
      className="flex min-w-0 flex-col gap-3"
    >
      <h2 id="data-changes" className="text-heading-3 font-semibold">
        Recent changes
      </h2>
      {changes.length === 0 ? (
        <p className="text-muted">
          {demo
            ? "Demo session: no change is recorded."
            : "No changes have been made through Nexus Data yet."}
        </p>
      ) : (
        <div
          role="region"
          aria-label="Recent changes"
          tabIndex={0}
          className="relative min-w-0 overflow-x-auto"
        >
          <table className="w-full min-w-max text-left text-sm">
            <thead>
              <tr className="border-border-strong border-b">
                <th scope="col" className="px-3 py-2">
                  When
                </th>
                <th scope="col" className="px-3 py-2">
                  Action
                </th>
                <th scope="col" className="px-3 py-2">
                  Record
                </th>
                <th scope="col" className="px-3 py-2">
                  Result
                </th>
                <th scope="col" className="px-3 py-2">
                  Role
                </th>
              </tr>
            </thead>
            <tbody>
              {changes.map((c) => (
                <tr
                  key={`${c.ts}-${c.action}-${c.target}`}
                  className="border-border border-b"
                >
                  <td className="px-3 py-2">{formatTime(c.ts)}</td>
                  <td className="px-3 py-2">{c.action}</td>
                  <td className="px-3 py-2">{c.target}</td>
                  <td className="px-3 py-2">{c.result}</td>
                  <td className="px-3 py-2">{c.role ?? "none"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SchemaSection({ schema }: { schema: SchemaView }) {
  return (
    <details className="flex min-w-0 flex-col gap-4">
      <summary className="text-heading-3 cursor-pointer font-semibold">
        Schema (read-only)
      </summary>
      {schema.tables.map((t) => (
        <div key={t.name} className="flex min-w-0 flex-col gap-2">
          <h3 className="font-semibold">
            {t.label} <span className="text-muted font-normal">({t.name})</span>
          </h3>
          <div
            role="region"
            aria-label={`${t.name} columns`}
            tabIndex={0}
            className="relative min-w-0 overflow-x-auto"
          >
            <table className="w-full min-w-max text-left text-sm">
              <thead>
                <tr className="border-border-strong border-b">
                  <th scope="col" className="px-3 py-2">
                    Column
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Nullable
                  </th>
                  <th scope="col" className="px-3 py-2">
                    Key
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.columns.map((c) => (
                  <tr key={c.name} className="border-border border-b">
                    <td className="px-3 py-2">{c.name}</td>
                    <td className="px-3 py-2">{c.type}</td>
                    <td className="px-3 py-2">{c.nullable ? "yes" : "no"}</td>
                    <td className="px-3 py-2">{c.key || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {t.relations.length > 0 ? (
            <ul className="list-disc pl-6 text-sm">
              {t.relations.map((r) => (
                <li key={r.column}>
                  {r.column} refers to {r.references}.{r.referencedColumn}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </details>
  );
}

export function DataView(props: DataViewProps) {
  const { query, list, schema, changes, canWrite, demo, options } = props;
  const exportParams = hrefFor(query).split("?")[1] ?? "";
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-10 px-(--spacing-gutter) py-10">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-heading-2 font-semibold">Nexus Data</h1>
        </div>
        <p className="text-muted max-w-(--spacing-prose)">
          The supervisor asked for a MySQL database with some data. Nexus Core
          01 runs MariaDB 10.5, which speaks the MySQL protocol, so the database
          is MariaDB. The <code>ytl_nexus</code> database holds three tables of
          generic demonstration records. Viewers read them. Operators add,
          change and delete records, and every change is written to the audit
          trail below.
        </p>
      </div>

      <Tabs current={query.table} />

      <section aria-label="Records" className="flex min-w-0 flex-col gap-6">
        <FilterForm query={query} />
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span>
            {list.total} {list.total === 1 ? "record" : "records"}, {PAGE_SIZE}{" "}
            per page
          </span>
          <a
            href={`/api/data/export?${exportParams}`}
            className="border-border-strong rounded-full border px-4 py-2 font-medium"
          >
            Download CSV
          </a>
          <span className="text-muted">
            The export holds up to {EXPORT_LIMIT.toLocaleString("en-GB")}{" "}
            matching rows.
          </span>
        </div>
        <RecordTable props={props} />
        <Pagination query={query} list={list} />
        {canWrite ? (
          <details className="flex flex-col gap-4">
            <summary className="text-heading-3 cursor-pointer font-semibold">
              Add a record
            </summary>
            <RecordForm
              table={query.table}
              mode="create"
              options={options}
              demo={demo}
            />
          </details>
        ) : null}
      </section>

      <ChangesList changes={changes} demo={demo} />
      <SchemaSection schema={schema} />
    </div>
  );
}
