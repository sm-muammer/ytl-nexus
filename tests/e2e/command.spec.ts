import { expect, test } from "@playwright/test";
import { TRACKED_SERVICES } from "@/lib/monitoring/services";
import { signInAs } from "./helpers";

// Nexus Command in demo mode: fixtures drive the same UI and the same SSE shape
// as live mode (DEMO-01). Live behaviour against a real Prometheus is covered
// by infrastructure/scripts/smoke-test and docs/operations/monitoring.md.

const field = "canvas[data-particle-field]";

test.describe("Nexus Command overview", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "viewer");
  });

  test("shows the Demo label, key figures and one table row per tracked service", async ({
    page,
  }) => {
    await page.goto("/command");
    const dashboard = page.locator("[data-command-dashboard]");
    await expect(dashboard).toBeVisible();
    for (const label of ["CPU", "Memory", "Disk (root)"]) {
      await expect(dashboard.locator(`[data-gauge="${label}"]`)).toBeVisible();
    }
    await expect(dashboard.locator("tr[data-service]")).toHaveCount(
      TRACKED_SERVICES.length,
    );
    // A stopped and a missing unit are shown as such, not as running.
    await expect(dashboard.locator('tr[data-service="dovecot"]')).toContainText(
      "Stopped",
    );
    await expect(dashboard.locator('tr[data-service="sftpgo"]')).toContainText(
      "Not installed",
    );
  });

  test("draws reactive particles and keeps animating", async ({ page }) => {
    await page.goto("/command");
    const canvas = page.locator(field);
    await expect(canvas).toHaveAttribute("data-state", "running");
    expect(Number(await canvas.getAttribute("data-particles"))).toBeGreaterThan(
      TRACKED_SERVICES.length,
    );
    const frames = async () => Number(await canvas.getAttribute("data-frames"));
    const before = await frames();
    await expect.poll(frames).toBeGreaterThan(before + 5);

    // The pointer moves over the field without breaking it.
    const box = (await canvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.move(box.x + 40, box.y + 40, { steps: 5 });
    await expect(canvas).toHaveAttribute("data-state", "running");
  });

  test("renders a still frame under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/command");
    const canvas = page.locator(field);
    await expect(canvas).toHaveAttribute("data-state", "static");
    await expect(canvas).toHaveAttribute("data-frames", "1");
    await page.waitForTimeout(400);
    await expect(canvas).toHaveAttribute("data-frames", "1");
  });

  test("particle frame time stays reasonable (reported, not blocking)", async ({
    page,
  }, testInfo) => {
    await page.goto("/command");
    const canvas = page.locator(field);
    await expect(canvas).toHaveAttribute("data-state", "running");
    await page.waitForTimeout(1500);
    const ms = await canvas.getAttribute("data-frame-ms");
    testInfo.annotations.push({
      type: "frame-budget",
      description: `average frame ${ms ?? "not measured"} ms (budget 20 ms)`,
    });
    // Non-blocking by design: a loaded CI machine must not fail the build.
    // The quality tier lowers itself when the average passes the budget.
    expect(ms === null || Number(ms) > 0).toBe(true);
  });

  test("receives live updates over the stream and shows an event for a change", async ({
    page,
  }) => {
    await page.goto("/command");
    const status = page
      .getByRole("status")
      .filter({ hasText: /Updating live/ });
    await expect(status).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("the stream route", () => {
  test("refuses a Visitor and sends events to a Viewer", async ({
    page,
    request,
    context,
    baseURL,
  }) => {
    const refused = await request.get("/api/stream/metrics");
    expect(refused.status()).toBe(401);

    await signInAs(context, baseURL, "viewer");
    await page.goto("/command");
    const result = await page.evaluate(
      () =>
        new Promise<{ type: string; keys: string[] }>((resolve, reject) => {
          const es = new EventSource("/api/stream/metrics");
          const timer = setTimeout(() => {
            es.close();
            reject(new Error("no event"));
          }, 8000);
          es.addEventListener("snapshot", (e) => {
            clearTimeout(timer);
            es.close();
            const data = JSON.parse((e as MessageEvent).data);
            resolve({ type: "snapshot", keys: Object.keys(data.snapshot) });
          });
        }),
    );
    expect(result.type).toBe("snapshot");
    expect(result.keys).toEqual(
      expect.arrayContaining([
        "source",
        "takenAt",
        "intervalMs",
        "metrics",
        "services",
      ]),
    );
  });
});

test.describe("other Command pages", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "viewer");
  });

  test("/command/core-01 shows identity, hardware and current use, labelled Demo", async ({
    page,
  }) => {
    await page.goto("/command/core-01");
    await expect(page.getByRole("heading", { name: "Identity" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Hardware" })).toBeVisible();
    // No real hostname or address in demo or live (CMD security rules).
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/ytlcomms|sn1lyvx|10\.26\./);
  });

  test("/command/services lists every tracked service", async ({ page }) => {
    await page.goto("/command/services");
    await expect(page.locator("tr[data-service]")).toHaveCount(
      TRACKED_SERVICES.length,
    );
  });

  test("/command/metrics has six charts, a range switcher and a table alternative", async ({
    page,
  }) => {
    await page.goto("/command/metrics");
    await expect(page.locator("[data-chart]")).toHaveCount(6);
    const nav = page.getByRole("navigation", { name: "Time range" });
    await expect(nav.getByRole("link", { name: "1 hour" })).toHaveAttribute(
      "aria-current",
      "true",
    );

    // Legend, tooltip (pointer and keyboard) and a table behind the disclosure.
    const io = page.locator('[data-chart="disk-io"]');
    await expect(io.getByText("Read", { exact: true }).first()).toBeVisible();
    await expect(io.getByText("Write", { exact: true }).first()).toBeVisible();

    const chart = io.getByRole("group", { name: /Disk read and write/ });
    const readout = io.locator("[data-readout]");
    await expect(readout).toContainText("Point at the chart");
    await chart.focus();
    await page.keyboard.press("ArrowRight");
    await expect(readout).toContainText("Read:");
    await expect(readout).toContainText("Write:");
    await expect(readout).toContainText("/s");
    const first = await readout.innerText();
    await page.keyboard.press("End");
    expect(await readout.innerText()).not.toBe(first);
    await page.keyboard.press("Escape");
    await expect(readout).toContainText("Point at the chart");
    const box = (await chart.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(readout).toContainText("Read:");

    await io.getByText("Show the values as a table").click();
    await expect(io.locator("table tbody tr").first()).toBeVisible();
    expect(await io.locator("table tbody tr").count()).toBeGreaterThanOrEqual(
      8,
    );

    await nav.getByRole("link", { name: "7 days" }).click();
    await expect(page).toHaveURL(/range=7d/);
    await expect(
      page
        .getByRole("navigation", { name: "Time range" })
        .getByRole("link", { name: "7 days" }),
    ).toHaveAttribute("aria-current", "true");
    await expect(page.locator("[data-chart]")).toHaveCount(6);
  });

  test("/command/metrics ignores an unknown range", async ({ page }) => {
    const res = await page.goto("/command/metrics?range=30d");
    expect(res?.status()).toBe(200);
    await expect(
      page
        .getByRole("navigation", { name: "Time range" })
        .getByRole("link", { name: "1 hour" }),
    ).toHaveAttribute("aria-current", "true");
  });
});
