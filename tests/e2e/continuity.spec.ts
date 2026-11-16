import { test, expect } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Nexus Continuity (/continuity)", () => {
  test("shows continuity status with verified components and honest labels", async ({
    page,
    context,
    baseURL,
  }) => {
    // Operator role required to view continuity details
    await signInAs(context, baseURL, "operator");
    await page.goto("/continuity");

    // Title and heading
    await expect(page.locator("h1")).toContainText("Nexus Continuity");
    await expect(
      page.getByRole("heading", { name: "System Continuity Status" }),
    ).toBeVisible();

    // Freshness badge
    const freshness = page.locator("[data-testid='freshness-indicator']");
    await expect(freshness).toBeVisible();

    // Component cards
    const dbCard = page.locator("[data-component-card='ytl_nexus-database']");
    await expect(dbCard).toBeVisible();
    await expect(dbCard).toContainText("Platform Database (ytl_nexus)");
    await expect(dbCard).toContainText("Verified");

    // Operator details (sizes, ages, restore steps)
    const operatorDetail = dbCard.locator("[data-operator-detail]");
    await expect(operatorDetail).toBeVisible();
    await expect(operatorDetail).toContainText("Archive Size:");
    await expect(operatorDetail).toContainText("Restore Procedure:");

    // Disaster Recovery Section
    await expect(
      page.getByRole("heading", { name: "Disaster Recovery & Off-Box Copy" }),
    ).toBeVisible();
    await expect(
      page.locator(
        "text=rsync -avz --progress -e ssh root@10.26.64.164:/var/backups/nexus/",
      ),
    ).toBeVisible();
  });

  test("fits narrow viewports at 390px without horizontal scroll", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "operator");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/continuity");

    await expect(page.locator("h1")).toBeVisible();

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
});
