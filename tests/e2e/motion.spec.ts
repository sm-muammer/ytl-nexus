import { expect, test, type Page } from "@playwright/test";
import { settle, signInAs } from "./helpers";

const field = "canvas[data-ambient-field]";
const ambientRoute = "/platform";

async function frames(page: Page) {
  return Number(await page.locator(field).getAttribute("data-frames"));
}

test.describe("particle field with full motion", () => {
  test("animates, scales its particle count by tier, and reports its state", async ({
    page,
  }) => {
    await page.goto(ambientRoute);
    const canvas = page.locator(field);
    await expect(canvas).toHaveAttribute("data-state", "running");
    await expect(canvas).toHaveAttribute("data-tier", /^(high|medium|low)$/);
    expect(Number(await canvas.getAttribute("data-particles"))).toBeGreaterThan(
      0,
    );

    const before = await frames(page);
    await expect.poll(() => frames(page)).toBeGreaterThan(before + 5);
  });

  test("pauses while the tab is hidden and resumes within 500 ms", async ({
    page,
  }) => {
    await page.goto(ambientRoute);
    const canvas = page.locator(field);
    await expect(canvas).toHaveAttribute("data-state", "running");

    const setVisibility = (state: "hidden" | "visible") =>
      page.evaluate((s) => {
        Object.defineProperty(document, "visibilityState", {
          configurable: true,
          get: () => s,
        });
        document.dispatchEvent(new Event("visibilitychange"));
      }, state);

    await setVisibility("hidden");
    await expect(canvas).toHaveAttribute("data-state", "paused");
    const paused = await frames(page);
    await page.waitForTimeout(300);
    expect(await frames(page)).toBe(paused);

    await setVisibility("visible");
    await expect(canvas).toHaveAttribute("data-state", "running", {
      timeout: 500,
    });
    await expect
      .poll(() => frames(page), { timeout: 500 })
      .toBeGreaterThan(paused);
  });

  test("shows the signal ribbon on route changes", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/platform");
    const ribbon = page.locator("[data-signal-ribbon]");
    await expect(ribbon).toHaveCount(0); // not on first load

    await page
      .getByRole("navigation", { name: "Global" })
      .getByRole("link", { name: "Tour", exact: true })
      .click();
    await expect(page).toHaveURL(/\/tour$/);
    await expect(ribbon).toHaveAttribute("data-runs", "1");
    await page
      .getByRole("navigation", { name: "Global" })
      .getByRole("link", { name: "Story", exact: true })
      .click();
    await expect(ribbon).toHaveAttribute("data-runs", "2");
  });

  test("entrance animations finish and leave content fully visible", async ({
    page,
  }) => {
    await page.goto("/");
    expect(await page.locator("[data-reveal]").count()).toBeGreaterThan(0);
    await settle(page);
  });
});

test.describe("prefers-reduced-motion: reduce", () => {
  test.use({ reducedMotion: "reduce" });

  test("renders a static particle frame and runs no animation loop", async ({
    page,
  }) => {
    await page.goto(ambientRoute);
    const canvas = page.locator(field);
    await expect(canvas).toHaveAttribute("data-state", "static");
    expect(await frames(page)).toBe(1);
    await page.waitForTimeout(500);
    expect(await frames(page)).toBe(1);
  });

  test("uses no transform animation, only opacity", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    const transformAnimations = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => {
          const effect = a.effect as KeyframeEffect | null;
          return effect
            ?.getKeyframes()
            .some((k) => "transform" in k || "translate" in k || "scale" in k);
        })
        .map((a) => a.id || "unnamed"),
    );
    expect(transformAnimations).toEqual([]);
  });

  test("the signal ribbon does not scale or move, it only fades", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/platform");
    await page
      .getByRole("navigation", { name: "Global" })
      .getByRole("link", { name: "Tour", exact: true })
      .click();

    const ribbon = page.locator("[data-signal-ribbon] > div");
    await expect(ribbon).toHaveCount(1);
    for (const wait of [0, 80, 200]) {
      await page.waitForTimeout(wait);
      const transform = await ribbon.evaluate(
        (el) => getComputedStyle(el).transform,
      );
      // "none" or the identity matrix: not partway through a scale.
      expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(transform);
    }
  });

  test("keeps content readable and the page free of horizontal scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await settle(page);
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
});

test.describe("no particles or parallax on forms, tables, Control or the inbox", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "admin");
  });

  for (const route of [
    "/control",
    "/signin",
    "/mail",
    "/data",
    "/command",
    "/command/metrics",
    "/design",
  ]) {
    test(`${route} has no particle field`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator(field)).toHaveCount(0);
    });
  }
});
