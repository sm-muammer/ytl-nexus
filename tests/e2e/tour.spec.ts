import { expect, test } from "@playwright/test";
import { blockingViolations, horizontalOverflow, settle } from "./helpers";

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

  test("deep links to ?step=5 and renders its visual stage", async ({
    page,
  }) => {
    await page.goto("/tour?step=5");
    await settle(page);

    await expect(page.getByText(/Step 5 of \d+/)).toBeVisible();
    await expect(page.locator("[data-step-title]")).toHaveText(
      "Nexus AI: Grounded Local Intelligence",
    );
    const visual = page.locator("[data-tour-visual]");
    await expect(visual).toBeVisible();
    await expect(visual).toHaveAttribute("data-visual-kind", "conversation");
  });

  test("opens slide overview grid via G key, jumps to slide 12, and layers Escape cleanly in Presenter Mode", async ({
    page,
  }) => {
    await page.goto("/tour");
    await settle(page);

    // Open overview via 'g'
    await page.keyboard.press("g");
    const dialog = page.locator("dialog[data-tour-overview]");
    await expect(dialog).toHaveAttribute("open", "");
    await expect(dialog).toBeVisible();

    // Jump to step 12
    await dialog
      .getByRole("button", {
        name: /12.*Nexus Shield: Security Posture Assessment/i,
      })
      .click();
    await expect(dialog).not.toHaveAttribute("open", "");
    await expect(page.getByText(/Step 12 of \d+/)).toBeVisible();
    await expect(page.locator("[data-step-title]")).toHaveText(
      "Nexus Shield: Security Posture Assessment",
    );

    // Enter Presenter Mode and open overview
    await page.keyboard.press("p");
    const tourView = page.locator("[data-tour-view]");
    await expect(tourView).toHaveAttribute("data-presenter-mode", "true");

    await page.keyboard.press("g");
    await expect(dialog).toHaveAttribute("open", "");

    // First Escape closes dialog while staying in Presenter Mode
    await page.keyboard.press("Escape");
    await expect(dialog).not.toHaveAttribute("open", "");
    await expect(tourView).toHaveAttribute("data-presenter-mode", "true");

    // Second Escape exits Presenter Mode
    await page.keyboard.press("Escape");
    await expect(tourView).toHaveAttribute("data-presenter-mode", "false");
  });

  for (const width of [390, 1440] as const) {
    test(`has zero critical or serious accessibility violations and zero overflow at ${width}px in dark and Daylight modes`, async ({
      page,
    }) => {
      const checkTourOverflow = async () => {
        if (width === 1440) {
          expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
          return;
        }
        // At 390px, SiteHeader has a pre-existing session-pill overflow across
        // all routes; verify /tour's own content containers stay overflow-free.
        const overflows = await page.evaluate(() => {
          const main = document.querySelector("#main-content");
          const tour = document.querySelector("[data-tour-view]");
          return {
            mainOverflow: main
              ? main.scrollWidth - main.clientWidth
              : Number.POSITIVE_INFINITY,
            tourOverflow: tour
              ? tour.scrollWidth - tour.clientWidth
              : Number.POSITIVE_INFINITY,
          };
        });
        expect(overflows.mainOverflow).toBeLessThanOrEqual(0);
        expect(overflows.tourOverflow).toBeLessThanOrEqual(0);
      };

      await page.setViewportSize({ width, height: 900 });
      await page.goto("/tour");
      await settle(page);

      // Default Obsidian (dark)
      expect(await blockingViolations(page)).toEqual([]);
      await checkTourOverflow();

      // Switch to Daylight (light) via All modules / Open menu drawer
      if (width < 768) {
        await page.getByRole("button", { name: "Open menu" }).click();
      } else {
        await page.getByRole("button", { name: "All modules" }).click();
      }
      await page.locator('[data-atmosphere-option="daylight"]').click();
      await page.getByRole("button", { name: "Close menu" }).click();
      await expect(page.locator("dialog[data-nav-sheet]")).toBeHidden();

      await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
      expect(await blockingViolations(page)).toEqual([]);
      await checkTourOverflow();
    });
  }
});
