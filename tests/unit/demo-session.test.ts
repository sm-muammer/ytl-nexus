import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = { set: vi.fn(), delete: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => jar }));

import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { setDemoSession } from "@/lib/server/demo-session-actions";

function form(role: string | null) {
  const f = new FormData();
  if (role !== null) f.set("role", role);
  return f;
}

beforeEach(() => {
  jar.set.mockReset();
  jar.delete.mockReset();
  vi.stubEnv("NEXUS_MODE", "demo");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("setDemoSession (Server Function)", () => {
  it.each(["viewer", "member", "operator", "admin"])(
    "stores the %s role in an HttpOnly cookie",
    async (role) => {
      await setDemoSession(form(role));
      expect(jar.set).toHaveBeenCalledTimes(1);
      const [name, value, options] = jar.set.mock.calls[0]!;
      expect(name).toBe(DEMO_ROLE_COOKIE);
      expect(value).toBe(role);
      expect(options).toMatchObject({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    },
  );

  it("ends the demo session when asked for the visitor view", async () => {
    await setDemoSession(form("visitor"));
    expect(jar.delete).toHaveBeenCalledWith(DEMO_ROLE_COOKIE);
    expect(jar.set).not.toHaveBeenCalled();
  });

  it.each([null, "", "root", "ADMIN", "admin;role=admin", "__proto__"])(
    "ignores the invalid input %j",
    async (bad) => {
      await setDemoSession(form(bad));
      expect(jar.set).not.toHaveBeenCalled();
      expect(jar.delete).not.toHaveBeenCalled();
    },
  );

  it("does nothing in Live_Mode", async () => {
    vi.stubEnv("NEXUS_MODE", "live");
    await setDemoSession(form("admin"));
    expect(jar.set).not.toHaveBeenCalled();
    expect(jar.delete).not.toHaveBeenCalled();
  });
});
