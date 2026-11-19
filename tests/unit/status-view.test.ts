import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoStatus } from "@/lib/fixtures/status";
import { getIncidentByTicket, getStatusView } from "@/lib/server/status";
import { overallStatus } from "@/lib/status/types";

// STA-03 and STA-04: a Visitor gets service names and states only; a signed-in
// user gets history, uptime and incidents.

const NOW = Date.parse("2026-11-11T08:00:00Z");

beforeEach(() => {
  vi.stubEnv("NEXUS_MODE", "demo");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getStatusView", () => {
  it("gives a Visitor only slug, name and health per service", async () => {
    const view = await getStatusView(null, NOW);
    expect(view.kind).toBe("public");
    for (const service of view.services) {
      expect(Object.keys(service).sort()).toEqual(["health", "name", "slug"]);
    }
    expect(Object.keys(view).sort()).toEqual([
      "kind",
      "services",
      "source",
      "takenAt",
    ]);
  });

  it("gives a Visitor no incident text, latency, detail or timestamp of a check", async () => {
    const full = demoStatus(NOW);
    const text = JSON.stringify(await getStatusView(null, NOW));
    for (const incident of full.incidents) {
      expect(text).not.toContain(incident.title);
      expect(text).not.toContain(incident.ticketNo);
      for (const update of incident.updates) {
        expect(text).not.toContain(update.body);
      }
    }
    expect(text).not.toMatch(/INC-\d{4}-\d+/);
    expect(text).not.toMatch(/latencyMs|detail|uptime|history|lastCheckedAt/);
    expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+|127\.0\.0\.1|localhost/);
  });

  it.each(["viewer", "member", "operator", "admin"] as const)(
    "gives a %s the full view with history and incidents",
    async (role) => {
      const view = await getStatusView({ userId: "u1", role }, NOW);
      expect(view.kind).toBe("full");
      if (view.kind !== "full") return;
      expect(view.incidents.length).toBeGreaterThan(0);
      expect(
        view.incidents.every((i) => /^INC-\d{4}-\d{4,}$/.test(i.ticketNo)),
      ).toBe(true);
      expect(view.services[0]?.history.length).toBe(48);
      expect(view.source).toBe("demo");
    },
  );
});

describe("getIncidentByTicket", () => {
  it("gives a Visitor nothing", async () => {
    expect(await getIncidentByTicket(null, "INC-2026-0002", NOW)).toBeNull();
  });

  it.each(["viewer", "member", "operator", "admin"] as const)(
    "lets a %s look up an incident by exact or lowercase ticket number",
    async (role) => {
      const actor = { userId: "u1", role };
      const exact = await getIncidentByTicket(actor, "INC-2026-0002", NOW);
      expect(exact).toMatchObject({
        source: "demo",
        takenAt: NOW,
        incident: {
          id: 2,
          ticketNo: "INC-2026-0002",
          serviceSlug: "ollama",
          state: "monitoring",
        },
      });

      const normalized = await getIncidentByTicket(
        actor,
        " #inc-2026-0002 ",
        NOW,
      );
      expect(normalized?.incident?.ticketNo).toBe("INC-2026-0002");
    },
  );

  it("returns incident: null for an unknown or invalid ticket number", async () => {
    const actor = { userId: "u1", role: "viewer" as const };
    expect(await getIncidentByTicket(actor, "INC-2026-9999", NOW)).toEqual({
      source: "demo",
      takenAt: NOW,
      incident: null,
    });
    expect(await getIncidentByTicket(actor, "../etc", NOW)).toEqual({
      source: "demo",
      takenAt: NOW,
      incident: null,
    });
  });
});

describe("demo fixtures", () => {
  it("are deterministic", () => {
    expect(demoStatus(NOW)).toEqual(demoStatus(NOW));
  });

  it("show a service without checks as unknown, not healthy", () => {
    const dovecot = demoStatus(NOW).services.find((s) => s.slug === "dovecot");
    expect(dovecot?.health).toBe("unknown");
    expect(dovecot?.uptime).toEqual({ "24h": null, "7d": null, "30d": null });
  });

  it("keep uptime between 0 and 1", () => {
    for (const s of demoStatus(NOW).services) {
      for (const value of Object.values(s.uptime)) {
        if (value !== null) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("overallStatus", () => {
  const s = (
    health: "healthy" | "down" | "unknown" | "stale" | "degraded",
  ) => ({
    slug: "x",
    name: "X",
    health,
  });
  it("is unknown with no data, an outage with any down, otherwise degraded or operational", () => {
    expect(overallStatus([s("unknown")])).toBe("unknown");
    expect(overallStatus([s("healthy"), s("down")])).toBe("outage");
    expect(overallStatus([s("healthy"), s("stale")])).toBe("degraded");
    expect(overallStatus([s("healthy"), s("degraded")])).toBe("degraded");
    expect(overallStatus([s("healthy"), s("unknown")])).toBe("operational");
  });
});
