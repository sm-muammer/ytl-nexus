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

  it("does not redirect /control, so a Visitor sees the same 404 as for an unknown path", () => {
    vi.stubEnv("NEXUS_MODE", "live");
    for (const path of [
      "/control",
      "/control/users",
      "/definitely-not-a-page",
    ]) {
      const res = proxy(request(path));
      expect(res.status, path).toBe(200);
      expect(res.headers.get("location")).toBeNull();
    }
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
