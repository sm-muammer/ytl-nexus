import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("platform baseline", () => {
  test("home page renders the product name", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("YTL Nexus");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "YTL Nexus",
    );
  });

  test("skip link moves focus to the main content", async ({ page }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to content" });
    await expect(skipLink).toBeFocused();

    await skipLink.press("Enter");
    await expect(page).toHaveURL(/#main-content$/);
  });

  test("home page has no serious or critical accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    const blocking = results.violations.filter(
      (violation) =>
        violation.impact === "serious" || violation.impact === "critical",
    );

    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
});
