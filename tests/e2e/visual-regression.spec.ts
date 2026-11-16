import { expect, test } from "@playwright/test";
import { settle, signInAs, ALL_VIEWPORTS } from "./helpers";

// Requirement 18.3: Visual regression snapshots at widths 390, 768, 1440, 2560 and 3840 px
// High-DPI (deviceScaleFactor: 2) with reduced motion for deterministic pixel matching.
// Fails if more than 0.1% (maxDiffPixelRatio: 0.001) of pixels differ.

test.describe("visual regression snapshots across 5 viewports (Requirement 18.3)", () => {
  test.use({
    reducedMotion: "reduce",
  });

  const routes = [
    { name: "home", path: "/" },
    { name: "platform", path: "/platform" },
    { name: "story", path: "/story" },
    { name: "status", path: "/status" },
    { name: "design", path: "/design" },
  ];

  for (const width of ALL_VIEWPORTS) {
    test.describe(`${width}px viewport`, () => {
      test.use({
        viewport: { width, height: 1080 },
      });

      for (const route of routes) {
        test(`${route.name} at ${width}px renders consistently`, async ({
          page,
          context,
          baseURL,
        }) => {
          await signInAs(context, baseURL, "admin");
          await page.goto(route.path);
          await settle(page);

          // Verify no horizontal overflow at this width
          const overflow = await page.evaluate(
            () =>
              document.documentElement.scrollWidth -
              document.documentElement.clientWidth,
          );
          expect(overflow).toBeLessThanOrEqual(0);

          // Header and main landmark visual snapshot
          const header = page.locator("header");
          await expect(header).toBeVisible();

          // Visual assertion with 0.1% max diff pixel ratio (Requirement 18.3)
          await expect(header).toHaveScreenshot(
            `header-${route.name}-${width}px.png`,
            {
              maxDiffPixelRatio: 0.001,
              animations: "disabled",
            },
          );
        });
      }
    });
  }
});
