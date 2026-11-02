import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import type { Role } from "@/lib/roles";

export const WIDTHS = [390, 1440, 3840] as const;

/** Presents the demo session for a role without clicking through the switcher. */
export async function signInAs(
  context: BrowserContext,
  baseURL: string | undefined,
  role: Role,
) {
  await context.addCookies([
    { name: DEMO_ROLE_COOKIE, value: role, url: baseURL ?? "http://127.0.0.1" },
  ]);
}

/** Waits until entrance animations (data-reveal) have finished. */
export async function settle(page: Page) {
  await page.waitForFunction(() =>
    [...document.querySelectorAll("[data-reveal]")].every(
      (el) => getComputedStyle(el).opacity === "1",
    ),
  );
}

export async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.length} nodes)`);
}

export async function horizontalOverflow(page: Page) {
  return page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
}

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { expect };
