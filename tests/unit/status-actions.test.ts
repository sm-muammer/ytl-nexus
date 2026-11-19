// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/server/db/audit";
import type { Identity } from "@/lib/server/policy";

const events: AuditEventInput[] = [];
let identity: Identity;
const openIncidentMock = vi.fn();
const updateIncidentMock = vi.fn();
const invalidateStatusCacheMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePathMock(path),
}));

vi.mock("@/lib/server/auth/runtime", () => ({
  getAuthRuntime: () => ({
    audit: async (e: AuditEventInput) => {
      events.push(e);
    },
  }),
}));

vi.mock("@/lib/server/db", () => ({
  getDb: () => ({}),
}));

vi.mock("@/lib/server/incidents", () => ({
  openIncident: (...args: unknown[]) => openIncidentMock(...args),
  updateIncident: (...args: unknown[]) => updateIncidentMock(...args),
}));

vi.mock("@/lib/server/status", () => ({
  invalidateStatusCache: () => invalidateStatusCacheMock(),
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
      if (process.env.NEXUS_MODE === "demo") return;
      events.push(e);
    },
    nav,
  });
});

const { openIncidentAction, updateIncidentAction } =
  await import("@/lib/server/status-actions");

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
  openIncidentMock.mockReset();
  updateIncidentMock.mockReset();
  invalidateStatusCacheMock.mockReset();
  revalidatePathMock.mockReset();
  vi.stubEnv("NEXUS_MODE", "live");
  identity = user("operator");
});

describe("openIncidentAction", () => {
  it.each(["operator", "admin"] as const)(
    "allows an %s, returns the auto-generated ticketNo, invalidates cache, and revalidates paths",
    async (role) => {
      identity = user(role);
      openIncidentMock.mockResolvedValue({
        id: 4,
        ticketNo: "INC-2026-0004",
      });

      const state = await openIncidentAction(
        null,
        form({
          serviceSlug: "nexus-web",
          title: "Web latency spike",
          body: "Investigating high response times.",
        }),
      );

      expect(state).toEqual({
        done: "opened",
        id: 4,
        ticketNo: "INC-2026-0004",
      });
      expect(invalidateStatusCacheMock).toHaveBeenCalledTimes(1);
      expect(revalidatePathMock).toHaveBeenCalledWith("/status");
      expect(revalidatePathMock).toHaveBeenCalledWith(
        "/status/incidents/INC-2026-0004",
      );
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        actorId: `u-${role}`,
        role,
        action: "status.incident.open",
        target: "service:nexus-web",
        result: "success",
      });
    },
  );

  it("returns not-found and audits failure when the service does not exist", async () => {
    openIncidentMock.mockResolvedValue(null);
    const state = await openIncidentAction(
      null,
      form({
        serviceSlug: "missing-service",
        title: "Missing",
        body: "Details",
      }),
    );
    expect(state).toMatchObject({
      error: expect.stringContaining("does not exist"),
    });
    expect(invalidateStatusCacheMock).not.toHaveBeenCalled();
    expect(events.at(-1)).toMatchObject({
      action: "status.incident.open",
      result: "failure",
    });
  });

  it.each(["viewer", "member"] as const)(
    "refuses a %s and audits refusal without touching incidents",
    async (role) => {
      identity = user(role);
      const state = await openIncidentAction(
        null,
        form({
          serviceSlug: "nexus-web",
          title: "Test title",
          body: "Test body",
        }),
      );
      expect(state).toMatchObject({
        error: expect.stringContaining("do not have access"),
      });
      expect(openIncidentMock).not.toHaveBeenCalled();
      expect(events.map((e) => e.result)).toEqual(["refused"]);
    },
  );

  it("refuses a Visitor", async () => {
    identity = { kind: "visitor" };
    const state = await openIncidentAction(
      null,
      form({
        serviceSlug: "nexus-web",
        title: "Test title",
        body: "Test body",
      }),
    );
    expect(state).toMatchObject({ error: expect.any(String) });
    expect(openIncidentMock).not.toHaveBeenCalled();
  });

  it("refuses Demo mode without database writes or audit events", async () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    const state = await openIncidentAction(
      null,
      form({
        serviceSlug: "nexus-web",
        title: "Test title",
        body: "Test body",
      }),
    );
    expect(state).toMatchObject({
      error: expect.stringContaining("demo session"),
    });
    expect(openIncidentMock).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it("rejects invalid inputs and control characters", async () => {
    const state = await openIncidentAction(
      null,
      form({
        serviceSlug: "BAD SLUG",
        title: "ab",
        body: "hi\u0007",
      }),
    );
    expect(state).toMatchObject({ error: expect.any(String) });
    expect(openIncidentMock).not.toHaveBeenCalled();
    expect(events.at(-1)?.result).toBe("refused");
  });
});

describe("updateIncidentAction", () => {
  it("returns ticketNo and revalidates status and tracking pages", async () => {
    updateIncidentMock.mockResolvedValue({
      id: 4,
      ticketNo: "INC-2026-0004",
    });

    const state = await updateIncidentAction(
      null,
      form({
        id: "4",
        state: "resolved",
        body: "Mitigation complete.",
      }),
    );

    expect(state).toEqual({
      done: "updated",
      id: 4,
      ticketNo: "INC-2026-0004",
    });
    expect(invalidateStatusCacheMock).toHaveBeenCalledTimes(1);
    expect(revalidatePathMock).toHaveBeenCalledWith("/status");
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/status/incidents/INC-2026-0004",
    );
    expect(events[0]).toMatchObject({
      action: "status.incident.update",
      target: "incident:4",
      result: "success",
    });
  });

  it("reports not-found when updateIncident returns null", async () => {
    updateIncidentMock.mockResolvedValue(null);
    const state = await updateIncidentAction(
      null,
      form({ id: "999", state: "", body: "Update text" }),
    );
    expect(state).toMatchObject({
      error: expect.stringContaining("does not exist"),
    });
    expect(invalidateStatusCacheMock).not.toHaveBeenCalled();
    expect(events.at(-1)?.result).toBe("failure");
  });

  it("refuses Demo mode and lower roles", async () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    const demoState = await updateIncidentAction(
      null,
      form({ id: "4", state: "", body: "Update text" }),
    );
    expect(demoState).toMatchObject({
      error: expect.stringContaining("demo session"),
    });

    vi.stubEnv("NEXUS_MODE", "live");
    identity = user("viewer");
    const viewerState = await updateIncidentAction(
      null,
      form({ id: "4", state: "", body: "Update text" }),
    );
    expect(viewerState).toMatchObject({
      error: expect.stringContaining("do not have access"),
    });
    expect(updateIncidentMock).not.toHaveBeenCalled();
  });
});
