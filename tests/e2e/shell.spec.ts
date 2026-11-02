import { expect, test } from "@playwright/test";
import {
  FOOTER_LINKS,
  MODULES,
  NAV_ITEMS,
  PAGES,
  ROUTE_PATHS,
  visibleNav,
} from "@/lib/navigation/modules";
import { ROLES, meetsRole, type Actor, type Role } from "@/lib/roles";
import {
  WIDTHS,
  blockingViolations,
  escapeRegExp,
  horizontalOverflow,
  settle,
  signInAs,
} from "./helpers";

// The workspace register covers every route outside the public "explore"
// group, plus /design and /control (Requirement 3.9).
const publicPaths = new Set([
  "/",
  ...PAGES.filter((p) => p.group === "explore").map((p) => p.path),
]);
const isNoindexRoute = (path: string) => !publicPaths.has(path);

const sheet = "dialog[data-nav-sheet]";

test.describe("every route", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "admin");
  });

  for (const route of ROUTE_PATHS) {
    test(`${route} renders the shell without a not-found response`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBeLessThan(400);

      // Requirement 3.2: one skip link, one h1, the four landmarks.
      await expect(page.locator('a[href="#main-content"]')).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expect(page.locator("header")).toHaveCount(1);
      await expect(page.locator("main#main-content")).toHaveCount(1);
      await expect(page.locator("footer")).toHaveCount(1);
      expect(await page.locator("nav").count()).toBeGreaterThanOrEqual(2);

      // Requirement 3.7: environment badge and Live/Demo label on every page.
      await expect(page.locator("[data-env-badge]").first()).toHaveAttribute(
        "data-mode",
        "demo",
      );
      await expect(page.locator("[data-live-demo]").first()).toHaveAttribute(
        "data-source",
        "demo",
      );

      // Requirement 3.9: noindex on workspace and /control routes.
      const robots = page.locator('meta[name="robots"]');
      if (isNoindexRoute(route)) {
        await expect(robots).toHaveAttribute("content", /noindex/);
      } else {
        await expect(robots).toHaveCount(0);
      }
    });
  }
});

test.describe("skip link and focus order", () => {
  test("the skip link is first and moves focus to the main landmark", async ({
    page,
  }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const skip = page.locator('a[href="#main-content"]');
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();

    await page.keyboard.press("Enter");
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id))
      .toBe("main-content");
  });

  test("focus moves header, then workspace menu, then content, then footer", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/command");

    const region = (el: Element | null) => {
      if (!el) return -1;
      if (el.closest('a[href="#main-content"]')) return 0;
      if (el.closest("header")) return 1;
      if (el.closest('nav[aria-label="Workspace"]')) return 2;
      if (el.closest("main")) return 3;
      if (el.closest("footer")) return 4;
      return -1;
    };

    const seen: number[] = [];
    for (let i = 0; i < 120; i++) {
      await page.keyboard.press("Tab");
      const r = await page.evaluate(
        `(${region.toString()})(document.activeElement)`,
      );
      if (r === -1) break; // focus left the page
      seen.push(r as number);
    }
    expect(seen[0]).toBe(0);
    expect([...new Set(seen)]).toEqual([0, 1, 2, 3, 4]);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));

    const positive = await page.evaluate(
      () =>
        document.querySelectorAll(
          "[tabindex]:not([tabindex^='-']):not([tabindex='0'])",
        ).length,
    );
    expect(positive).toBe(0);
  });
});

test.describe("global navigation and the role-aware menu", () => {
  test("links every module in docs/product.md", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");

    await page.getByRole("button", { name: "All modules" }).click();
    const dialog = page.locator(sheet);
    await expect(dialog).toBeVisible();

    for (const m of MODULES) {
      const link = dialog.getByRole("link", {
        name: new RegExp(escapeRegExp(m.name)),
      });
      await expect(link, m.name).toHaveAttribute("href", m.href);
    }
  });

  for (const role of [null, ...ROLES] as (Role | null)[]) {
    test(`shows ${role ?? "a Visitor"} only the items at or below their role`, async ({
      page,
      context,
      baseURL,
    }) => {
      if (role) await signInAs(context, baseURL, role);
      const actor: Actor = role ? { userId: "x", role } : null;
      await page.goto("/platform");

      for (const m of MODULES) {
        const link = page.locator(`${sheet} a[href="${m.href}"]`);
        await expect(link, `${role} → ${m.name}`).toHaveCount(
          meetsRole(actor, m.minRole) ? 1 : 0,
        );
      }
      const visibleLabels = visibleNav(NAV_ITEMS, actor).map((i) => i.label);
      expect(visibleLabels.includes("Platform")).toBe(true);
    });
  }

  test("the demo session switcher offers exactly four roles and relabels the session", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/platform");
    const strip = page.locator("[data-session-label]");
    await expect(strip).toContainText("Not signed in");

    await page.getByRole("button", { name: "All modules" }).click();
    const group = page.getByRole("group", { name: "Demo session" });
    await expect(group.getByRole("button")).toHaveCount(4);
    await expect(group.getByRole("button")).toHaveText([
      "Viewer",
      "Member",
      "Operator",
      "Administrator",
    ]);

    // The menu stays open, so the presenter sees the change at once.
    await group.getByRole("button", { name: "Administrator" }).click();
    await expect(strip).toContainText("Demo session");
    await expect(strip).toContainText("Administrator");
    await expect(page.locator(`${sheet} a[href="/control"]`)).toHaveCount(1);
    await expect(
      group.getByRole("button", { name: "Administrator" }),
    ).toHaveAttribute("aria-pressed", "true");

    await page.getByRole("button", { name: "Visitor view" }).click();
    await expect(strip).toContainText("Not signed in");
    await expect(page.locator(`${sheet} a[href="/control"]`)).toHaveCount(0);
  });
});

test.describe("contextual sub-navigation", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "viewer");
  });

  const command = MODULES.find((m) => m.slug === "command")!;
  for (const item of command.subNav!) {
    test(`Nexus Command pages show the sections nav (${item.href})`, async ({
      page,
    }) => {
      await page.goto(item.href);
      const nav = page.getByRole("navigation", { name: "Command sections" });
      await expect(nav.getByRole("link")).toHaveCount(command.subNav!.length);
      await expect(nav.locator('[aria-current="page"]')).toHaveAttribute(
        "href",
        item.href,
      );
    });
  }

  test("modules without child routes have no sections nav", async ({
    page,
  }) => {
    await page.goto("/data");
    await expect(
      page.getByRole("navigation", { name: /sections/i }),
    ).toHaveCount(0);
  });
});

test.describe("footer", () => {
  test("has only links that resolve, none to '#' or an empty target", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.goto("/");
    const links = page
      .getByRole("navigation", { name: "Footer" })
      .getByRole("link");
    const hrefs = await links.evaluateAll((els) =>
      els.map((a) => a.getAttribute("href") ?? ""),
    );
    expect(hrefs.length).toBe(FOOTER_LINKS.length);
    for (const href of hrefs) {
      expect(href, "empty or hash-only target").not.toMatch(/^(#.*)?$/);
      if (href.startsWith("/")) {
        const res = await page.request.get(href);
        expect(res.status(), href).toBeLessThan(400);
      } else {
        expect(new URL(href).protocol).toBe("https:");
      }
    }
  });
});

test.describe("mobile navigation at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("replaces the global nav with a menu button that works by keyboard", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByRole("navigation", { name: "Global" })).toBeHidden();

    const button = page.getByRole("button", { name: "Open menu" });
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute("aria-haspopup", "dialog");

    await button.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator(sheet);
    await expect(dialog).toBeVisible();

    // The page behind the modal is inert: focus cycles through the menu (and,
    // at the ends, the browser's own UI, which reads as <body>) but never
    // reaches the header, content or footer behind it.
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const ok = await page.evaluate((s) => {
        const el = document.activeElement;
        return el === document.body || Boolean(el?.closest(s));
      }, sheet);
      expect(ok, `Tab ${i + 1}`).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();
  });

  test("opens and closes by touch, and closes after choosing a link", async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`);

    const button = page.getByRole("button", { name: "Open menu" });
    await button.tap();
    const dialog = page.locator(sheet);
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Close menu" }).tap();
    await expect(dialog).toBeHidden();
    await expect(button).toBeFocused();

    await button.tap();
    await dialog.getByRole("link", { name: /Nexus Tour/ }).tap();
    await expect(page).toHaveURL(/\/tour$/);
    await expect(dialog).toBeHidden();
    await context.close();
  });

  test("every touch target in the header, menu and footer is at least 44 by 44 px", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.goto("/platform");
    await page.getByRole("button", { name: "Open menu" }).click();

    const small = await page.evaluate(() => {
      const found: string[] = [];
      const targets = document.querySelectorAll(
        "header a, header button, header select, dialog[open] a, dialog[open] button, footer a, main a, main button",
      );
      for (const el of targets) {
        if (el.matches('a[href="#main-content"]')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 43.5 || r.height < 43.5) {
          found.push(
            `${el.tagName.toLowerCase()} "${(el.textContent ?? "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
          );
        }
      }
      return found;
    });
    expect(small).toEqual([]);
  });
});

test.describe("accessibility and layout at 390, 1440 and 3840 px", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "admin");
  });

  for (const width of WIDTHS) {
    for (const route of ROUTE_PATHS) {
      test(`${route} at ${width}px: no serious axe violations, no horizontal scroll`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(route);
        await settle(page);

        expect(await blockingViolations(page)).toEqual([]);
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0);
      });
    }
  }

  test("the open menu has no serious axe violations at 390 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/platform");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.locator(sheet)).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("the open menu has no serious axe violations at 1440 px", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/platform");
    await page.getByRole("button", { name: "All modules" }).click();
    await expect(page.locator(sheet)).toBeVisible();
    expect(await blockingViolations(page)).toEqual([]);
  });
});

test.describe("robots.txt", () => {
  test("keeps workspace routes out of search and does not reveal /control", async ({
    request,
  }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const body = await res.text();
    for (const p of [
      "/command",
      "/ai",
      "/transfer",
      "/mail",
      "/data",
      "/continuity",
      "/shield",
      "/design",
      "/api/",
    ]) {
      expect(body, p).toContain(`Disallow: ${p}`);
    }
    expect(body).not.toContain("/control");
  });
});
