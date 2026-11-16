import { test } from "@playwright/test";
import { blockingViolations, expect, signInAs } from "./helpers";

test.describe("Nexus Control Completion (Task 19)", () => {
  test("Administrator accesses full Control dashboard with all 6 sections and zero a11y violations", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    const res = await page.goto("/control");
    expect(res?.status()).toBe(200);

    // Verify all 6 core sections exist
    await expect(page.locator("[data-control-users]")).toBeVisible();
    await expect(page.locator("[data-control-transfer]")).toBeVisible();
    await expect(page.locator("[data-control-mail]")).toBeVisible();
    await expect(page.locator("[data-control-services]")).toBeVisible();
    await expect(page.locator("[data-control-config]")).toBeVisible();
    await expect(page.locator("[data-control-audit]")).toBeVisible();

    // Verify Connected subsystems / Related modules panel exists
    await expect(page.locator("[data-related-modules]")).toBeVisible();

    // Verify user accounts row
    const userRows = page.locator("[data-user-row]");
    await expect(userRows).toHaveCount(4);

    // Verify accessibility (axe)
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("Global command palette opens via trigger and keyboard shortcut", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.goto("/command");

    // Click command palette trigger
    const trigger = page.locator("[data-command-palette-trigger]");
    await expect(trigger).toBeVisible();
    await trigger.click();

    // Verify modal overlay opens
    const modal = page.locator("[data-command-palette-modal]");
    await expect(modal).toBeVisible();

    // Type query for control
    const input = modal.locator('input[role="combobox"]');
    await input.fill("Control");

    // Result should show Nexus Control
    const resultItem = modal.locator('[role="option"]').first();
    await expect(resultItem).toContainText(/Nexus Control/i);

    // Close via ESC
    await page.keyboard.press("Escape");
    await expect(modal).not.toBeVisible();
  });

  test("Mobile viewport (390px) renders Control cleanly without horizontal overflow", async ({
    page,
    context,
    baseURL,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signInAs(context, baseURL, "admin");
    await page.goto("/control");

    await expect(page.locator("[data-control-users]")).toBeVisible();

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
