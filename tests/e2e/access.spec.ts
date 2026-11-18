import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { ROLE_RANK, ROLES, type Role } from "@/lib/roles";
import { PAGE_MATRIX } from "../helpers/role-matrix";
import { blockingViolations, expect, signInAs } from "./helpers";
import { test } from "@playwright/test";

// Requirements 6.3, 6.4, 6.11, 6.26: every page against the Visitor and each of
// the four roles, over real HTTP with redirects switched off, so the status
// code the guard produced is the one asserted. These run on the demo session,
// which uses the same guards; the live equivalents are in tests/integration and
// in auth-live.spec.ts.

const actors: (Role | null)[] = [null, ...ROLES];

function expectedStatus(path: string, role: Role | null): number {
  const min = PAGE_MATRIX[path];
  if (min === undefined) throw new Error(`no matrix row for ${path}`);
  if (min === null || (role !== null && ROLE_RANK[role] >= ROLE_RANK[min])) {
    return 200;
  }
  return role === null ? 307 : 403;
}

test.describe("every page against every actor", () => {
  for (const [path, min] of Object.entries(PAGE_MATRIX)) {
    for (const role of actors) {
      test(`${path} for ${role ?? "a Visitor"}`, async ({
        request,
        baseURL,
      }) => {
        const res = await request.get(path, {
          maxRedirects: 0,
          headers: role ? { cookie: `${DEMO_ROLE_COOKIE}=${role}` } : {},
        });
        expect(res.status()).toBe(expectedStatus(path, role));
        if (res.status() === 307) {
          const to = new URL(res.headers()["location"] ?? "", baseURL);
          expect(to.pathname).toBe("/signin");
          expect(to.searchParams.get("next")).toBe(path);
        }
        if (min !== null && res.status() === 200) {
          expect(res.headers()["cache-control"] ?? "").not.toMatch(/public/);
        }
      });
    }
  }
});

test.describe("/control (requirement 6.11)", () => {
  for (const role of actors.filter((r) => r !== "admin")) {
    test(`answers ${role ?? "a Visitor"} with the 404 of an unknown path`, async ({
      page,
      context,
      baseURL,
    }) => {
      if (role) await signInAs(context, baseURL, role);
      const control = await page.goto("/control");
      expect(control?.status()).toBe(404);
      const controlText = await page.locator("body").innerText();
      const controlTitle = await page.title();

      const unknown = await page.goto("/this-page-does-not-exist");
      expect(unknown?.status()).toBe(404);
      expect(await page.locator("body").innerText()).toBe(controlText);
      expect(await page.title()).toBe(controlTitle);
    });
  }

  test("sends a Visitor exactly the HTML of an unknown path (Proxy rewrite)", async ({
    request,
  }) => {
    // Read as a crawler or curl would: the server's own HTML before any
    // JavaScript runs. Script tags carry per-route data, so they are removed.
    const strip = (html: string) =>
      html
        .replace(/<script[\s\S]*?<\/script>/g, "")
        .replace(/\snonce="[^"]*"/g, "");
    for (const path of ["/control", "/control/users"]) {
      const control = await request.get(path);
      const unknown = await request.get("/this-page-does-not-exist");
      expect(control.status()).toBe(404);
      expect(unknown.status()).toBe(404);
      expect(strip(await control.text())).toBe(strip(await unknown.text()));
      expect(control.headers()["content-type"]).toBe(
        unknown.headers()["content-type"],
      );
    }
  });

  test("covers everything below /control", async ({ request }) => {
    const res = await request.get("/control/users", {
      maxRedirects: 0,
      headers: { cookie: `${DEMO_ROLE_COOKIE}=member` },
    });
    expect(res.status()).toBe(404);
  });

  test("is shown to an Administrator, with a noindex tag and no link from the public site", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    const res = await page.goto("/control");
    expect(res?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      page.getByRole("heading", { name: "Accounts", exact: true }),
    ).toBeVisible();
    // Visitor navigation never lists it.
    await context.clearCookies();
    await page.goto("/");
    await expect(page.locator('a[href="/control"]')).toHaveCount(0);
  });

  test("does not send non-administrators to sign-in, which would reveal the area", async ({
    request,
  }) => {
    const res = await request.get("/control", { maxRedirects: 0 });
    expect(res.status()).toBe(404);
    expect(res.headers()["location"]).toBeUndefined();
  });
});

test.describe("403 page for a signed-in role that is too low", () => {
  test("a Viewer opening /ai sees a plain message inside the shell, and it passes axe", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "viewer");
    const res = await page.goto("/ai");
    expect(res?.status()).toBe(403);
    await expect(
      page.getByRole("heading", { name: /do not have access/i }),
    ).toBeVisible();
    await expect(page.locator("main")).toHaveCount(1);
    expect(await blockingViolations(page)).toEqual([]);
    // It names neither the page nor the role that was needed.
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/member|operator|administrator role/i);
  });
});

test.describe("sign-in page in Demo_Mode", () => {
  test("explains that demo sessions replace accounts and has no form to submit", async ({
    page,
  }) => {
    const res = await page.goto("/signin");
    expect(res?.status()).toBe(200);
    await expect(
      page.getByRole("heading", { name: "Demo session", level: 2 }),
    ).toBeVisible();
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
    expect(await blockingViolations(page)).toEqual([]);
  });

  test("the auth HTTP route does not exist in demo mode", async ({
    request,
  }) => {
    expect((await request.get("/api/auth/get-session")).status()).toBe(404);
    const post = await request.post("/api/auth/sign-in/email", {
      data: { email: "a@b.co", password: "x" },
    });
    expect(post.status()).toBe(404);
  });
});

test.describe("Control in a demo session", () => {
  test("lists example accounts and changes nothing", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL, "admin");
    await page.goto("/control");
    const rows = page.locator("[data-user-row]");
    await expect(rows).toHaveCount(4);
    await rows
      .first()
      .getByRole("button", { name: /reset password/i })
      .click();
    await expect(
      rows.first().locator("form").first().getByRole("status"),
    ).toContainText(/demo session/i);
    expect(await blockingViolations(page)).toEqual([]);
  });
});
