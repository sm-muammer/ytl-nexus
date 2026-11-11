import { expect, test } from "@playwright/test";
import { blockingViolations, horizontalOverflow, signInAs } from "./helpers";

// Nexus Status and the Operator controls in demo mode. The agent protocol, the
// polkit rule and the live behaviour are covered by unit tests and by
// docs/security/ops-agent.md (verified on the server).

test.describe("/status for a Visitor", () => {
  test("shows service names and states only, with the Demo label", async ({
    page,
  }) => {
    await page.goto("/status");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator("[data-overall]")).toBeVisible();
    await expect(page.locator('[data-source="demo"]').first()).toContainText(
      "Demo data",
    );
    const list = page.locator("[data-public-list]");
    await expect(list.locator("li[data-service]")).toHaveCount(13);
    await expect(list.locator('li[data-service="ollama"]')).toContainText(
      "Degraded",
    );
    await expect(list.locator('li[data-service="dovecot"]')).toContainText(
      "Unknown",
    );
    // No history, uptime, incident or form for a Visitor.
    await expect(page.locator("[data-history]")).toHaveCount(0);
    await expect(page.locator("[data-incidents]")).toHaveCount(0);
    await expect(page.locator("[data-open-incident]")).toHaveCount(0);
    const body = await page.locator("main").innerText();
    expect(body).not.toContain("Nexus AI answers slower than usual");
    expect(body).not.toMatch(/Uptime 24h|\d+ ms/);
  });

  test("passes the accessibility check and does not overflow", async ({
    page,
  }) => {
    await page.goto("/status");
    expect(await blockingViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe("/status for a Viewer", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "viewer");
  });

  test("adds uptime, the 24-hour history and incidents with updates", async ({
    page,
  }) => {
    await page.goto("/status");
    const table = page.locator("[data-history]");
    await expect(table).toBeVisible();
    for (const heading of ["Uptime 24h", "Uptime 7d", "Uptime 30d"]) {
      await expect(
        table.getByRole("columnheader", { name: heading }),
      ).toBeVisible();
    }
    // A service that was never checked says so, instead of 100%.
    await expect(table.locator('tr[data-service="dovecot"]')).toContainText(
      "No data",
    );
    const incidents = page.locator("[data-incidents]");
    await expect(incidents.locator("li[data-incident]")).toHaveCount(3);
    await expect(incidents).toContainText("Nexus AI answers slower than usual");
    await expect(incidents).toContainText("Watching latency");
    // A Viewer cannot manage incidents.
    await expect(page.locator("[data-open-incident]")).toHaveCount(0);
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("hides the Operator controls on the services page", async ({ page }) => {
    await page.goto("/command/services");
    await expect(page.getByRole("heading", { name: "Operations" })).toHaveCount(
      0,
    );
    await expect(page.locator("[data-ops-panel]")).toHaveCount(0);
  });
});

for (const role of ["operator", "admin"] as const) {
  test.describe(`${role} in a demo session`, () => {
    test.beforeEach(async ({ context, baseURL }) => {
      await signInAs(context, baseURL, role);
    });

    test("sees the incident forms, disabled with the Demo explanation", async ({
      page,
    }) => {
      await page.goto("/status");
      const form = page.locator("[data-open-incident]");
      await expect(form).toBeVisible();
      await expect(
        form.getByRole("button", { name: "Open incident" }),
      ).toBeDisabled();
      await expect(form.getByLabel("Title")).toBeDisabled();
      await expect(form.locator("[data-demo-note]")).toContainText(
        "Demo session",
      );
    });

    test("sees the operations panel with every control disabled and an explanation", async ({
      page,
    }) => {
      await page.goto("/command/services");
      const panel = page.locator("[data-ops-panel]");
      await expect(panel).toBeVisible();
      await expect(panel.locator("[data-demo-note]")).toContainText(
        "Demo session",
      );
      for (const section of ["health", "logs", "restart"]) {
        await expect(
          panel.locator(`[data-ops-${section}] fieldset`),
        ).toHaveAttribute("disabled", "");
      }
      await expect(
        panel.getByRole("button", { name: "Restart…" }),
      ).toBeDisabled();
      await expect(
        panel.getByRole("button", { name: "Run check" }),
      ).toBeDisabled();
      expect(await blockingViolations(page)).toEqual([]);
    });
  });
}
