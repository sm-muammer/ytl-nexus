import { describe, expect, it } from "vitest";
import {
  DATA_TABLES,
  FIELDS,
  recordInput,
  TABLE_LABEL,
} from "@/lib/data/tables";
import { PAGE_SIZE, escapeLike, parseListQuery } from "@/lib/data/query";
import { escapeCsvCell, toCsv } from "@/lib/data/csv";
import { ACTION_POLICY, HANDLER_POLICY } from "@/lib/server/policy";

// DAT-01 to DAT-04 and the Nexus Data security rules: validation before the
// database, parameters the page can trust, and CSV that cannot inject formulas.

const SITE = {
  code: "KL-DC1",
  name: "Kuala Lumpur data centre",
  city: "Cyberjaya",
  state: "Selangor",
  kind: "data-centre",
};

const ASSET = {
  asset_tag: "AST-0001",
  name: "Core router",
  category: "router",
  site_id: "3",
  status: "active",
  vendor: "Generic Networks",
  model: "R-100",
  purchased_on: "2025-03-01",
};

const TICKET = {
  ticket_no: "TKT-2026-0001",
  title: "Replace fan tray",
  asset_id: "",
  site_id: "1",
  priority: "high",
  status: "open",
  scheduled_for: "",
  description: "Schedule a maintenance window with the site team.",
};

describe("table definitions", () => {
  it("covers exactly the three demonstration tables", () => {
    expect([...DATA_TABLES].sort()).toEqual([
      "data_assets",
      "data_sites",
      "data_tickets",
    ]);
    for (const t of DATA_TABLES) expect(TABLE_LABEL[t]).toBeTruthy();
  });

  it("gives every table a field list with unique names", () => {
    for (const t of DATA_TABLES) {
      const names = FIELDS[t].map((f) => f.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names.length).toBeGreaterThan(3);
    }
  });
});

describe("recordInput", () => {
  it("accepts a valid record of each table and types its values", () => {
    const site = recordInput("data_sites", SITE);
    expect(site).toMatchObject({ ok: true, values: SITE });

    const asset = recordInput("data_assets", ASSET);
    expect(asset).toMatchObject({
      ok: true,
      values: { ...ASSET, site_id: 3, purchased_on: "2025-03-01" },
    });

    const ticket = recordInput("data_tickets", TICKET);
    expect(ticket).toMatchObject({
      ok: true,
      values: { ...TICKET, site_id: 1, asset_id: null, scheduled_for: null },
    });
  });

  it("rejects an unknown field instead of storing it", () => {
    const r = recordInput("data_sites", { ...SITE, password: "x" });
    expect(r.ok).toBe(false);
  });

  it("rejects a missing required field", () => {
    const rest: Record<string, string> = { ...SITE };
    delete rest.name;
    expect(recordInput("data_sites", rest).ok).toBe(false);
  });

  it.each([
    ["code with a quote", "KL'; DROP TABLE data_sites;--"],
    ["code with a space", "KL DC"],
    ["code too long", "A".repeat(17)],
  ])("refuses a hostile code: %s", (_label, code) => {
    expect(recordInput("data_sites", { ...SITE, code }).ok).toBe(false);
  });

  it("refuses an enum value outside its list", () => {
    expect(recordInput("data_sites", { ...SITE, kind: "bunker" }).ok).toBe(
      false,
    );
  });

  it("refuses control characters in free text", () => {
    const name = "Core\u0000router";
    expect(recordInput("data_assets", { ...ASSET, name }).ok).toBe(false);
  });

  it("stores SQL-looking free text literally (it is bound, not spliced)", () => {
    const name = "Router'); DROP TABLE data_assets; --";
    const r = recordInput("data_assets", { ...ASSET, name });
    expect(r).toMatchObject({ ok: true, values: { name } });
  });

  it.each(["2026-02-30", "2026-13-01", "01/03/2026", "2026-1-1"])(
    "refuses the date %s",
    (purchased_on) => {
      expect(recordInput("data_assets", { ...ASSET, purchased_on }).ok).toBe(
        false,
      );
    },
  );

  it.each(["0", "-1", "1.5", "3abc", "99999999999999999999"])(
    "refuses the reference %s",
    (site_id) => {
      expect(recordInput("data_assets", { ...ASSET, site_id }).ok).toBe(false);
    },
  );

  it("turns an empty optional reference into null", () => {
    const r = recordInput("data_tickets", { ...TICKET, asset_id: "  " });
    expect(r).toMatchObject({ ok: true, values: { asset_id: null } });
  });
});

describe("parseListQuery", () => {
  it("defaults to the assets table, page 1, no search or filters", () => {
    expect(parseListQuery({})).toEqual({
      ok: true,
      query: { table: "data_assets", q: "", page: 1, filters: {} },
    });
  });

  it("refuses a table that is not in the list", () => {
    expect(parseListQuery({ table: "users" }).ok).toBe(false);
    expect(parseListQuery({ table: "data_assets; --" }).ok).toBe(false);
  });

  it("trims the search text and refuses control characters", () => {
    const ok = parseListQuery({ q: "  core  " });
    expect(ok).toMatchObject({ ok: true, query: { q: "core" } });
    expect(parseListQuery({ q: "a\u0007b" }).ok).toBe(false);
    expect(parseListQuery({ q: "x".repeat(101) }).ok).toBe(false);
  });

  it("refuses a page that is not a positive whole number", () => {
    expect(parseListQuery({ page: "0" }).ok).toBe(false);
    expect(parseListQuery({ page: "2.5" }).ok).toBe(false);
    expect(parseListQuery({ page: "abc" }).ok).toBe(false);
    expect(parseListQuery({ page: "3" })).toMatchObject({
      ok: true,
      query: { page: 3 },
    });
  });

  it("keeps only filters that name an enum field of the table with a listed value", () => {
    expect(
      parseListQuery({ table: "data_assets", status: "retired" }),
    ).toMatchObject({ ok: true, query: { filters: { status: "retired" } } });
    expect(parseListQuery({ table: "data_assets", status: "gone" }).ok).toBe(
      false,
    );
    // A field that is not a filter on this table is ignored.
    expect(
      parseListQuery({ table: "data_sites", priority: "high" }),
    ).toMatchObject({ ok: true, query: { filters: {} } });
  });

  it("uses 25 rows per page", () => {
    expect(PAGE_SIZE).toBe(25);
  });
});

describe("escapeLike", () => {
  it("escapes the LIKE wildcards and the escape character itself", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("escapeCsvCell", () => {
  it.each(['=HYPERLINK("x")', "+1", "-2", "@SUM(A1)", "\tcmd", "\rcmd"])(
    "neutralises a formula-leading value: %j",
    (value) => {
      expect(
        escapeCsvCell(value).startsWith("'") ||
          escapeCsvCell(value).startsWith("\"'"),
      ).toBe(true);
    },
  );

  it("quotes values with commas, quotes and line breaks", () => {
    expect(escapeCsvCell('a, "b"\nc')).toBe('"a, ""b""\nc"');
  });

  it("writes null as an empty cell and numbers as text", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(42)).toBe("42");
    expect(escapeCsvCell("plain")).toBe("plain");
  });
});

describe("toCsv", () => {
  it("writes a header row and one row per record, CRLF terminated", () => {
    const csv = toCsv(
      ["name", "site_id"],
      [
        { name: "Core router", site_id: 3 },
        { name: "=evil", site_id: null },
      ],
    );
    expect(csv).toBe("name,site_id\r\nCore router,3\r\n'=evil,\r\n");
  });
});

describe("access policy for Nexus Data", () => {
  it.each(["data.record.create", "data.record.update", "data.record.delete"])(
    "lets only an Operator and above run %s",
    (id) => {
      expect(ACTION_POLICY.find((a) => a.id === id)?.minRole).toBe("operator");
    },
  );
  it("lets a viewer export the filtered view", () => {
    expect(HANDLER_POLICY.find((h) => h.id === "data.export")?.minRole).toBe(
      "viewer",
    );
  });
});
