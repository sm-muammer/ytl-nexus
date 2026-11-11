import { test } from "@playwright/test";
import {
  blockingViolations,
  expect,
  horizontalOverflow,
  signInAs,
} from "./helpers";

// Nexus Transfer in demo mode (TRF-09, TRF-10, requirements 12.15 and 12.22). Demo
// reads fixtures, so these checks cover what each role sees and that every
// management control is switched off. The live SFTP checks run on the server
// with infrastructure/scripts/verify-sftp.

test.describe("/transfer, member", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "member");
  });

  test("shows the member's own account, quota, keys and the portal link", async ({
    page,
  }) => {
    await page.goto("/transfer");
    await expect(
      page.getByRole("heading", { level: 1, name: "Nexus Transfer" }),
    ).toBeVisible();
    await expect(page.locator('[data-source="demo"]').first()).toContainText(
      "Demo",
    );
    const account = page.locator("[data-transfer-account]");
    await expect(account).toContainText("demo-member");
    await expect(account).toContainText("port 2022");
    await expect(page.locator("[data-quota]")).toContainText(
      "412.0 MB used of 2.0 GB (20%)",
    );
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "20",
    );
    await expect(page.locator("[data-transfer-keys]")).toContainText(
      "ssh-ed25519 · laptop",
    );
    await expect(
      page.getByRole("link", { name: "Open the file portal" }),
    ).toHaveAttribute("href", "/files/");
  });

  test("never shows another person's account", async ({ page }) => {
    await page.goto("/transfer");
    const text = await page.locator("main").innerText();
    expect(text).not.toContain("demo-operator");
    expect(text).not.toContain("demo-archive");
  });

  test("ignores an account name in the address", async ({ page }) => {
    await page.goto("/transfer?username=demo-operator&account=demo-operator");
    const text = await page.locator("main").innerText();
    expect(text).toContain("demo-member");
    expect(text).not.toContain("demo-operator");
  });

  test("has the four client guides with port 2022 and the exact terminal command", async ({
    page,
  }) => {
    await page.goto("/transfer");
    for (const id of ["winscp", "filezilla", "cyberduck", "terminal"]) {
      await expect(page.locator(`[data-guide="${id}"]`)).toHaveCount(1);
    }
    await page.locator('[data-guide="terminal"] summary').click();
    await expect(
      page.locator('[data-guide="terminal"] code').first(),
    ).toHaveText("sftp -P 2022 demo-member@ytl-nexus.example");
    await page.locator('[data-guide="winscp"] summary').click();
    await expect(page.locator('[data-guide="winscp"]')).toContainText("2022");
  });

  test("has no management controls", async ({ page }) => {
    await page.goto("/transfer");
    const main = page.locator("main");
    await expect(main.locator("form")).toHaveCount(0);
    await expect(main.getByRole("textbox")).toHaveCount(0);
    await expect(main.getByRole("button")).toHaveCount(0);
  });

  test("has no serious accessibility violations and no sideways scroll", async ({
    page,
  }) => {
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/transfer");
      await page.locator('[data-guide="terminal"] summary').click();
      expect(await blockingViolations(page)).toEqual([]);
      expect(await horizontalOverflow(page)).toBe(0);
    }
  });
});

test.describe("/transfer, administrator without an account", () => {
  test("says no account exists and that none is created automatically", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.goto("/transfer");
    const notice = page.locator('[data-transfer-state="no-account"]');
    await expect(notice).toContainText("not created automatically");
    await expect(page.locator("[data-transfer-account]")).toHaveCount(0);
  });
});

test.describe("/transfer, below member", () => {
  test("sends a visitor to sign in and refuses a viewer", async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto("/transfer");
    await expect(page).toHaveURL(/\/signin/);
    await signInAs(context, baseURL, "viewer");
    const response = await page.goto("/transfer");
    expect(response?.status()).toBe(403);
  });
});

test.describe("Control, file transfer accounts (demo)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "admin");
  });

  test("lists the accounts with the Demo label and every control disabled", async ({
    page,
  }) => {
    await page.goto("/control");
    const section = page.locator("[data-control-transfer]");
    await expect(section).toContainText("File transfer accounts");
    await expect(section.locator('[data-source="demo"]')).toBeVisible();
    await expect(section.locator("[data-transfer-row]")).toHaveCount(3);
    await expect(section).toContainText("demo-archive");
    await expect(section).toContainText("not linked to a Nexus account");

    await section.locator("[data-transfer-row] summary").first().click();
    const fields = section.locator(
      "input:not([type=hidden]), textarea, select",
    );
    expect(await fields.count()).toBeGreaterThan(5);
    for (const field of await fields.all()) {
      await expect(field).toBeDisabled();
    }
    const buttons = section.getByRole("button");
    expect(await buttons.count()).toBeGreaterThan(5);
    for (const button of await buttons.all()) {
      await expect(button).toBeDisabled();
    }
  });

  test("offers only people without an account when creating one", async ({
    page,
  }) => {
    await page.goto("/control");
    const options = await page
      .locator("#new-userId option:not([disabled])")
      .allInnerTexts();
    expect(options.join(" ")).not.toContain("Demo Member");
    expect(options.join(" ")).toContain("Demo Administrator");
  });

  test("has no serious accessibility violations and no sideways scroll", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto("/control");
    await page.locator("[data-transfer-row] summary").first().click();
    expect(await blockingViolations(page)).toEqual([]);
    expect(await horizontalOverflow(page)).toBe(0);
  });
});
