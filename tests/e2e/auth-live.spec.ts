import mysql from "mysql2/promise";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { totpCode } from "../helpers/totp";

// The real thing, end to end: a production build in Live_Mode, a browser, a
// MariaDB, Better Auth. It proves what no unit test can: Server Functions set
// the cookie, the Proxy redirects, enrolment and Step_Up work through the UI, and
// the audit trail fills.
//
// Opt-in, because it needs the throwaway database and a live-mode server:
//
//   npm run db:test:up
//   node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON scripts/e2e/prepare-live.ts > /tmp/live-e2e.env
//   (set -a; . /tmp/live-e2e.env; set +a; PORT=3101 npm run start -- -p 3101)   # after npm run build
//   (set -a; . /tmp/live-e2e.env; set +a; E2E_LIVE=1 E2E_BASE_URL=http://127.0.0.1:3101 npx playwright test auth-live)
//
// Each describe block uses its own source address (the header Apache would set),
// so the sign-in lockout of one block never affects another.

test.skip(!process.env.E2E_LIVE, "needs a live-mode server; see the header");
test.describe.configure({ mode: "serial" });

const PASSWORD = "live e2e password 1";

/** The form's own message; Next.js has a second role="alert" for route changes. */
const formAlert = (page: Page) => page.locator("form").getByRole("alert");

const as = (ip: string) => ({ extraHTTPHeaders: { "x-real-ip": ip } });

async function fillSignIn(
  page: Page,
  email: string,
  password: string,
  next?: string,
) {
  await page.goto(`/signin${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function signOut(page: Page) {
  await page.locator("[data-session-label]").click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL((url) => url.pathname === "/");
}

/** Enrols the signed-in Operator or Administrator and returns the authenticator key. */
async function enrol(page: Page): Promise<string> {
  await expect(page).toHaveURL(/step=enrol/);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Continue" }).click();
  const key = (await page.locator("code").first().innerText()).trim();
  expect(key).toMatch(/^[A-Z2-7]{16,}$/);
  await expect(page.getByRole("img", { name: /QR code/ })).toBeVisible();
  await expect(page.locator("ul.font-mono li").first()).toBeVisible();

  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Turn on two-factor" }).click();
  await expect(formAlert(page)).toContainText(/did not work/);

  await page.getByLabel("6-digit code").fill(totpCode(key));
  await page.getByRole("button", { name: "Turn on two-factor" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/signin"));
  return key;
}

async function signInWithTotp(
  page: Page,
  email: string,
  key: string,
  next = "/command",
) {
  await fillSignIn(page, email, PASSWORD, next);
  await expect(page).toHaveURL(/step=totp/);
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(formAlert(page)).toContainText(/did not work/);
  await page.getByLabel("6-digit code").fill(totpCode(key));
  await page.getByRole("button", { name: "Continue" }).click();
  await page.waitForURL((url) => url.pathname === next);
}

/** A fresh browser: sign in with a code, then pass Step_Up on /control. */
async function openControl(page: Page, key: string) {
  await signInWithTotp(page, "admin@example.com", key, "/control");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByLabel("6-digit code").fill(totpCode(key));
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
}

async function status(page: Page, path: string): Promise<number> {
  const res = await page.goto(path);
  return res?.status() ?? 0;
}

async function newPage(browser: Browser, ip: string) {
  const context = await browser.newContext(as(ip));
  return { context, page: await context.newPage() };
}

async function audit(where: string, ...params: unknown[]) {
  const db = await mysql.createConnection({
    host: process.env.NEXUS_DB_HOST,
    port: Number(process.env.NEXUS_DB_PORT),
    database: process.env.NEXUS_DB_NAME,
    user: process.env.NEXUS_DB_USER,
    password: process.env.NEXUS_DB_PASSWORD,
  });
  const [rows] = await db.query(
    `SELECT actor_id, role, action, target, result, source_ip FROM audit_events WHERE ${where} ORDER BY id`,
    params,
  );
  await db.end();
  return rows as Record<string, string | null>[];
}

test.describe("Visitor and Viewer", () => {
  test.use(as("10.90.0.1"));

  test("a Visitor is sent to sign-in by the Proxy, and /control is a plain 404", async ({
    page,
  }) => {
    await page.goto("/command");
    await expect(page).toHaveURL(/\/signin\?next=%2Fcommand/);

    const control = await page.goto("/control");
    expect(control?.status()).toBe(404);
    expect(new URL(page.url()).pathname).toBe("/control");
    const controlText = await page.locator("body").innerText();
    const controlTitle = await page.title();
    await page.goto("/this-page-does-not-exist");
    expect(await page.locator("body").innerText()).toBe(controlText);
    expect(await page.title()).toBe(controlTitle);
  });

  test("a Viewer signs in, sees the right pages, and is refused the rest", async ({
    page,
    context,
  }) => {
    await fillSignIn(page, "viewer@example.com", PASSWORD, "/command");
    await page.waitForURL((url) => url.pathname === "/command");
    await expect(
      page.getByRole("heading", { name: "Nexus Command", level: 1 }),
    ).toBeVisible();

    const session = (await context.cookies()).find((c) =>
      c.name.includes("session_token"),
    );
    expect(session).toBeDefined();
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe("Lax");

    expect(await status(page, "/ai")).toBe(403);
    await expect(
      page.getByRole("heading", { name: /do not have access/i }),
    ).toBeVisible();
    expect(await status(page, "/control")).toBe(404);

    await page.goto("/command");
    await page.locator("[data-session-label]").click();
    await expect(
      page.getByRole("dialog").getByText("Nexus Control"),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    await signOut(page);
    await page.goto("/command");
    await expect(page).toHaveURL(/\/signin/);
  });

  test("a signed-in person who opens /signin is sent on", async ({ page }) => {
    await fillSignIn(page, "member@example.com", PASSWORD, "/ai");
    await page.waitForURL((url) => url.pathname === "/ai");
    await page.goto("/signin");
    await page.waitForURL((url) => url.pathname === "/");
  });

  test("it never sends the visitor to an address outside the site after sign-in", async ({
    page,
  }) => {
    await fillSignIn(
      page,
      "viewer@example.com",
      PASSWORD,
      "https://evil.example/x",
    );
    await page.waitForURL((url) => url.pathname === "/");
    expect(new URL(page.url()).origin).toBe(
      new URL(process.env.E2E_BASE_URL ?? "http://127.0.0.1:3101").origin,
    );
  });
});

test.describe("wrong passwords and lockout", () => {
  test.use(as("10.90.0.2"));

  test("five failures lock the account for 15 minutes, with a clear message", async ({
    page,
  }) => {
    for (let i = 0; i < 5; i++) {
      await fillSignIn(page, "lockme@example.com", "not the password!!");
      await expect(formAlert(page)).toContainText(
        "email or password is not correct",
      );
    }
    await fillSignIn(page, "lockme@example.com", PASSWORD);
    await expect(formAlert(page)).toContainText("Try again in 15 minutes");
    await expect(page).toHaveURL(/\/signin/);

    const rows = await audit(
      "action = 'auth.sign-in' AND result = 'denied' AND target = ?",
      "lockme@example.com",
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]?.source_ip).toBe("10.90.0.2");
  });
});

test.describe("Operator two-factor", () => {
  test.use(as("10.90.0.3"));
  let key = "";

  test("is held at enrolment on every page until two-factor is on", async ({
    page,
  }) => {
    await fillSignIn(page, "operator@example.com", PASSWORD, "/command");
    await expect(page).toHaveURL(/step=enrol/);
    await page.goto("/command");
    await expect(page).toHaveURL(/step=enrol/);
    await page.goto("/shield");
    await expect(page).toHaveURL(/step=enrol/);

    // The last page asked for is where enrolment returns to.
    key = await enrol(page);
    await expect(page).toHaveURL(/\/shield$/);
    await expect(
      page.getByRole("heading", { name: "Nexus Shield", level: 1 }),
    ).toBeVisible();
    await signOut(page);
  });

  test("then needs a code at every sign-in, and opens the Operator pages", async ({
    page,
  }) => {
    await signInWithTotp(page, "operator@example.com", key);
    expect(await status(page, "/shield")).toBe(200);
    expect(await status(page, "/control")).toBe(404);
  });
});

test.describe("Administrator, Step_Up and Control", () => {
  test.use(as("10.90.0.4"));
  let key = "";

  test("enrols two-factor, then Control asks to confirm before showing anything", async ({
    page,
  }) => {
    await fillSignIn(page, "admin@example.com", PASSWORD, "/control");
    key = await enrol(page);
    await signOut(page);
    await signInWithTotp(page, "admin@example.com", key, "/control");

    await expect(
      page.getByRole("heading", { name: "Confirm it is you" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Accounts" })).toHaveCount(
      0,
    );
    await expect(page.locator("main")).not.toContainText("member@example.com");

    await page.getByLabel("Password").fill("not the password!!");
    await page.getByLabel("6-digit code").fill(totpCode(key));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(formAlert(page)).toContainText("not correct");
    await expect(page.getByRole("heading", { name: "Accounts" })).toHaveCount(
      0,
    );

    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByLabel("6-digit code").fill(totpCode(key));
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible();
    await expect(page.locator("[data-user-row]")).toHaveCount(7);
  });

  test("resets a password without email, and the old password stops working", async ({
    page,
    browser,
  }) => {
    await openControl(page, key);

    const row = page.locator("[data-user-row]", {
      hasText: "resetme@example.com",
    });
    await row
      .getByRole("button", { name: /Reset password for resetme/ })
      .click();
    const shown = row.getByRole("status").filter({ hasText: "shown once" });
    await expect(shown).toBeVisible();
    const fresh = (await shown.locator("code").innerText()).trim();
    expect(fresh.length).toBeGreaterThanOrEqual(24);

    const other = await newPage(browser, "10.90.0.5");
    await fillSignIn(other.page, "resetme@example.com", PASSWORD);
    await expect(formAlert(other.page)).toContainText("not correct");
    await fillSignIn(other.page, "resetme@example.com", fresh, "/ai");
    await other.page.waitForURL((url) => url.pathname === "/ai");
    await other.context.close();
  });

  test("ends another person's sessions, and their next request needs a sign-in", async ({
    page,
    browser,
  }) => {
    const victim = await newPage(browser, "10.90.0.6");
    await fillSignIn(victim.page, "victim@example.com", PASSWORD, "/ai");
    await victim.page.waitForURL((url) => url.pathname === "/ai");

    await openControl(page, key);
    const row = page.locator("[data-user-row]", {
      hasText: "victim@example.com",
    });
    await row.getByRole("button", { name: /End sessions for victim/ }).click();
    await expect(
      row.getByRole("status").filter({ hasText: "were ended" }),
    ).toBeVisible();

    await victim.page.goto("/ai");
    await expect(victim.page).toHaveURL(/\/signin/);
    await victim.context.close();
  });

  test("the audit trail holds the attempts, the refusals and the actions", async () => {
    const refusals = await audit(
      "action = 'access.page' AND target = '/control' AND result = 'refused'",
    );
    expect(refusals.length).toBeGreaterThanOrEqual(2);
    expect(refusals.every((r) => r.source_ip?.startsWith("10.90."))).toBe(true);

    const stepUps = await audit("action = 'auth.step-up'");
    expect(stepUps.map((r) => r.result)).toEqual(
      expect.arrayContaining(["failure", "success"]),
    );

    const resets = await audit("action = 'control.user.reset-password'");
    expect(resets).toHaveLength(1);
    expect(resets[0]).toMatchObject({ result: "success", role: "admin" });
    const revokes = await audit("action = 'control.user.revoke-sessions'");
    expect(revokes).toHaveLength(1);

    const signIns = await audit(
      "action = 'auth.sign-in.email' AND result = 'success'",
    );
    expect(signIns.length).toBeGreaterThanOrEqual(5);
    // No password or code ever appears in the trail.
    const all = JSON.stringify(await audit("1 = 1"));
    expect(all).not.toContain(PASSWORD);
  });
});
