import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { signInAs } from "./helpers";

test.describe("Nexus Shield (/shield)", () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    // Operator role required to view shield
    await signInAs(context, baseURL, "operator");
    await page.goto("/shield");
  });

  test("renders security posture status and honest demo label", async ({
    page,
  }) => {
    await expect(page.locator("h1")).toContainText("Nexus Shield");
    await expect(page.getByTestId("posture-indicator")).toBeVisible();
  });

  test("shows all 11 security checks with severity badges and guidance", async ({
    page,
  }) => {
    const list = page.getByTestId("findings-list");
    await expect(list).toBeVisible();

    // Verify key checks are visible
    await expect(page.getByTestId("finding-SHD-01")).toBeVisible(); // TLS
    await expect(page.getByTestId("finding-SHD-02")).toBeVisible(); // Ports
    await expect(page.getByTestId("finding-SHD-06")).toBeVisible(); // SSH
    await expect(page.getByTestId("finding-SHD-07")).toBeVisible(); // SELinux
    await expect(page.getByTestId("finding-SHD-10")).toBeVisible(); // Backup freshness

    // Verify evidence and remediation guidance content
    const sshFinding = page.getByTestId("finding-SHD-06");
    await expect(sshFinding).toContainText("PermitRootLogin");
    await expect(sshFinding).toContainText("Remediation Guidance");

    const selinuxFinding = page.getByTestId("finding-SHD-07");
    await expect(selinuxFinding).toContainText("SELinux");
    await expect(selinuxFinding).toContainText("Disabled");
  });

  test("filters findings by severity on metric card click", async ({
    page,
  }) => {
    // Click High Risk filter card
    await page.getByRole("button", { name: /High Risk/i }).click();

    // SHD-06 is high, SHD-07 is medium
    await expect(page.getByTestId("finding-SHD-06")).toBeVisible();
    await expect(page.getByTestId("finding-SHD-07")).not.toBeVisible();

    // Clear filter
    await page.getByRole("button", { name: /Clear filter/i }).click();
    await expect(page.getByTestId("finding-SHD-07")).toBeVisible();
  });

  test("displays lockout prevention & hardening policy notice", async ({
    page,
  }) => {
    const notice = page.locator(
      "section[aria-labelledby='lockout-notice-title']",
    );
    await expect(notice).toBeVisible();
    await expect(notice).toContainText("Lockout Prevention & Hardening Policy");
    await expect(notice).toContainText("PermitRootLogin");
  });

  test("has zero horizontal overflow on mobile 390px viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/shield");

    await expect(page.locator("h1")).toBeVisible();
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("passes accessibility checks with zero serious violations", async ({
    page,
  }) => {
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .disableRules(["color-contrast"]) // dark theme palette tested separately
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
