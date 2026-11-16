import { expect, test } from "@playwright/test";
import { blockingViolations, settle } from "./helpers";

test.describe("Nexus Tour and Presenter Mode (TOUR-01, TOUR-02, TOUR-03)", () => {
  test("loads tour steps and progresses sequentially via Next and Prev controls", async ({
    page,
  }) => {
    await page.goto("/tour");
    await settle(page);

    const tourView = page.locator("[data-tour-view]");
    await expect(tourView).toBeVisible();

    // Check step indicator
    await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
    await expect(page.locator("[data-step-title]")).toHaveText(
      "Welcome to YTL Nexus",
    );

    // Prev button should be disabled on first step
    const prevBtn = page.getByTestId("tour-prev");
    await expect(prevBtn).toBeDisabled();

    // Click Next
    const nextBtn = page.getByTestId("tour-next");
    await expect(nextBtn).toBeEnabled();
    await nextBtn.click();

    // Step 2 should be active (Nexus Command)
    await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();
    await expect(page.locator("[data-step-title]")).toHaveText(
      "Nexus Command: Telemetry & Host Health",
    );
    await expect(prevBtn).toBeEnabled();

    // Signal ribbon progress bar updates
    const ribbon = page.locator("[data-tour-progress-ribbon]");
    await expect(ribbon).toBeVisible();

    // Click Prev
    await prevBtn.click();
    await expect(page.getByText(/Step 1 of \d+/)).toBeVisible();
    await expect(page.locator("[data-step-title]")).toHaveText(
      "Welcome to YTL Nexus",
    );
  });

  test("supports keyboard stepping and Presenter mode toggling (ArrowRight, Space, ArrowLeft, P, Esc)", async ({
    page,
  }) => {
    await page.goto("/tour");
    await settle(page);

    const tourView = page.locator("[data-tour-view]");
    await expect(tourView).toHaveAttribute("data-presenter-mode", "false");

    // Stepping via ArrowRight
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();

    // Stepping via Space
    await page.keyboard.press("Space");
    await expect(page.getByText(/Step 3 of \d+/)).toBeVisible();

    // Stepping back via ArrowLeft
    await page.keyboard.press("ArrowLeft");
    await expect(page.getByText(/Step 2 of \d+/)).toBeVisible();

    // Toggle Presenter Mode with 'P'
    await page.keyboard.press("p");
    await expect(tourView).toHaveAttribute("data-presenter-mode", "true");

    // In presenter mode, typography expands and chrome hides
    const title = page.locator("[data-step-title]");
    await expect(title).toBeVisible();

    // Stepping forward in presenter mode via ArrowRight
    await page.keyboard.press("ArrowRight");
    await expect(page.getByText(/Step 3 of \d+/)).toBeVisible();

    // Exit presenter mode with Escape
    await page.keyboard.press("Escape");
    await expect(tourView).toHaveAttribute("data-presenter-mode", "false");

    // Toggle Presenter mode with the UI button
    const toggleBtn = page.getByTestId("toggle-presenter-mode");
    await toggleBtn.click();
    await expect(tourView).toHaveAttribute("data-presenter-mode", "true");
    await toggleBtn.click();
    await expect(tourView).toHaveAttribute("data-presenter-mode", "false");
  });

  test("has no critical or serious accessibility violations", async ({
    page,
  }) => {
    await page.goto("/tour");
    await settle(page);

    const violations = await blockingViolations(page);
    expect(violations).toEqual([]);
  });
});
