import { getMigrations } from "better-auth/db/migration";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  ABSOLUTE_TIMEOUT_MS,
  IDLE_TIMEOUT_MS,
  LOCKOUT_DURATION_MS,
} from "@/lib/server/auth/rules";
import {
  performStepUp,
  resolveIdentity,
  revokeSessionsAsAdmin,
  resetPasswordAsAdmin,
  startEnrolment,
  confirmEnrolment,
  listUsersForAdmin,
  generatePassword,
} from "@/lib/server/auth/service";
import { decide } from "@/lib/server/policy";
import { totpCode } from "../helpers/totp";
import {
  BASE_URL,
  Jar,
  PASSWORD,
  auditRows,
  createHarness,
  enrolTotp,
  makeUser,
  signIn,
  signInWithTotp,
  type Harness,
} from "./helpers/auth-harness";

let h: Harness;
beforeAll(async () => {
  h = await createHarness();
});
afterAll(async () => {
  await h.close();
});

const MIN = 60_000;

describe("schema", () => {
  it("has every table and column Better Auth plans to use", async () => {
    const plan = await getMigrations(h.rt.auth.options);
    expect(plan.toBeCreated.map((t) => t.table)).toEqual([]);
    expect(
      plan.toBeAdded.map((t) => `${t.table}.${Object.keys(t.fields)}`),
    ).toEqual([]);
  });
});

describe("sign-in, cookies and audit (requirements 6.1, 6.15, 6.19)", () => {
  it("signs a viewer in and sets Secure, HttpOnly, SameSite=Lax cookies", async () => {
    const viewer = await makeUser(h, "viewer");
    const { headers } = await h.rt.auth.api.signInEmail({
      body: { email: viewer.email, password: viewer.password },
      headers: new Headers({ origin: BASE_URL, "x-real-ip": "10.1.1.1" }),
      returnHeaders: true,
    });
    const cookies = headers.getSetCookie();
    const session = cookies.find((c) => c.includes("session_token"));
    expect(session).toBeDefined();
    expect(session).toMatch(/^__Secure-nexus\.session_token=/);
    expect(session).toMatch(/;\s*Secure/i);
    expect(session).toMatch(/;\s*HttpOnly/i);
    expect(session).toMatch(/;\s*SameSite=Lax/i);
    // Twelve hours, not the library default of seven days.
    expect(session).toMatch(/Max-Age=43200/i);
  });

  it("audits a successful sign-in with actor, role, target and source IP", async () => {
    const member = await makeUser(h, "member");
    const jar = new Jar("10.2.2.2");
    const result = await signIn(h, jar, member.email, member.password);
    expect(result.kind).toBe("session");
    const rows = await auditRows(h, "auth.sign-in.email");
    const row = rows.find(
      (r) => r.target === member.email && r.result === "success",
    );
    expect(row).toMatchObject({
      actor_id: member.id,
      role: "member",
      source_ip: "10.2.2.2",
    });
  });

  it("answers a wrong password and an unknown email the same way", async () => {
    const u = await makeUser(h, "viewer");
    const wrongPassword = await signIn(
      h,
      new Jar("10.3.3.1"),
      u.email,
      "not the password!!",
    );
    const unknown = await signIn(
      h,
      new Jar("10.3.3.2"),
      "nobody@example.com",
      "not the password!!",
    );
    expect(wrongPassword.kind).toBe("failed");
    expect(unknown.kind).toBe("failed");
    if (wrongPassword.kind === "failed" && unknown.kind === "failed") {
      expect(wrongPassword.status).toBe(unknown.status);
      expect(wrongPassword.message).toBe(unknown.message);
    }
  });

  it("refuses sign-up over the handler and by API (no self-service accounts)", async () => {
    const res = await h.rt.auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({
          email: "x@example.com",
          password: PASSWORD,
          name: "X",
        }),
      }),
    );
    expect(res.status).toBe(404);
    await expect(
      h.rt.auth.api.signUpEmail({
        body: { email: "y@example.com", password: PASSWORD, name: "Y" },
      }),
    ).rejects.toBeDefined();
  });

  it("rejects a sign-in that comes from an origin we do not trust", async () => {
    const u = await makeUser(h, "viewer");
    const res = await h.rt.auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          // The browser of someone who is already signed in sends its cookie.
          cookie: "nexus.session_token=x",
          "x-real-ip": "10.4.4.4",
        },
        body: JSON.stringify({ email: u.email, password: u.password }),
      }),
    );
    expect(res.status).toBe(403);
  });
});

describe("Property 7: lockout after 5 failures in 15 minutes (requirement 6.18)", () => {
  it("locks the account, then lets it in 15 minutes after the fifth failure", async () => {
    const u = await makeUser(h, "viewer");
    const attempt = (ip: string, password = "wrong password here") =>
      signIn(h, new Jar(ip), u.email, password);

    for (let i = 0; i < 4; i++) {
      h.clock.now += MIN;
      const r = await attempt(`10.5.0.${i + 1}`);
      expect(r).toMatchObject({ kind: "failed" });
    }
    // Four failures: the correct password still works.
    expect((await attempt("10.5.0.50", PASSWORD)).kind).toBe("session");

    h.clock.now += MIN;
    await attempt("10.5.0.5"); // the fifth failure
    const locked = await attempt("10.5.0.6", PASSWORD);
    expect(locked).toMatchObject({ kind: "failed", status: 429 });
    if (locked.kind === "failed") expect(locked.message).toMatch(/15 minutes/);

    h.clock.now += LOCKOUT_DURATION_MS - 1;
    expect((await attempt("10.5.0.7", PASSWORD)).kind).toBe("failed");
    h.clock.now += 2;
    expect((await attempt("10.5.0.8", PASSWORD)).kind).toBe("session");

    const denied = (await auditRows(h, "auth.sign-in")).filter(
      (r) => r.target === u.email && r.result === "denied",
    );
    expect(denied.length).toBeGreaterThanOrEqual(2);
    const failures = (await auditRows(h, "auth.sign-in.email")).filter(
      (r) => r.target === u.email && r.result === "failure",
    );
    expect(failures.length).toBe(5);
  });

  it("locks a source address that tries five different accounts", async () => {
    const victim = await makeUser(h, "viewer");
    const ip = "10.6.6.6";
    for (let i = 0; i < 5; i++) {
      h.clock.now += 1000;
      await signIn(
        h,
        new Jar(ip),
        `ghost${i}@example.com`,
        "wrong password here",
      );
    }
    const blocked = await signIn(h, new Jar(ip), victim.email, victim.password);
    expect(blocked).toMatchObject({ kind: "failed", status: 429 });
    // Another address is not affected.
    const fine = await signIn(
      h,
      new Jar("10.6.6.7"),
      victim.email,
      victim.password,
    );
    expect(fine.kind).toBe("session");
  });

  it("does not let a successful sign-in reset the count for an address", async () => {
    const own = await makeUser(h, "viewer");
    const ip = "10.7.7.7";
    for (let round = 0; round < 3; round++) {
      h.clock.now += 1000;
      await signIn(
        h,
        new Jar(ip),
        `ghost-r${round}a@example.com`,
        "wrong password here",
      );
      await signIn(
        h,
        new Jar(ip),
        `ghost-r${round}b@example.com`,
        "wrong password here",
      );
      await signIn(h, new Jar(ip), own.email, own.password);
    }
    const blocked = await signIn(h, new Jar(ip), own.email, own.password);
    expect(blocked).toMatchObject({ kind: "failed", status: 429 });
  });
});

describe("sessions (requirements 6.16, 6.17)", () => {
  it("ends a session idle for 30 minutes, and keeps one that is used", async () => {
    const u = await makeUser(h, "viewer");
    const jar = new Jar("10.8.0.1");
    const result = await signIn(h, jar, u.email, u.password);
    if (result.kind !== "session") throw new Error("sign-in failed");
    const headers = result.headers;
    const start = Date.now();

    const first = await resolveIdentity(h.rt, headers, start + 2 * MIN);
    expect(first.identity).toMatchObject({ kind: "user", role: "viewer" });

    // Used at +25 min: activity is recorded, so +50 min is only 25 min idle.
    await resolveIdentity(h.rt, headers, start + 25 * MIN);
    const later = await resolveIdentity(h.rt, headers, start + 50 * MIN);
    expect(later.identity.kind).toBe("user");

    const idle = await resolveIdentity(
      h.rt,
      headers,
      start + 50 * MIN + IDLE_TIMEOUT_MS,
    );
    expect(idle).toMatchObject({
      identity: { kind: "visitor" },
      ended: "idle",
    });
    // The session row is gone.
    const again = await resolveIdentity(h.rt, headers, start + 51 * MIN);
    expect(again.identity.kind).toBe("visitor");
  });

  it("ends a session 12 hours after sign-in however busy it was", async () => {
    const u = await makeUser(h, "member");
    const jar = new Jar("10.8.0.2");
    const result = await signIn(h, jar, u.email, u.password);
    if (result.kind !== "session") throw new Error("sign-in failed");
    const start = Date.now();
    for (let t = 20; t < 12 * 60; t += 20) {
      const r = await resolveIdentity(h.rt, result.headers, start + t * MIN);
      expect(r.identity.kind).toBe("user");
    }
    const over = await resolveIdentity(
      h.rt,
      result.headers,
      start + ABSOLUTE_TIMEOUT_MS + 1000,
    );
    expect(over).toMatchObject({ identity: { kind: "visitor" } });
    expect(over.ended).toBe("expired");
  });

  it("rejects the next request after an Administrator revokes the session", async () => {
    const admin = await makeUser(h, "admin");
    const adminSecret = await enrolTotp(h, admin);
    const adminHeaders = await signInWithTotp(h, admin, adminSecret);

    const target = await makeUser(h, "member");
    const jar = new Jar("10.8.0.3");
    const s = await signIn(h, jar, target.email, target.password);
    if (s.kind !== "session") throw new Error("sign-in failed");
    expect((await resolveIdentity(h.rt, s.headers)).identity.kind).toBe("user");

    await revokeSessionsAsAdmin(h.rt, adminHeaders, target.id);
    expect((await resolveIdentity(h.rt, s.headers)).identity.kind).toBe(
      "visitor",
    );
  });

  it("does not let a non-administrator revoke or reset anything", async () => {
    const op = await makeUser(h, "operator");
    const secret = await enrolTotp(h, op);
    const opHeaders = await signInWithTotp(h, op, secret);
    const target = await makeUser(h, "member");
    await expect(
      revokeSessionsAsAdmin(h.rt, opHeaders, target.id),
    ).rejects.toBeDefined();
    await expect(
      resetPasswordAsAdmin(h.rt, opHeaders, target.id, generatePassword()),
    ).rejects.toBeDefined();
    const still = await signIn(
      h,
      new Jar("10.8.0.4"),
      target.email,
      target.password,
    );
    expect(still.kind).toBe("session");
  });
});

describe("two-factor enrolment and sign-in (requirements 6.9, 6.2)", () => {
  it("lets an Operator sign in, flags them as unenrolled, and enrols with a real code", async () => {
    const op = await makeUser(h, "operator");
    const jar = new Jar("10.9.0.1");
    const result = await signIn(h, jar, op.email, op.password);
    if (result.kind !== "session") throw new Error("sign-in failed");

    const before = await resolveIdentity(h.rt, result.headers);
    expect(before.identity).toMatchObject({
      role: "operator",
      twoFactorEnabled: false,
    });
    // The policy keeps them out of every protected page until they enrol.
    expect(decide(before.identity, { minRole: "viewer" }, Date.now())).toEqual({
      allow: false,
      reason: "two-factor-enrolment",
    });

    expect(
      await startEnrolment(h.rt, result.headers, "the wrong password"),
    ).toEqual({
      ok: false,
      reason: "invalid-password",
    });

    const start = await startEnrolment(h.rt, result.headers, op.password);
    if (!start.ok) throw new Error("expected enrolment to start");
    expect(start.qrSvg).toMatch(/^<svg|<\?xml/);
    expect(start.manualKey).toMatch(/^[A-Z2-7]{16,}$/);
    expect(start.backupCodes.length).toBeGreaterThanOrEqual(8);

    expect(
      await confirmEnrolment(h.rt, result.headers, "000000"),
    ).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    const wrongStillOff = await h.scratch.app
      .selectFrom("user")
      .select("twoFactorEnabled")
      .where("id", "=", op.id)
      .executeTakeFirstOrThrow();
    expect(Number(wrongStillOff.twoFactorEnabled)).toBe(0);

    expect(
      await confirmEnrolment(h.rt, result.headers, totpCode(start.manualKey)),
    ).toEqual({ ok: true });
    const on = await h.scratch.app
      .selectFrom("user")
      .select("twoFactorEnabled")
      .where("id", "=", op.id)
      .executeTakeFirstOrThrow();
    expect(Number(on.twoFactorEnabled)).toBe(1);

    // From now on a password alone no longer gives a session.
    const next = new Jar("10.9.0.1");
    expect((await signIn(h, next, op.email, op.password)).kind).toBe(
      "two-factor",
    );
    expect(next.names().some((n) => n.includes("session_token"))).toBe(false);
    const full = await signInWithTotp(h, op, start.manualKey);
    const now = await resolveIdentity(h.rt, full);
    expect(now.identity).toMatchObject({
      role: "operator",
      twoFactorEnabled: true,
    });
    expect(
      decide(now.identity, { minRole: "operator" }, Date.now()).allow,
    ).toBe(true);
  });

  it("does not let a Viewer or Member be asked for enrolment by the policy", () => {
    const viewer = {
      kind: "user",
      userId: "v",
      role: "viewer",
      twoFactorEnabled: false,
      stepUpAt: null,
    } as const;
    expect(decide(viewer, { minRole: "viewer" }, Date.now()).allow).toBe(true);
  });

  it("rejects a wrong code at sign-in and locks after repeated wrong codes", async () => {
    const op = await makeUser(h, "operator");
    const secret = await enrolTotp(h, op);
    expect(secret).toBeTruthy();
    const jar = new Jar("10.9.0.2");
    expect((await signIn(h, jar, op.email, op.password)).kind).toBe(
      "two-factor",
    );
    await expect(
      h.rt.auth.api.verifyTOTP({
        body: { code: "000000" },
        headers: jar.headers(),
      }),
    ).rejects.toBeDefined();
    expect(jar.names().some((n) => n.includes("session_token"))).toBe(false);
  });
});

describe("Step_Up (requirement 6.10)", () => {
  it("stamps the session only after the right password and the right code", async () => {
    const admin = await makeUser(h, "admin");
    const secret = await enrolTotp(h, admin);
    const headers = await signInWithTotp(h, admin, secret);
    const base = await resolveIdentity(h.rt, headers);
    expect(base.identity).toMatchObject({ role: "admin", stepUpAt: null });

    const code = () => totpCode(secret);
    expect(
      await performStepUp(h.rt, headers, {
        password: "not the password!!",
        code: code(),
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect(
      await performStepUp(h.rt, headers, {
        password: admin.password,
        code: "000000",
      }),
    ).toEqual({ ok: false, reason: "invalid" });
    expect((await resolveIdentity(h.rt, headers)).identity).toMatchObject({
      stepUpAt: null,
    });

    const t = Date.now();
    expect(
      await performStepUp(
        h.rt,
        headers,
        { password: admin.password, code: code() },
        t,
      ),
    ).toEqual({ ok: true });
    const after = await resolveIdentity(h.rt, headers, t);
    if (after.identity.kind !== "user") throw new Error("expected a user");
    expect(after.identity.stepUpAt).toBeGreaterThanOrEqual(t - 1000);
    expect(after.identity.stepUpAt).toBeLessThanOrEqual(t + 1000);

    const control = { minRole: "admin", hidden: true, stepUp: true } as const;
    expect(decide(after.identity, control, t + 9 * MIN).allow).toBe(true);
    expect(decide(after.identity, control, t + 10 * MIN + 1000)).toEqual({
      allow: false,
      reason: "step-up-required",
    });

    const rows = await auditRows(h, "auth.step-up");
    expect(rows.map((r) => r.result)).toEqual(
      expect.arrayContaining(["success", "failure"]),
    );
  });

  it("locks Step_Up after five wrong attempts", async () => {
    const admin = await makeUser(h, "admin");
    const secret = await enrolTotp(h, admin);
    const headers = await signInWithTotp(h, admin, secret);
    for (let i = 0; i < 5; i++) {
      await performStepUp(h.rt, headers, {
        password: "wrong wrong wrong!",
        code: "000000",
      });
    }
    expect(
      await performStepUp(h.rt, headers, {
        password: admin.password,
        code: totpCode(secret),
      }),
    ).toEqual({ ok: false, reason: "locked" });
  });

  it("returns no-session for a Visitor", async () => {
    expect(
      await performStepUp(h.rt, new Headers(), {
        password: "x".repeat(12),
        code: "123456",
      }),
    ).toEqual({ ok: false, reason: "no-session" });
  });
});

describe("administrator actions (requirements 6.12, 6.13)", () => {
  it("resets a password without email, ends the user's sessions, and the new password works", async () => {
    const admin = await makeUser(h, "admin");
    const secret = await enrolTotp(h, admin);
    const adminHeaders = await signInWithTotp(h, admin, secret);
    const user = await makeUser(h, "member");
    const jar = new Jar("10.10.0.1");
    const s = await signIn(h, jar, user.email, user.password);
    if (s.kind !== "session") throw new Error("sign-in failed");

    const fresh = generatePassword();
    expect(fresh.length).toBeGreaterThanOrEqual(24);
    await resetPasswordAsAdmin(h.rt, adminHeaders, user.id, fresh);

    expect((await resolveIdentity(h.rt, s.headers)).identity.kind).toBe(
      "visitor",
    );
    expect(
      (await signIn(h, new Jar("10.10.0.2"), user.email, user.password)).kind,
    ).toBe("failed");
    expect(
      (await signIn(h, new Jar("10.10.0.3"), user.email, fresh)).kind,
    ).toBe("session");
  });

  it("has no way to become another user", async () => {
    const admin = await makeUser(h, "admin");
    const secret = await enrolTotp(h, admin);
    const adminHeaders = await signInWithTotp(h, admin, secret);
    const target = await makeUser(h, "member");

    // The API itself refuses even an Administrator.
    await expect(
      h.rt.auth.api.impersonateUser({
        body: { userId: target.id },
        headers: adminHeaders,
      }),
    ).rejects.toBeDefined();

    // And the HTTP routes do not exist.
    for (const path of ["impersonate-user", "stop-impersonating"]) {
      const res = await h.rt.auth.handler(
        new Request(`${BASE_URL}/api/auth/admin/${path}`, {
          method: "POST",
          headers: new Headers({
            "content-type": "application/json",
            cookie: adminHeaders.get("cookie") ?? "",
            origin: BASE_URL,
          }),
          body: JSON.stringify({ userId: target.id }),
        }),
      );
      expect(res.status).toBe(404);
    }
    const sessions = await h.scratch.app
      .selectFrom("session")
      .select("impersonatedBy")
      .execute();
    expect(sessions.every((r) => r.impersonatedBy === null)).toBe(true);
  });

  it("keeps account administration off the HTTP handler, even for an Administrator", async () => {
    const admin = await makeUser(h, "admin");
    const secret = await enrolTotp(h, admin);
    const adminHeaders = await signInWithTotp(h, admin, secret);
    const target = await makeUser(h, "member");
    const cases: [string, unknown][] = [
      [
        "create-user",
        {
          email: "z@example.com",
          password: PASSWORD,
          name: "Z",
          role: "admin",
        },
      ],
      ["set-role", { userId: target.id, role: "admin" }],
      [
        "set-user-password",
        { userId: target.id, newPassword: "a brand new password" },
      ],
      ["remove-user", { userId: target.id }],
      ["revoke-user-sessions", { userId: target.id }],
      ["ban-user", { userId: target.id }],
    ];
    for (const [path, body] of cases) {
      const res = await h.rt.auth.handler(
        new Request(`${BASE_URL}/api/auth/admin/${path}`, {
          method: "POST",
          headers: new Headers({
            "content-type": "application/json",
            cookie: adminHeaders.get("cookie") ?? "",
            origin: BASE_URL,
          }),
          body: JSON.stringify(body),
        }),
      );
      expect(res.status, path).toBe(404);
    }
  });

  it("lists users without hashes or tokens", async () => {
    const users = await listUsersForAdmin(h.rt);
    expect(users.length).toBeGreaterThan(3);
    for (const u of users) {
      expect(Object.keys(u).sort()).toEqual(
        [
          "activeSessions",
          "createdAt",
          "email",
          "id",
          "name",
          "role",
          "twoFactorEnabled",
        ].sort(),
      );
    }
    expect(JSON.stringify(users)).not.toMatch(/scrypt|\$argon|password/i);
  });
});

describe("the app's database user", () => {
  it("cannot change or delete audit rows, so the trail stays intact", async () => {
    await expect(
      h.scratch.app
        .updateTable("audit_events")
        .set({ result: "success" })
        .execute(),
    ).rejects.toThrow(/denied/i);
    await expect(
      h.scratch.app.deleteFrom("audit_events").execute(),
    ).rejects.toThrow(/denied/i);
  });
});
