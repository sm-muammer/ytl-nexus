// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/server/db/audit";
import type { Identity } from "@/lib/server/policy";

// Requirement 9.11 and the demo criterion: an Operator's request and its result
// both reach the audit trail, a disallowed unit is refused and audited, and a
// Viewer cannot run an operation at all.

const events: AuditEventInput[] = [];
let identity: Identity;
const callOps = vi.fn();

vi.mock("@/lib/server/auth/runtime", () => ({
  getAuthRuntime: () => ({
    audit: async (e: AuditEventInput) => {
      events.push(e);
    },
  }),
}));

vi.mock("@/lib/server/ops-client", () => ({
  callOps: (req: unknown) => callOps(req),
}));

vi.mock("@/lib/server/guards", async () => {
  const { createGuards } = await import("@/lib/server/guards-core");
  const nav = {
    redirect: () => {
      throw new Error("redirect");
    },
    notFound: () => {
      throw new Error("notFound");
    },
    forbidden: () => {
      throw new Error("forbidden");
    },
  };
  return createGuards({
    now: () => Date.now(),
    identity: async () => identity,
    sourceIp: async () => "10.26.1.20",
    audit: async (e) => {
      // Like lib/server/guards.ts: nothing is written in Demo_Mode.
      if (process.env.NEXUS_MODE === "demo") return;
      events.push(e);
    },
    nav,
  });
});

const { restartAction, logsAction, healthAction } =
  await import("@/lib/server/ops-actions");

const user = (role: "viewer" | "member" | "operator" | "admin"): Identity => ({
  kind: "user",
  userId: `u-${role}`,
  role,
  twoFactorEnabled: true,
  stepUpAt: null,
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

beforeEach(() => {
  events.length = 0;
  callOps.mockReset();
  vi.stubEnv("NEXUS_MODE", "live");
  identity = user("operator");
});

describe("restart", () => {
  it("audits the request before the call and the result after, for an allowed unit", async () => {
    callOps.mockImplementation(async () => {
      // The request event must already be written when the agent is called.
      expect(events.map((e) => e.action)).toEqual(["ops.restart.request"]);
      return {
        ok: true,
        response: {
          ok: true,
          op: "restart",
          unit: "nexus-worker",
          accepted: true,
        },
      };
    });
    const state = await restartAction(null, form({ unit: "nexus-worker" }));
    expect(state).toEqual({ done: "restart", unit: "nexus-worker" });
    expect(callOps).toHaveBeenCalledWith({
      op: "restart",
      unit: "nexus-worker",
    });
    expect(events.map((e) => [e.action, e.target, e.result])).toEqual([
      ["ops.restart.request", "unit:nexus-worker", "success"],
      ["ops.restart", "unit:nexus-worker", "success"],
    ]);
    expect(events.every((e) => e.actorId === "u-operator")).toBe(true);
    expect(events.every((e) => e.role === "operator")).toBe(true);
  });

  it("refuses a disallowed unit at the agent and audits the request and the failure", async () => {
    callOps.mockResolvedValue({ ok: false, error: "invalid-request" });
    const state = await restartAction(null, form({ unit: "sshd" }));
    expect(state).toMatchObject({
      error: expect.stringContaining("allowlist"),
    });
    expect(events.map((e) => [e.action, e.target, e.result])).toEqual([
      ["ops.restart.request", "unit:sshd", "success"],
      ["ops.restart", "unit:sshd", "failure"],
    ]);
  });

  it("reports an unreachable agent as a failed result without detail", async () => {
    callOps.mockResolvedValue({ ok: false, error: "unavailable" });
    const state = await restartAction(null, form({ unit: "nexus-web" }));
    expect(state).toMatchObject({
      error: expect.stringContaining("does not answer"),
    });
    expect(JSON.stringify(state)).not.toMatch(/\/run|socket|ECONN/);
    expect(events.at(-1)).toMatchObject({
      action: "ops.restart",
      result: "failure",
    });
  });

  it("rejects unit text with control characters before anything is sent", async () => {
    for (const unit of ["nexus-web\nsshd", "a b", "", "x".repeat(65)]) {
      const state = await restartAction(null, form({ unit }));
      expect(state).toMatchObject({ error: expect.any(String) });
    }
    expect(callOps).not.toHaveBeenCalled();
    expect(events.every((e) => e.result === "refused")).toBe(true);
  });
});

describe("who may run operations", () => {
  it.each(["viewer", "member"] as const)(
    "refuses a %s on all three operations and sends nothing",
    async (role) => {
      identity = user(role);
      const states = [
        await restartAction(null, form({ unit: "nexus-web" })),
        await logsAction(null, form({ unit: "nexus-web", lines: "10" })),
        await healthAction(null, form({ check: "web" })),
      ];
      for (const state of states) {
        expect(state).toMatchObject({
          error: expect.stringContaining("do not have access"),
        });
      }
      expect(callOps).not.toHaveBeenCalled();
      expect(events.map((e) => e.result)).toEqual([
        "refused",
        "refused",
        "refused",
      ]);
    },
  );

  it("refuses a Visitor", async () => {
    identity = { kind: "visitor" };
    const state = await restartAction(null, form({ unit: "nexus-web" }));
    expect(state).toMatchObject({ error: expect.any(String) });
    expect(callOps).not.toHaveBeenCalled();
  });

  it.each(["operator", "admin"] as const)("allows an %s", async (role) => {
    identity = user(role);
    callOps.mockResolvedValue({
      ok: true,
      response: {
        ok: true,
        op: "health",
        check: "web",
        state: "healthy",
        latencyMs: 3,
        detail: "Answered",
      },
    });
    const state = await healthAction(null, form({ check: "web" }));
    expect(state).toMatchObject({ done: "health", state: "healthy" });
  });
});

describe("logs and health", () => {
  it("passes lines to the agent as a number and returns the text it sends", async () => {
    callOps.mockResolvedValue({
      ok: true,
      response: {
        ok: true,
        op: "logs",
        unit: "sftpgo",
        lines: ["a", "b"],
        truncated: false,
      },
    });
    const state = await logsAction(null, form({ unit: "sftpgo", lines: "25" }));
    expect(callOps).toHaveBeenCalledWith({
      op: "logs",
      unit: "sftpgo",
      lines: 25,
    });
    expect(state).toEqual({
      done: "logs",
      unit: "sftpgo",
      lines: ["a", "b"],
      truncated: false,
    });
    expect(events.map((e) => e.action)).toEqual([
      "ops.logs.request",
      "ops.logs",
    ]);
  });

  it("lets the agent refuse an out-of-range line count", async () => {
    callOps.mockResolvedValue({ ok: false, error: "invalid-request" });
    const state = await logsAction(
      null,
      form({ unit: "nexus-web", lines: "501" }),
    );
    expect(state).toMatchObject({ error: expect.any(String) });
    expect(callOps).toHaveBeenCalledWith({
      op: "logs",
      unit: "nexus-web",
      lines: 501,
    });
  });
});

describe("demo session", () => {
  it("runs nothing and writes no audit event", async () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    const state = await restartAction(null, form({ unit: "nexus-web" }));
    expect(state).toMatchObject({
      error: expect.stringContaining("demo session"),
    });
    expect(callOps).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });
});
