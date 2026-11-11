import { parseListQuery } from "@/lib/data/query";
import { toCsv } from "@/lib/data/csv";
import { FIELDS } from "@/lib/data/tables";
import { getExportRows } from "@/lib/server/data";
import { guardHandler } from "@/lib/server/guards";
import { policyForHandler } from "@/lib/server/policy";

// CSV of the filtered view (DAT-03): the same search and filters as the table,
// every matching row up to the export limit. Viewer and above (policy row
// `data.export`). Cells are escaped against spreadsheet formulas in lib/data/csv.

export const dynamic = "force-dynamic";

const ID = "data.export";

export const GET = guardHandler(
  { id: ID, requirement: policyForHandler(ID) },
  async (request) => {
    const parsed = parseListQuery(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!parsed.ok)
      return Response.json({ error: "invalid-input" }, { status: 400 });
    const { table } = parsed.query;
    try {
      const { rows, truncated } = await getExportRows(parsed.query);
      const columns = ["id", ...FIELDS[table].map((f) => f.name)];
      return new Response(toCsv(columns, rows), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${table}.csv"`,
          "Cache-Control": "private, no-store",
          ...(truncated ? { "X-Export-Truncated": "true" } : {}),
        },
      });
    } catch {
      return Response.json({ error: "unavailable" }, { status: 503 });
    }
  },
);
