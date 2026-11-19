// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { proxy } from "@/proxy";

// requirement 6.7 and 6.8: the Proxy redirects requests with no session cookie
// to sign-in, checks nothing else, and is never the only guard.

afterEach(() => vi.unstubAllEnvs());

const request = (path: string, cookie?: string) =>
  new NextRequest(`https://nexus.test${path}`, {
    headers: cookie ? { cookie } : {},
  });

describe("proxy in Live_Mode", () => {
  it("sends a protected page with no cookie to sign-in, remembering the page", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    for (const path of [
      "/command",
      "/command/atlas",
      "/ai",
      "/shield",
      "/design",
      "/studio",
      "/data",
      "/status/incidents/INC-2026-0002",
    ]) {
      const res = proxy(request(path));
      expect(res.status, path).toBe(307);
      const location = new URL(res.headers.get("location") ?? "");
      expect(location.pathname).toBe("/signin");
      expect(location.searchParams.get("next")).toBe(path);
    }
  });

  it("lets a protected page through when a session cookie exists, without judging it", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    for (const cookie of [
      "nexus.session_token=garbage",
      "__Secure-nexus.session_token=garbage",
    ]) {
      const res = proxy(request("/command", cookie));
      expect(res.status).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      const ticketRes = proxy(
        request("/status/incidents/INC-2026-0002", cookie),
      );
      expect(ticketRes.status).toBe(200);
      expect(ticketRes.headers.get("location")).toBeNull();
    }
  });

  it("does not redirect public pages", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    for (const path of [
      "/",
      "/status",
      "/library",
      "/story",
      "/tour",
      "/yes",
      "/signin",
      "/platform",
    ]) {
      expect(proxy(request(path)).status, path).toBe(200);
    }
  });

  it("rewrites /control without a session cookie to a path that does not exist, instead of redirecting", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    for (const path of ["/control", "/control/", "/control/users"]) {
      const res = proxy(request(path));
      expect(res.status, path).toBe(200);
      expect(res.headers.get("location")).toBeNull();
      // Always http: the Node server listens on plain http behind Apache, and
      // Next.js fetches a rewrite to any other scheme as an external request.
      const rewrite = new URL(res.headers.get("x-middleware-rewrite") ?? "");
      expect(rewrite.protocol).toBe("http:");
      expect(rewrite.pathname).toMatch(/^\/not-a-route\/?$/);
    }
  });

  it("lets /control through when a session cookie exists, because the page guard decides", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    const res = proxy(request("/control", "nexus.session_token=garbage"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
    expect(res.headers.get("location")).toBeNull();
  });

  it("leaves other unknown paths alone", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    const res = proxy(request("/definitely-not-a-page"));
    expect(res.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("treats a trailing slash like the page itself", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    expect(proxy(request("/command/")).status).toBe(307);
  });
});

describe("proxy in Demo_Mode", () => {
  it("never redirects: the guards read the presenter's fixture session", () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    expect(proxy(request("/command")).status).toBe(200);
  });

  it("treats the demo role cookie as the session for the hidden area", () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    expect(
      proxy(request("/control")).headers.get("x-middleware-rewrite"),
    ).toContain("/not-a-route");
    expect(
      proxy(request("/control", "nexus-demo-role=admin")).headers.get(
        "x-middleware-rewrite",
      ),
    ).toBeNull();
  });
});

describe("proxy request header", () => {
  it("replaces an x-nexus-path header sent by the client", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    const req = new NextRequest("https://nexus.test/status", {
      headers: { "x-nexus-path": "/evil" },
    });
    const res = proxy(req);
    // NextResponse.next({ request }) forwards overridden headers under this prefix.
    expect(res.headers.get("x-middleware-request-x-nexus-path")).toBe(
      "/status",
    );
  });
});

describe("Content Security Policy and security headers (Task 21, O-013)", () => {
  it("generates a unique base64 nonce and injects strict CSP on responses", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    const res1 = proxy(request("/status"));
    const res2 = proxy(request("/status"));

    const csp1 = res1.headers.get("Content-Security-Policy");
    const csp2 = res2.headers.get("Content-Security-Policy");

    expect(csp1).toBeTruthy();
    expect(csp2).toBeTruthy();
    expect(csp1).toContain("script-src 'self' 'nonce-");
    expect(csp1).toContain("'strict-dynamic'");
    expect(csp1).toContain("object-src 'none'");
    expect(csp1).toContain("frame-ancestors 'none'");

    // Extract nonces and verify uniqueness
    const nonce1 = csp1?.match(/'nonce-([^']+)'/)?.[1];
    const nonce2 = csp2?.match(/'nonce-([^']+)'/)?.[1];
    expect(nonce1).toBeTruthy();
    expect(nonce2).toBeTruthy();
    expect(nonce1).not.toBe(nonce2);

    // Request header forwarded to Next.js renderer for script tag nonce attachment
    expect(res1.headers.get("x-middleware-request-x-nonce")).toBe(nonce1);

    // Standard hardening headers
    expect(res1.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res1.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res1.headers.get("Referrer-Policy")).toBe(
      "strict-origin-when-cross-origin",
    );
  });
});
