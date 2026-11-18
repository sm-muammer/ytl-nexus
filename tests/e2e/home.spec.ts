import { expect, test } from "@playwright/test";
import { blockingViolations, horizontalOverflow, settle } from "./helpers";

const logoCanvas = "canvas[data-particle-logo]";

test.describe("Home showcase (spec 24)", () => {
  test("renders the WebGL particle logomark running with tier and particle attributes", async ({
    page,
  }) => {
    await page.goto("/");
    const canvas = page.locator(logoCanvas);
    await expect(canvas).toHaveAttribute("data-state", "running");
    await expect(canvas).toHaveAttribute("data-tier", /^(high|medium|low)$/);
    const count = Number(await canvas.getAttribute("data-particles"));
    expect([30_000, 70_000, 140_000]).toContain(count);

    await expect
      .poll(async () => Number(await canvas.getAttribute("data-frames")))
      .toBeGreaterThan(2);
  });

  test("pauses particle rendering when tab is hidden and disables canvas pointer events past the hero", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const canvas = page.locator(logoCanvas);
    await expect(canvas).toHaveAttribute("data-state", "running");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-frames")))
      .toBeGreaterThan(0);

    await expect(canvas).toHaveCSS("pointer-events", "auto", {
      timeout: 15_000,
    });

    await page.evaluate(() => window.scrollTo(0, window.innerHeight * 1.1));
    await expect(canvas).toHaveCSS("pointer-events", "none");

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(canvas).toHaveAttribute("data-state", "paused");
  });

  test("shows project facts, modules bento spotlight, architecture teaser and story link", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await settle(page);

    await expect(
      page.getByText(/Internship project · YTL Communications/i),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 1, name: "YTL Nexus" }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /project facts/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("region", { name: /how it fits together/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Read the project story/i }),
    ).toHaveAttribute("href", "/story");
  });

  for (const width of [390, 1440] as const) {
    test(`has zero serious axe violations and zero horizontal overflow at ${width} px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await settle(page);

      expect(await blockingViolations(page)).toEqual([]);
      expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
    });
  }
});

test.describe("Home showcase with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("renders a single static particle frame and runs no animation loop", async ({
    page,
  }) => {
    await page.goto("/");
    const canvas = page.locator(logoCanvas);
    await expect(canvas).toHaveAttribute("data-state", "static");
    await expect
      .poll(async () => Number(await canvas.getAttribute("data-frames")))
      .toBe(1);
    await page.waitForTimeout(400);
    expect(Number(await canvas.getAttribute("data-frames"))).toBe(1);
  });
});
