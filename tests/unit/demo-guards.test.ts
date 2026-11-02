// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";

// requirement 6.25: in Demo_Mode the guards never open a connection to the auth
// database, and still enforce the role matrix on the presenter's fixture session.

const state = vi.hoisted(() => ({ role: undefined as string | undefined }));
const runtime = vi.hoisted(() => ({
  getAuthRuntime: vi.fn(() => {
    throw new Error("the auth database must not be touched in demo mode");
  }),
}));

class Nav extends Error {
  constructor(
    readonly kind: string,
    readonly to?: string,
  ) {
    super(kind);
  }
}

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-real-ip": "10.0.0.7", "x-nexus-path": "/command" }),
  cookies: async () => ({
    get: (name: string) =>
      name === DEMO_ROLE_COOKIE && state.role
        ? { value: state.role }
        : undefined,
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Nav("redirect", to);
  },
  notFound: () => {
    throw new Nav("not-found");
  },
  forbidden: () => {
    throw new Nav("forbidden");
  },
}));
vi.mock("@/lib/server/auth/runtime", () => runtime);

beforeEach(() => {
  vi.stubEnv("NEXUS_MODE", "demo");
  state.role = undefined;
  runtime.getAuthRuntime.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

async function outcome(run: () => Promise<unknown>) {
  try {
    await run();
    return "allow";
  } catch (e) {
    if (e instanceof Nav) return e.to ? `${e.kind}:${e.to}` : e.kind;
    throw e;
  }
}

describe("guards in Demo_Mode", () => {
  it("enforce the matrix on the fixture session and never touch the auth database", async () => {
    const { requirePage } = await import("@/lib/server/guards");
    const cases: [string | undefined, string, string][] = [
      [undefined, "/command", "redirect:/signin?next=%2Fcommand"],
      [undefined, "/control", "not-found"],
      ["viewer", "/command", "allow"],
      ["viewer", "/ai", "forbidden"],
      ["member", "/ai", "allow"],
      ["member", "/control", "not-found"],
      ["operator", "/shield", "allow"],
      ["operator", "/control", "not-found"],
      ["admin", "/control", "allow"],
    ];
    for (const [role, path, expected] of cases) {
      state.role = role;
      expect(
        await outcome(() => requirePage(path)),
        `${role ?? "visitor"} ${path}`,
      ).toBe(expected);
    }
    expect(runtime.getAuthRuntime).not.toHaveBeenCalled();
  });

  it("treat the demo Administrator as stepped up, so the Control page can be shown", async () => {
    const { requirePage } = await import("@/lib/server/guards");
    state.role = "admin";
    expect(await requirePage("/control")).toMatchObject({
      stepUpRequired: false,
    });
  });

  it("run a guarded action and refuse a wrong role without a database", async () => {
    const { guardAction } = await import("@/lib/server/guards");
    const { z } = await import("zod");
    const handler = vi.fn(async () => ({ ok: true as const }));
    const action = guardAction(
      {
        id: "control.user.revoke-sessions",
        schema: z.object({ userId: z.string() }),
        target: (i) => i.userId,
      },
      handler,
    );
    state.role = "member";
    expect(await action({ userId: "x" })).toEqual({
      ok: false,
      error: "not-found",
    });
    state.role = "admin";
    expect(await action({ userId: "x" })).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(runtime.getAuthRuntime).not.toHaveBeenCalled();
  });

  it("answer 404 from the Better Auth route without opening the runtime", async () => {
    const { GET, POST } = await import("@/app/api/auth/[...all]/route");
    expect(
      (await GET(new Request("https://nexus.test/api/auth/get-session")))
        .status,
    ).toBe(404);
    expect(
      (
        await POST(
          new Request("https://nexus.test/api/auth/sign-in/email", {
            method: "POST",
          }),
        )
      ).status,
    ).toBe(404);
    expect(runtime.getAuthRuntime).not.toHaveBeenCalled();
  });
});
