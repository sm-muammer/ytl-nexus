import { afterEach, describe, expect, it } from "vitest";
import {
  DISABLED_PATHS,
  createAuthRuntime,
  readAuthEnv,
  type AuthRuntime,
} from "@/lib/server/auth/create-auth";
import {
  CLIENT_IP_HEADER,
  UNKNOWN_IP,
  sourceIpFromHeaders,
} from "@/lib/server/auth/ip";
import { roles } from "@/lib/server/auth/access";

const SECRET = "x".repeat(40);

describe("readAuthEnv", () => {
  it("reads the three settings", () => {
    expect(
      readAuthEnv({
        BETTER_AUTH_SECRET: SECRET,
        BETTER_AUTH_URL: "https://ytl-nexus.ytlcomms.my",
        NEXUS_TRUSTED_ORIGINS:
          "https://ytl-nexus.internal, https://10.26.64.164 ,",
      }),
    ).toEqual({
      secret: SECRET,
      baseURL: "https://ytl-nexus.ytlcomms.my",
      trustedOrigins: ["https://ytl-nexus.internal", "https://10.26.64.164"],
    });
  });

  it("names what is wrong and never echoes a value", () => {
    const secret = "short-but-secret";
    let message = "";
    try {
      readAuthEnv({ BETTER_AUTH_SECRET: secret, BETTER_AUTH_URL: "not a url" });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toMatch(/BETTER_AUTH_SECRET/);
    expect(message).toMatch(/BETTER_AUTH_URL/);
    expect(message).not.toContain(secret);
    expect(message).not.toContain("not a url");
  });

  it("refuses to start with nothing set", () => {
    expect(() => readAuthEnv({})).toThrowError(/BETTER_AUTH_SECRET/);
  });
});

describe("the Better Auth configuration (requirements 6.1, 6.12, 6.15, 6.16)", () => {
  let rt: AuthRuntime | undefined;
  afterEach(async () => {
    await rt?.destroy();
    rt = undefined;
  });

  const build = (baseURL: string, nextCookies = true) => {
    rt = createAuthRuntime({
      // The pool connects only when a query runs, which these tests never do.
      db: {
        host: "127.0.0.1",
        port: 1,
        database: "x",
        user: "u",
        password: "p",
      },
      env: { secret: SECRET, baseURL, trustedOrigins: [] },
      nextCookies,
    });
    return rt;
  };

  it("has the admin, two-factor and Next.js cookie plugins, with nextCookies last", () => {
    const ids = build("https://nexus.test").auth.options.plugins?.map(
      (p) => p.id,
    );
    expect(ids).toEqual(["admin", "two-factor", "next-cookies"]);
  });

  it("leaves nextCookies out only where there is no Next.js request", () => {
    const ids = build("https://nexus.test", false).auth.options.plugins?.map(
      (p) => p.id,
    );
    expect(ids).toEqual(["admin", "two-factor"]);
  });

  it("keeps sessions 12 hours and never lets Better Auth extend them", () => {
    const { session } = build("https://nexus.test").auth.options;
    expect(session?.expiresIn).toBe(12 * 60 * 60);
    expect(session?.disableSessionRefresh).toBe(true);
    expect(session?.cookieCache?.enabled).toBe(false);
  });

  it("sets Secure, HttpOnly and SameSite=Lax cookies on an https address", () => {
    const { advanced } = build("https://nexus.test").auth.options;
    expect(advanced?.useSecureCookies).toBe(true);
    expect(advanced?.defaultCookieAttributes).toMatchObject({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
    });
    expect(advanced?.cookiePrefix).toBe("nexus");
  });

  it("does not force Secure on plain http, so local development can sign in", () => {
    const { advanced } = build("http://localhost:3000").auth.options;
    expect(advanced?.useSecureCookies).toBe(false);
    expect(advanced?.defaultCookieAttributes?.secure).toBe(false);
    expect(advanced?.defaultCookieAttributes?.httpOnly).toBe(true);
  });

  it("never disables the origin or CSRF checks, even under test", () => {
    const { advanced } = build("https://nexus.test").auth.options;
    expect(advanced?.disableOriginCheck).toBe(false);
    expect(advanced?.disableCSRFCheck).toBe(false);
  });

  it("allows no self-service sign-up and no email flows", () => {
    const options = build("https://nexus.test").auth.options;
    expect(options.emailAndPassword?.disableSignUp).toBe(true);
    expect(options.emailAndPassword?.requireEmailVerification).toBe(false);
    for (const path of [
      "/sign-up/email",
      "/request-password-reset",
      "/reset-password",
    ]) {
      expect(DISABLED_PATHS).toContain(path);
    }
  });

  it("disables impersonation twice: no route, and no role holds the permission", () => {
    expect(DISABLED_PATHS).toContain("/admin/impersonate-user");
    expect(DISABLED_PATHS).toContain("/admin/stop-impersonating");
    for (const [name, role] of Object.entries(roles)) {
      const granted = (
        role as unknown as { statements: Record<string, readonly string[]> }
      ).statements;
      if (name === "admin") expect(granted.user).toContain("set-password");
      expect(granted.user ?? [], name).not.toContain("impersonate");
      expect(granted.user ?? [], name).not.toContain("impersonate-admins");
    }
  });

  it("defines exactly the four roles", () => {
    expect(Object.keys(roles).sort()).toEqual([
      "admin",
      "member",
      "operator",
      "viewer",
    ]);
  });

  it("takes the client address from the header Apache sets", () => {
    const { advanced } = build("https://nexus.test").auth.options;
    expect(advanced?.ipAddress?.ipAddressHeaders).toEqual([CLIENT_IP_HEADER]);
  });
});

describe("sourceIpFromHeaders", () => {
  const h = (value?: string) =>
    new Headers(value === undefined ? {} : { [CLIENT_IP_HEADER]: value });

  it("reads an address from the header Apache sets", () => {
    expect(sourceIpFromHeaders(h("10.26.64.9"))).toBe("10.26.64.9");
    expect(sourceIpFromHeaders(h("2001:db8::1"))).toBe("2001:db8::1");
    expect(sourceIpFromHeaders(h("::ffff:10.1.2.3"))).toBe("10.1.2.3");
  });

  it("ignores X-Forwarded-For, which a client can forge", () => {
    const headers = new Headers({ "x-forwarded-for": "6.6.6.6" });
    expect(sourceIpFromHeaders(headers)).toBe(UNKNOWN_IP);
  });

  it("returns a safe placeholder for anything that is not an address", () => {
    for (const bad of [
      undefined,
      "",
      "unknown",
      "1.2.3",
      "10.0.0.1, 6.6.6.6",
      "'; DROP TABLE x",
    ]) {
      expect(sourceIpFromHeaders(h(bad))).toBe(UNKNOWN_IP);
    }
    expect(sourceIpFromHeaders(null)).toBe(UNKNOWN_IP);
  });
});
