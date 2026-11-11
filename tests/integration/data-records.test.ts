import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  recordInput,
  type DataTable,
  type RecordValues,
} from "@/lib/data/tables";
import {
  readAllRows,
  readPage,
  readSchema,
  readChanges,
} from "@/lib/server/data";
import {
  createRecord,
  deleteRecord,
  updateRecord,
} from "@/lib/server/data-writes";
import { seedDatabase } from "@/lib/server/db/seed/run";
import { createScratchDatabase, type ScratchDatabase } from "./helpers/test-db";

// DAT-01, DAT-02, DAT-04 against a real MariaDB: the list queries, the writes,
// the constraints the database enforces and the hostile-input rules.

let s: ScratchDatabase;

beforeAll(async () => {
  s = await createScratchDatabase();
  await s.prepare();
  await seedDatabase(s.migrate);
});

afterAll(async () => {
  await s.drop();
});

const query = (
  table: DataTable,
  extra: { q?: string; page?: number; filters?: Record<string, string> } = {},
) => ({
  table,
  q: extra.q ?? "",
  page: extra.page ?? 1,
  filters: extra.filters ?? {},
});

/** Valid, typed values for a new record, from the same validation the Server Function uses. */
function valid(table: DataTable, raw: Record<string, string>): RecordValues {
  const result = recordInput(table, raw);
  if (!result.ok)
    throw new Error(
      `test fixture is invalid: ${JSON.stringify(result.issues)}`,
    );
  return result.values;
}

const siteRow = (code: string) =>
  valid("data_sites", {
    code,
    name: `Site ${code}`,
    city: "Shah Alam",
    state: "Selangor",
    kind: "office",
  });

describe("list queries", () => {
  it("pages 25 rows at a time over the seeded assets", async () => {
    const first = await readPage(s.app, query("data_assets"));
    expect(first.total).toBe(42);
    expect(first.rows).toHaveLength(25);
    expect(first.pages).toBe(2);
    const second = await readPage(s.app, query("data_assets", { page: 2 }));
    expect(second.rows).toHaveLength(17);
    expect(second.rows[0]!.id).toBeGreaterThan(first.rows[24]!.id);
  });

  it("returns dates as YYYY-MM-DD and references as numbers", async () => {
    const page = await readPage(s.app, query("data_assets"));
    const row = page.rows[0]!;
    expect(row.site_id).toEqual(expect.any(Number));
    if (row.purchased_on !== null)
      expect(row.purchased_on).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("searches the searchable columns, case-insensitively", async () => {
    const all = await readPage(s.app, query("data_sites"));
    const code = all.rows[0]!.code as string;
    const found = await readPage(
      s.app,
      query("data_sites", { q: code.toLowerCase() }),
    );
    expect(found.rows.some((r) => r.code === code)).toBe(true);
  });

  it("treats % and _ in the search as text, not wildcards", async () => {
    const found = await readPage(s.app, query("data_assets", { q: "%" }));
    expect(found.total).toBe(0);
    const underscore = await readPage(s.app, query("data_assets", { q: "_" }));
    expect(underscore.total).toBe(0);
  });

  it("filters on an enum value", async () => {
    const retired = await readPage(
      s.app,
      query("data_assets", { filters: { status: "retired" } }),
    );
    expect(retired.rows.every((r) => r.status === "retired")).toBe(true);
  });

  it("exports every matching row, up to the limit", async () => {
    const { rows, truncated } = await readAllRows(s.app, query("data_tickets"));
    expect(rows).toHaveLength(28);
    expect(truncated).toBe(false);
  });

  it("reads the schema with its foreign keys from information_schema", async () => {
    const schema = await readSchema(s.app);
    const assets = schema.tables.find((t) => t.name === "data_assets")!;
    expect(assets.columns.map((c) => c.name)).toEqual(
      expect.arrayContaining(["asset_tag", "site_id", "status"]),
    );
    expect(assets.relations).toEqual([
      { column: "site_id", references: "data_sites", referencedColumn: "id" },
    ]);
  });
});

describe("writes", () => {
  it("creates a site, then finds it in the table", async () => {
    const result = await createRecord(
      s.app,
      "data_sites",
      siteRow("TEST-SITE-1"),
    );
    expect(result).toMatchObject({ ok: true });
    const found = await readPage(
      s.app,
      query("data_sites", { q: "TEST-SITE-1" }),
    );
    expect(found.rows.map((r) => r.code)).toEqual(["TEST-SITE-1"]);
  });

  it("refuses a duplicate code", async () => {
    const result = await createRecord(
      s.app,
      "data_sites",
      siteRow("TEST-SITE-1"),
    );
    expect(result).toEqual({ ok: false, error: "duplicate" });
  });

  it("refuses an asset that points at a site which does not exist", async () => {
    const values = valid("data_assets", {
      asset_tag: "TEST-AST-MISSING",
      name: "Orphan",
      category: "switch",
      site_id: "999999",
      status: "active",
      vendor: "Generic",
      model: "S-1",
      purchased_on: "",
    });
    expect(await createRecord(s.app, "data_assets", values)).toEqual({
      ok: false,
      error: "missing-reference",
    });
  });

  it("updates a record and reports a missing one", async () => {
    const created = await createRecord(
      s.app,
      "data_sites",
      siteRow("TEST-SITE-2"),
    );
    if (!created.ok) throw new Error("setup failed");
    const values = valid("data_sites", {
      code: "TEST-SITE-2",
      name: "Renamed site",
      city: "Puchong",
      state: "Selangor",
      kind: "tower",
    });
    expect(await updateRecord(s.app, "data_sites", created.id, values)).toEqual(
      {
        ok: true,
        id: created.id,
      },
    );
    const page = await readPage(s.app, query("data_sites", { q: "Renamed" }));
    expect(page.rows.find((r) => r.id === created.id)).toMatchObject({
      city: "Puchong",
      kind: "tower",
    });
    expect(await updateRecord(s.app, "data_sites", 987654, values)).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("deletes a record, and reports a second delete as not found", async () => {
    const created = await createRecord(
      s.app,
      "data_sites",
      siteRow("TEST-SITE-3"),
    );
    if (!created.ok) throw new Error("setup failed");
    expect(await deleteRecord(s.app, "data_sites", created.id)).toEqual({
      ok: true,
      id: created.id,
    });
    expect(await deleteRecord(s.app, "data_sites", created.id)).toEqual({
      ok: false,
      error: "not-found",
    });
  });

  it("refuses to delete a site that still has assets", async () => {
    const siteId = (
      await s.app
        .selectFrom("data_sites")
        .select("id")
        .orderBy("id")
        .executeTakeFirstOrThrow()
    ).id;
    expect(await deleteRecord(s.app, "data_sites", Number(siteId))).toEqual({
      ok: false,
      error: "in-use",
    });
  });

  it("clears the asset on a ticket when that asset is deleted", async () => {
    const asset = await createRecord(
      s.app,
      "data_assets",
      valid("data_assets", {
        asset_tag: "TEST-AST-DEL",
        name: "Short-lived",
        category: "ups",
        site_id: String(
          (
            await s.app
              .selectFrom("data_sites")
              .select("id")
              .orderBy("id")
              .executeTakeFirstOrThrow()
          ).id,
        ),
        status: "active",
        vendor: "Generic",
        model: "U-1",
        purchased_on: "",
      }),
    );
    if (!asset.ok) throw new Error("setup failed");
    const ticket = await createRecord(
      s.app,
      "data_tickets",
      valid("data_tickets", {
        ticket_no: "TEST-TKT-1",
        title: "Check battery",
        asset_id: String(asset.id),
        site_id: String(
          (
            await s.app
              .selectFrom("data_sites")
              .select("id")
              .orderBy("id")
              .executeTakeFirstOrThrow()
          ).id,
        ),
        priority: "low",
        status: "open",
        scheduled_for: "2026-12-01",
        description: "Test ticket.",
      }),
    );
    if (!ticket.ok) throw new Error("setup failed");
    expect(await deleteRecord(s.app, "data_assets", asset.id)).toEqual({
      ok: true,
      id: asset.id,
    });
    const row = await s.app
      .selectFrom("data_tickets")
      .select("asset_id")
      .where("id", "=", ticket.id)
      .executeTakeFirstOrThrow();
    expect(row.asset_id).toBeNull();
  });

  it("stores SQL-looking text as text and leaves the table in place", async () => {
    const hostile = "Router'); DROP TABLE data_assets; --";
    const created = await createRecord(
      s.app,
      "data_assets",
      valid("data_assets", {
        asset_tag: "TEST-AST-HOSTILE",
        name: hostile,
        category: "other",
        site_id: String(
          (
            await s.app
              .selectFrom("data_sites")
              .select("id")
              .orderBy("id")
              .executeTakeFirstOrThrow()
          ).id,
        ),
        status: "active",
        vendor: "Generic",
        model: "X",
        purchased_on: "",
      }),
    );
    if (!created.ok) throw new Error("setup failed");
    const stored = await s.app
      .selectFrom("data_assets")
      .select("name")
      .where("id", "=", created.id)
      .executeTakeFirstOrThrow();
    expect(stored.name).toBe(hostile);
    const count = await sql<{
      n: number;
    }>`SELECT COUNT(*) AS n FROM data_assets`.execute(s.app);
    expect(Number(count.rows[0]!.n)).toBeGreaterThan(40);
  });

  it("refuses a write that the nexus_app user is not allowed to make", async () => {
    // audit_events is append-only for nexus_app (requirement 5.9): no update, no delete.
    await expect(
      sql`UPDATE audit_events SET result = 'success' WHERE 1 = 0`.execute(
        s.app,
      ),
    ).rejects.toThrow();
  });
});

describe("change history", () => {
  it("returns nothing when no Nexus Data change is recorded", async () => {
    expect(await readChanges(s.app)).toEqual([]);
  });
});
