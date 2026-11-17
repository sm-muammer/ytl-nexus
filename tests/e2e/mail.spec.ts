import { test } from "@playwright/test";
import {
  blockingViolations,
  expect,
  horizontalOverflow,
  signInAs,
} from "./helpers";

// Nexus Mail in demo mode (MAIL-09, MAIL-10). Covers what each role sees on /mail
// and in Control, and proves that controls are safely disabled in demo mode.

test.describe("/mail, member", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "member");
  });

  test("shows service status, webmail link, member's own mailbox and settings", async ({
    page,
  }) => {
    await page.goto("/mail");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nexus Mail" }),
    ).toBeVisible();

    // Status & webmail button
    await expect(page.locator("[data-mail-status]")).toContainText("Healthy");
    await expect(
      page.getByRole("link", { name: "Open Roundcube Webmail" }),
    ).toHaveAttribute("href", "/webmail/");

    // Own mailbox
    const mailbox = page.locator("[data-mail-mailbox]");
    await expect(mailbox).toContainText("demo-member@ytl-nexus.internal");
    await expect(mailbox).toContainText("Active");

    // Client settings
    const settings = page.locator("[data-mail-settings]");
    await expect(settings).toContainText("ytl-nexus.example");
    await expect(settings).toContainText("Port 993");
    await expect(settings).toContainText("Port 587");
    await expect(settings).toContainText("SSL/TLS");
    await expect(settings).toContainText("STARTTLS");

    // Setup and guides
    await expect(page.locator("[data-mail-help]")).toContainText(
      "Setup and guides",
    );
  });

  test("never shows another person's mailbox", async ({ page }) => {
    await page.goto("/mail");
    const text = await page.locator("main").innerText();
    expect(text).toContain("demo-member@ytl-nexus.internal");
    expect(text).not.toContain("demo-operator@ytl-nexus.internal");
    expect(text).not.toContain("svc-alerts@ytl-nexus.internal");
  });

  test("passes accessibility checks and does not overflow at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/mail");
    expect(await blockingViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});

test.describe("/mail, role gating", () => {
  test("refuses viewers with 403", async ({ context, baseURL, page }) => {
    await signInAs(context, baseURL, "viewer");
    const response = await page.goto("/mail");
    expect(response?.status()).toBe(403);
  });
});

test.describe("Control, mailboxes (demo)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "admin");
  });

  test("lists the mailboxes with Demo label and every control disabled", async ({
    page,
  }) => {
    await page.goto("/control");
    const section = page.locator("[data-control-mail]");
    await expect(section).toContainText("Mailboxes");
    await expect(section.locator("[data-mail-row]")).toHaveCount(4);
    await expect(section).toContainText("svc-alerts@ytl-nexus.internal");
    await expect(section).toContainText("service account");

    await section.locator("[data-mail-row] summary").first().click();
    const fields = section.locator(
      "input:not([type=hidden]), textarea, select",
    );
    expect(await fields.count()).toBeGreaterThan(4);
    for (const field of await fields.all()) {
      await expect(field).toBeDisabled();
    }
    const buttons = section.getByRole("button");
    expect(await buttons.count()).toBeGreaterThan(4);
    for (const button of await buttons.all()) {
      await expect(button).toBeDisabled();
    }
  });

  test("passes accessibility checks and does not overflow at 390px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/control");
    await page
      .locator("[data-control-mail] [data-mail-row] summary")
      .first()
      .click();
    expect(await blockingViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
