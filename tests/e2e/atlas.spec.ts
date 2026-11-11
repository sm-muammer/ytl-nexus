import { DEMO_KINDS } from "@/lib/fixtures/atlas";
import {
  blockingViolations,
  expect,
  horizontalOverflow,
  signInAs,
} from "./helpers";
import { test } from "@playwright/test";

// Nexus Atlas in demo mode (ATL-01 to ATL-05). Fixtures drive the same UI as live.

const COUNT = Object.keys(DEMO_KINDS).length;

test.describe("Nexus Atlas", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "viewer");
  });

  test("draws one node per service, labelled Demo, with no violations", async ({
    page,
  }) => {
    await page.goto("/command/atlas");
    const map = page.locator("[data-atlas-map]");
    await expect(map).toBeVisible();
    await expect(map.locator("[data-node]")).toHaveCount(COUNT);
    await expect(page.locator('[data-source="demo"]').first()).toContainText(
      "Demo data",
    );
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("selecting a service shows metrics, dependencies, runbook, incidents and audit", async ({
    page,
  }) => {
    await page.goto("/command/atlas");
    await page.locator('[data-node="nexus-web"]').click();
    const panel = page.locator('[data-panel-service="nexus-web"]');
    await expect(panel).toBeVisible();
    await expect(panel.locator("[data-panel-metrics]")).toContainText(
      "Uptime 24h",
    );
    await expect(panel.locator("[data-panel-deps]")).toContainText("MariaDB");
    await expect(panel.locator("[data-affected-list]")).toContainText("Apache");
    await expect(panel.locator("[data-panel-runbook] a")).toHaveAttribute(
      "href",
      /^\/library\/[a-z0-9-]+$/,
    );
    await expect(panel.locator("[data-panel-audit]")).toContainText("Restart");
    await expect(page).toHaveURL(/service=nexus-web/);
    await expect(page.locator('[data-node="nexus-web"]')).toHaveAttribute(
      "aria-current",
      "true",
    );

    // A service with an incident lists it and links to Status.
    await page.locator('[data-node="wordpress"]').click();
    await expect(
      page.locator("[data-panel-incidents] a", { hasText: "Nexus Studio" }),
    ).toHaveAttribute("href", "/status");
  });

  test("a Viewer sees why there are no actions", async ({ page }) => {
    await page.goto("/command/atlas?service=nexus-web");
    const panel = page.locator("[data-panel-actions]");
    await expect(panel).toContainText("Operator role");
    await expect(panel.locator("button")).toHaveCount(0);
  });

  test("an Operator sees the actions, disabled in a demo session", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "operator");
    await page.goto("/command/atlas?service=nexus-web");
    const panel = page.locator("[data-panel-actions]");
    await expect(panel).toContainText("Demo session");
    await expect(panel.locator("[data-atlas-health] button")).toBeDisabled();
    await expect(panel.locator("[data-atlas-logs] button")).toBeDisabled();
    await expect(
      panel.locator("[data-atlas-restart] button").first(),
    ).toBeDisabled();

    await page.locator('[data-node="chronyd"]').click();
    await expect(panel).toContainText("No predefined action");
  });

  test("the keyboard reaches every node, opens one and finds the panel", async ({
    page,
  }) => {
    await page.goto("/command/atlas");
    const nodes = page.locator("[data-atlas-map] [data-node]");
    const seen = new Set<string>();
    await nodes.first().focus();
    for (let i = 0; i < COUNT; i++) {
      const slug = await page.evaluate(() =>
        document.activeElement?.getAttribute("data-node"),
      );
      expect(slug).toBeTruthy();
      seen.add(slug!);
      await page.keyboard.press("Tab");
    }
    expect(seen.size).toBe(COUNT);

    // Arrow keys move to a neighbour and Enter opens it.
    await page.locator('[data-node="apache"]').focus();
    await page.keyboard.press("ArrowRight");
    const next = await page.evaluate(() =>
      document.activeElement?.getAttribute("data-node"),
    );
    expect(next).not.toBe("apache");
    await page.keyboard.press("Enter");
    await expect(page.locator(`[data-panel-service="${next}"]`)).toBeVisible();
    await expect(
      page.getByRole("status").filter({ hasText: "Selected" }),
    ).toHaveCount(1);
  });

  test("the list view shows the same services and opens the same panel", async ({
    page,
  }) => {
    await page.goto("/command/atlas");
    await page.getByRole("button", { name: "List" }).click();
    const list = page.locator("[data-atlas-list]");
    await expect(list.locator("tr[data-service]")).toHaveCount(COUNT);
    await expect(list.locator('tr[data-service="apache"]')).toContainText(
      "Nexus Web",
    );
    await list.getByRole("button", { name: "MariaDB" }).click();
    await expect(page.locator('[data-panel-service="mariadb"]')).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("ignores an unknown service in the address", async ({ page }) => {
    const res = await page.goto("/command/atlas?service=../../etc");
    expect(res?.status()).toBe(200);
    await expect(page.locator("[data-atlas-panel]")).toContainText(
      "Select a service",
    );
    await page.goto("/command/atlas?service=nothing");
    await expect(page.locator("[data-atlas-panel]")).toContainText(
      "Select a service",
    );
  });

  for (const width of [390, 1440, 3840]) {
    test(`does not scroll the page sideways at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/command/atlas?service=mariadb");
      await expect(page.locator("[data-atlas-map]")).toBeVisible();
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("access", () => {
  test("a Visitor is not shown the map", async ({ page }) => {
    await page.goto("/command/atlas");
    await expect(page.locator("[data-atlas-map]")).toHaveCount(0);
  });
});
