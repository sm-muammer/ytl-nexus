import { expect, test } from "@playwright/test";
import { blockingViolations, horizontalOverflow } from "./helpers";

test.describe("Yes Experience (/yes/*)", () => {
  test("renders home overview with cherry-blossom branding and backlink to Nexus", async ({
    page,
  }) => {
    await page.goto("/yes");

    // Landmarks
    await expect(
      page.getByRole("heading", { name: /Malaysia’s/i }),
    ).toBeVisible();
    await expect(
      page.getByText("Experience Concept · Integrated with Nexus Core"),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "← Back to Nexus" }),
    ).toBeVisible();

    // Section nav
    await expect(
      page.getByRole("link", { name: "Explore 5G Plans" }),
    ).toHaveAttribute("href", "/yes/plans");
    await expect(
      page.getByRole("link", { name: "Check Area Coverage" }),
    ).toHaveAttribute("href", "/yes/coverage");

    // Official destinations
    const officialLinks = page.locator('a[href^="https://www.yes.my"]');
    expect(await officialLinks.count()).toBeGreaterThanOrEqual(1);

    // No severe axe violations
    const violations = await blockingViolations(page);
    expect(violations).toEqual([]);
  });

  test("plans page displays 5G plans with clear concept disclaimer and official links", async ({
    page,
  }) => {
    await page.goto("/yes/plans");

    await expect(
      page.getByRole("heading", { name: /5G Infinite Plan/i }),
    ).toBeVisible();
    await expect(
      page.getByText(/Concept design – not live pricing/i).first(),
    ).toBeVisible();

    // Check plan cards
    await expect(page.getByText("Yes 5G Infinite Basic")).toBeVisible();
    await expect(page.getByText("Yes 5G Infinite Standard")).toBeVisible();
    await expect(page.getByText("Yes 5G Infinite Premium")).toBeVisible();

    // Verify select plan button links to official yes.my
    const selectBtn = page
      .getByRole("link", { name: /Select Plan on yes.my/i })
      .first();
    await expect(selectBtn).toHaveAttribute(
      "href",
      "https://www.yes.my/postpaid/",
    );
  });

  test("coverage page validates input and displays honest confirmation", async ({
    page,
  }) => {
    await page.goto("/yes/coverage");

    await expect(
      page.getByRole("heading", { name: /Check Your 5G Coverage/i }),
    ).toBeVisible();

    // Trigger validation error on short query
    const input = page.getByLabel(/Enter Location, Postcode, or Area/i);
    await input.fill("kl");
    await page.getByRole("button", { name: "Check" }).click();

    await expect(
      page.getByText(/Please enter at least 3 characters/i),
    ).toBeVisible();

    // Enter valid location and check honest confirmation
    await input.fill("Kuala Lumpur Sentral");
    await page.getByRole("button", { name: "Check" }).click();

    await expect(page.getByText("5G Signal Available")).toBeVisible();
    await expect(page.getByText("Kuala Lumpur Sentral")).toBeVisible();
    await expect(page.getByText(/Honest confirmation note/i)).toBeVisible();
  });

  test("support page validates form inputs and displays honest confirmation", async ({
    page,
  }) => {
    await page.goto("/yes/support");

    await expect(
      page.getByRole("heading", { name: /Customer Help & Support/i }),
    ).toBeVisible();

    // FAQs visible
    await expect(
      page.getByText("How do I check my 5G coverage?"),
    ).toBeVisible();

    // Empty submission triggers per-field errors
    await page.getByRole("button", { name: "Submit Support Inquiry" }).click();
    await expect(
      page.getByText(/Name must be at least 2 characters/i),
    ).toBeVisible();

    // Valid form submission
    await page.getByLabel("Full Name").fill("Test User");
    await page.getByLabel("Email Address").fill("tester@example.com");
    await page.getByLabel("Subject").fill("5G Roaming Inquiry");
    await page
      .getByLabel("Message Details")
      .fill("Inquiry regarding 5G roaming packages and rates.");
    await page.getByRole("button", { name: "Submit Support Inquiry" }).click();

    // Honest confirmation
    await expect(page.getByText(/Inquiry Drafted Successfully/i)).toBeVisible();
    await expect(page.getByText(/Honest Confirmation Notice/i)).toBeVisible();
  });

  test("chatbot persists user message after response and works on narrow screens", async ({
    page,
  }) => {
    // Test on 390px mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/yes");

    // Check no horizontal scrollbar on 390px
    const overflow = await horizontalOverflow(page);
    expect(overflow).toBe(0);

    // Open chatbot
    const openBtn = page.getByRole("button", {
      name: "Open Yes 5G assistant chat",
    });
    await openBtn.click();

    const dialog = page.getByRole("dialog", {
      name: "Yes 5G Assistant Chatbot",
    });
    await expect(dialog).toBeVisible();

    // Ask question
    const chatInput = page.getByPlaceholder(/Ask about 5G plans/i);
    await chatInput.fill("What 5G plans are available?");
    await page.getByRole("button", { name: "Send message" }).click();

    // Regression check: User message MUST persist in message history!
    await expect(page.getByText("What 5G plans are available?")).toBeVisible();

    // Bot response arrives
    await expect(page.getByText(/Yes 5G/i).first()).toBeVisible({
      timeout: 10_000,
    });

    // User message is STILL visible after bot responds (stale-state regression prevented)
    await expect(page.getByText("What 5G plans are available?")).toBeVisible();

    // Check horizontal overflow stays 0 with open chat
    expect(await horizontalOverflow(page)).toBe(0);
  });

  test("mobile navigation opens drawer and links navigate correctly", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/yes");

    const menuToggle = page.getByRole("button", { name: "Open Yes menu" });
    await expect(menuToggle).toBeVisible();
    await menuToggle.click();

    const mobileNav = page.locator("#yes-mobile-nav");
    await expect(mobileNav).toBeVisible();
    await expect(mobileNav.getByRole("link", { name: "Plans" })).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "Coverage" }),
    ).toBeVisible();
    await expect(
      mobileNav.getByRole("link", { name: "Support" }),
    ).toBeVisible();
  });
});
