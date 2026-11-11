import { enumFields, isDataTable, type DataTable } from "@/lib/data/tables";

// Reads the list page's address (`?table=&q=&page=&status=`). Everything the
// database sees comes from here: the table is a known name, the search text is
// trimmed and bounded, and a filter must be an enum value of that table.

export const PAGE_SIZE = 25;
export const MAX_PAGE = 10000;
export const MAX_SEARCH = 100;

export type ListQuery = {
  table: DataTable;
  q: string;
  page: number;
  /** Enum filters by field name. */
  filters: Record<string, string>;
};

type Params = Record<string, string | string[] | undefined>;

export type ListQueryResult =
  { ok: true; query: ListQuery } | { ok: false; reason: string };

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? undefined : value;
}

/** Escapes LIKE wildcards so a search for "50%" matches that text and no more. */
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function parseListQuery(params: Params): ListQueryResult {
  const tableParam = single(params.table) ?? "data_assets";
  if (!isDataTable(tableParam)) return { ok: false, reason: "unknown-table" };
  const table = tableParam;

  const q = (single(params.q) ?? "").trim();
  if (q.length > MAX_SEARCH) return { ok: false, reason: "search-too-long" };
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(q)) {
    return { ok: false, reason: "search-control-characters" };
  }

  const pageParam = single(params.page) ?? "1";
  if (!/^\d{1,6}$/.test(pageParam)) return { ok: false, reason: "bad-page" };
  const page = Number(pageParam);
  if (page < 1 || page > MAX_PAGE) return { ok: false, reason: "bad-page" };

  const filters: Record<string, string> = {};
  for (const field of enumFields(table)) {
    const value = single(params[field.name]);
    if (value === undefined || value === "") continue;
    if (!field.options?.includes(value)) {
      return { ok: false, reason: `bad-filter:${field.name}` };
    }
    filters[field.name] = value;
  }

  return { ok: true, query: { table, q, page, filters } };
}
