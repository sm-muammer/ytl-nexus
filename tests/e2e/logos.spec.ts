import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const MIN_HEIGHT = 31;
const widths = [390, 1440, 3840] as const;

for (const width of widths) {
  test.describe(`/design at ${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } });

    test("every logo is at least 31 CSS px high with its aspect ratio preserved", async ({
      page,
    }) => {
      await page.goto("/design");
      await page.waitForLoadState("networkidle");
      const logos = page.locator("[data-logo]");
      const count = await logos.count();
      expect(count).toBeGreaterThanOrEqual(19);
      for (let i = 0; i < count; i++) {
        const logo = logos.nth(i);
        const slug = await logo.getAttribute("data-logo");
        // next/image lazy-loads; bring the logo into view and wait for it.
        await logo.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            logo.evaluate((el) => (el as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
        const box = await logo.boundingBox();
        const natural = await logo.evaluate((el) => {
          const img = el as HTMLImageElement;
          return { w: img.naturalWidth, h: img.naturalHeight };
        });
        expect(box, slug ?? "").not.toBeNull();
        expect(box!.height, `${slug} height`).toBeGreaterThanOrEqual(
          MIN_HEIGHT - 0.5,
        );
        expect(natural.w, `${slug} loaded`).toBeGreaterThan(0);
        const rendered = box!.width / box!.height;
        const intrinsic = natural.w / natural.h;
        expect(
          Math.abs(rendered - intrinsic) / intrinsic,
          `${slug} aspect`,
        ).toBeLessThan(0.02);
      }
    });

    test("each logo keeps clear space on all four sides", async ({ page }) => {
      await page.goto("/design");
      const frames = page.locator("[data-logo-frame]");
      const count = await frames.count();
      expect(count).toBeGreaterThanOrEqual(19);
      for (let i = 0; i < count; i++) {
        const frame = frames.nth(i);
        const logo = frame.locator("[data-logo]");
        const f = (await frame.boundingBox())!;
        const l = (await logo.boundingBox())!;
        const clear = Number(await frame.getAttribute("data-clear-space"));
        expect(clear).toBeGreaterThan(0);
        expect(l.x - f.x, "left").toBeGreaterThanOrEqual(clear - 1);
        expect(l.y - f.y, "top").toBeGreaterThanOrEqual(clear - 1);
        expect(f.x + f.width - (l.x + l.width), "right").toBeGreaterThanOrEqual(
          clear - 1,
        );
        expect(
          f.y + f.height - (l.y + l.height),
          "bottom",
        ).toBeGreaterThanOrEqual(clear - 1);
      }
    });

    test("has no serious or critical accessibility violations", async ({
      page,
    }) => {
      await page.goto("/design");
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      );
      expect(blocking.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
    });
  });
}

test("/design does not scroll horizontally at 390 px", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/design");
  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("/design is marked noindex", async ({ page }) => {
  await page.goto("/design");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
});
