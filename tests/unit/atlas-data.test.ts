import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { allowedActions, SERVICE_OPS } from "@/lib/atlas/actions";
import { OPS_UNITS, HEALTH_CHECK_IDS } from "@/lib/ops/units";
import { ROLES, type Role } from "@/lib/roles";
import { auditTargets, getAtlas } from "@/lib/server/atlas";

// ATL-03: the panel data and the role-gated actions. ATL-01: nothing for a Visitor.

const NOW = Date.parse("2026-11-11T08:00:00Z");
const actor = (role: Role) => ({ userId: "u1", role });

beforeEach(() => {
  vi.stubEnv("NEXUS_MODE", "demo");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAtlas", () => {
  it("gives a Visitor nothing", async () => {
    expect(await getAtlas(null, NOW)).toBeNull();
  });

  it.each(["viewer", "member", "operator", "admin"] as const)(
    "gives a %s the inventory, health, runbook, incidents and audit",
    async (role) => {
      const data = await getAtlas(actor(role), NOW);
      expect(data).not.toBeNull();
      expect(data!.source).toBe("demo");
      expect(data!.nodes.length).toBe(13);
      expect(data!.edges.length).toBe(15);
      const web = data!.nodes.find((n) => n.slug === "nexus-web")!;
      expect(web.kind).toBe("web");
      expect(web.history.length).toBe(48);
      expect(web.audit.length).toBeGreaterThan(0);
      const wp = data!.nodes.find((n) => n.slug === "wordpress")!;
      expect(wp.incidents.map((i) => i.serviceSlug)).toEqual(["wordpress"]);
    },
  );

  it("links a runbook only when the actor may read it", async () => {
    const viewer = await getAtlas(actor("viewer"), NOW);
    const web = viewer!.nodes.find((n) => n.slug === "nexus-web")!;
    // Viewer is signed in, so internal runbooks count; the link is a Library slug.
    expect(web.runbook?.slug).toMatch(/^[a-z0-9-]+$/);
    const none = viewer!.nodes.find((n) => n.slug === "chronyd")!;
    expect(none.runbook).toBeNull();
  });

  it("never carries an account id, address or host in the audit entries", async () => {
    const data = await getAtlas(actor("viewer"), NOW);
    for (const n of data!.nodes) {
      for (const a of n.audit) {
        expect(Object.keys(a).sort()).toEqual([
          "action",
          "result",
          "role",
          "ts",
        ]);
      }
    }
    expect(JSON.stringify(data)).not.toMatch(
      /\d+\.\d+\.\d+\.\d+|ytlcomms|sn1lyvx/,
    );
  });
});

describe("allowedActions", () => {
  it("gives Visitors, Viewers and Members no action and says why", () => {
    for (const a of [null, actor("viewer"), actor("member")]) {
      const set = allowedActions("nexus-web", a, false);
      expect(set.actions).toEqual([]);
      expect(set.enabled).toBe(false);
      expect(set.note).toMatch(/Operator/);
    }
  });

  it("gives an Operator and an Administrator health, log and restart for nexus-web", () => {
    for (const role of ["operator", "admin"] as const) {
      const set = allowedActions("nexus-web", actor(role), false);
      expect(set.actions.map((a) => a.kind)).toEqual([
        "health",
        "logs",
        "restart",
      ]);
      expect(set.enabled).toBe(true);
      expect(set.note).toBeNull();
    }
  });

  it("offers only a health check where the agent cannot restart the unit", () => {
    const set = allowedActions("mariadb", actor("operator"), false);
    expect(set.actions.map((a) => a.kind)).toEqual(["health"]);
  });

  it("offers nothing for a service with no predefined action", () => {
    const set = allowedActions("chronyd", actor("admin"), false);
    expect(set.actions).toEqual([]);
    expect(set.note).toMatch(/No predefined action/);
  });

  it("shows but disables every action in a demo session", () => {
    const set = allowedActions("nexus-web", actor("operator"), true);
    expect(set.actions.length).toBe(3);
    expect(set.enabled).toBe(false);
    expect(set.note).toMatch(/Demo session/);
  });

  it("only maps to units and checks the operations agent allows", () => {
    for (const ops of Object.values(SERVICE_OPS)) {
      if (ops.unit) expect(OPS_UNITS).toContain(ops.unit);
      if (ops.check) expect(HEALTH_CHECK_IDS).toContain(ops.check);
    }
    for (const role of ROLES) {
      for (const slug of Object.keys(SERVICE_OPS)) {
        for (const a of allowedActions(slug, actor(role), false).actions) {
          expect(a.kind === "health" ? HEALTH_CHECK_IDS : OPS_UNITS).toContain(
            a.target,
          );
        }
      }
    }
  });

  it("records audit under the same targets the Server Functions write", () => {
    expect(auditTargets("nexus-web")).toEqual(["unit:nexus-web", "check:web"]);
    expect(auditTargets("chronyd")).toEqual([]);
  });
});
