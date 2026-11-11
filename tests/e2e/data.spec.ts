import { test } from "@playwright/test";
import {
  blockingViolations,
  expect,
  horizontalOverflow,
  signInAs,
} from "./helpers";

// Nexus Data in demo mode (DAT-01 to DAT-05). Demo reads fixtures and disables
// every write with an explanation, so these checks cover what a visitor sees
// and what the role gating shows.

test.describe("Nexus Data, viewer", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "viewer");
  });

  test("lists the assets with a page count and the Demo label", async ({
    page,
  }) => {
    await page.goto("/data");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nexus Data" }),
    ).toBeVisible();
    await expect(page.locator('[data-source="demo"]').first()).toContainText(
      "Demo",
    );
    await expect(page.getByText("42 records, 25 per page")).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Assets records" }).locator("tbody tr"),
    ).toHaveCount(25);
  });

  test("switches tables and keeps the search and filter in the export link", async ({
    page,
  }) => {
    await page.goto("/data?table=data_tickets&priority=high");
    await expect(
      page.getByRole("link", { name: "Maintenance tickets" }),
    ).toHaveAttribute("aria-current", "page");
    const link = page.getByRole("link", { name: "Download CSV" });
    await expect(link).toHaveAttribute("href", /priority=high/);
    await expect(link).toHaveAttribute("href", /table=data_tickets/);
  });

  test("answers a search for a literal percent sign with no records", async ({
    page,
  }) => {
    await page.goto("/data?q=%25");
    await expect(page.getByText("0 records, 25 per page")).toBeVisible();
    await expect(page.getByText("No records match")).toBeVisible();
  });

  test("downloads a CSV with a header row", async ({ request, context }) => {
    const cookies = await context.cookies();
    const response = await request.get("/api/data/export?table=data_sites", {
      headers: {
        cookie: cookies.map((c) => `${c.name}=${c.value}`).join("; "),
      },
    });
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/csv");
    const body = await response.text();
    expect(body.split("\r\n")[0]).toBe("id,code,name,city,state,kind");
  });

  test("gives a viewer no add or edit controls", async ({ page }) => {
    await page.goto("/data");
    await expect(page.getByText("Add a record")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Delete record" }),
    ).toHaveCount(0);
  });

  test("explains how the supervisor request is met and shows the schema", async ({
    page,
  }) => {
    await page.goto("/data");
    await expect(page.getByText("MariaDB 10.5")).toBeVisible();
    await expect(page.getByText("Schema (read-only)")).toBeVisible();
  });

  test("has no serious accessibility violations and no sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/data");
    expect(await blockingViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

test.describe("Nexus Data, operator in a demo session", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "operator");
  });

  test("offers the add form, with writes disabled and explained", async ({
    page,
  }) => {
    await page.goto("/data");
    await page.getByText("Add a record").click();
    await expect(page.locator("[data-demo-note]").first()).toContainText(
      "Demo session",
    );
    await expect(
      page.getByRole("button", { name: "Add record" }),
    ).toBeDisabled();
  });
});
