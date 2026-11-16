import { expect, test } from "@playwright/test";
import { signInAs } from "./helpers";

test.describe("Nexus AI (/ai)", () => {
  test("visitors cannot reach /ai and are redirected to /signin", async ({
    page,
  }) => {
    await page.goto("/ai");
    await expect(page).toHaveURL(/\/signin\?next=%2Fai/);
  });

  test("members can open /ai, view demo badge, and ask questions with streamed response and citations", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "member");
    await page.goto("/ai");

    // Page and components check
    await expect(page.getByRole("heading", { name: "Nexus AI" })).toBeVisible();
    await expect(page.getByText("Nexus AI Assistant")).toBeVisible();
    await expect(page.getByText("Demo data").first()).toBeVisible();

    // Fill question
    const input = page.getByPlaceholder(
      "Ask a question or request an explanation...",
    );
    await input.fill("How do I deploy YTL Nexus?");
    await page.getByRole("button", { name: "Send" }).click();

    // Verify streaming reply appears
    await expect(
      page.getByText("infrastructure/scripts/deploy.sh"),
    ).toBeVisible({
      timeout: 10_000,
    });

    // Verify citation appears
    await expect(
      page.getByText("Platform Deployment & Release Workflow"),
    ).toBeVisible();
  });

  test("navigating from Atlas with Explain query pre-fills and explains service", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "member");
    await page.goto(
      "/ai?explain=" +
        encodeURIComponent(
          'Explain service "nexus-worker": current health, architecture role, and troubleshooting steps.',
        ),
    );

    const input = page.getByPlaceholder(
      "Ask a question or request an explanation...",
    );
    await expect(input).toHaveValue(/Explain service "nexus-worker"/);
  });
});
