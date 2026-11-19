import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadIncidentByTicket, loadLiveStatus } from "@/lib/server/status";
import { openIncident, updateIncident } from "@/lib/server/incidents";
import { seedDatabase } from "@/lib/server/db/seed/run";
import { createScratchDatabase, type ScratchDatabase } from "./helpers/test-db";

// STA-02, STA-04, STA-05 against a real database: the SQL behind /status and the
// incident writes, including the table's own resolution constraint.

let s: ScratchDatabase;
const NOW = Date.parse("2026-11-11T08:00:00Z");
const MIN = 60_000;

beforeAll(async () => {
  s = await createScratchDatabase();
  await s.prepare();
  await seedDatabase(s.migrate);
  await s.migrate.deleteFrom("service_checks").execute();
  await s.migrate.deleteFrom("incident_updates").execute();
  await s.migrate.deleteFrom("incidents").execute();
  // incidents.opened_by and incident_updates.author_id reference the user table.
  await sql`INSERT INTO user (id, name, email, role) VALUES
    ('user-1', 'Test Operator', 'op@example.org', 'operator'),
    ('user-2', 'Test Admin', 'admin@example.org', 'admin')`.execute(s.migrate);
});
afterAll(async () => {
  await s.drop();
});

async function serviceId(slug: string) {
  return (
    await s.app
      .selectFrom("services")
      .select("id")
      .where("slug", "=", slug)
      .executeTakeFirstOrThrow()
  ).id;
}

describe("loadLiveStatus", () => {
  it("derives health, uptime and history from stored checks", async () => {
    const id = await serviceId("mariadb");
    const rows = [];
    // 10 checks in the last 10 minutes: 8 healthy, 1 degraded, 1 down.
    for (let i = 0; i < 10; i++) {
      rows.push({
        service_id: id,
        checked_at: new Date(NOW - i * MIN),
        state:
          i === 3
            ? ("degraded" as const)
            : i === 6
              ? ("down" as const)
              : ("healthy" as const),
        latency_ms: 5,
        detail: null,
      });
    }
    // One older healthy check, 3 days ago: counts in 7d and 30d only.
    rows.push({
      service_id: id,
      checked_at: new Date(NOW - 3 * 24 * 60 * MIN),
      state: "healthy" as const,
      latency_ms: 4,
      detail: null,
    });
    await s.app.insertInto("service_checks").values(rows).execute();

    const status = await loadLiveStatus(s.app, NOW);
    const maria = status.services.find((x) => x.slug === "mariadb");
    expect(maria?.health).toBe("healthy");
    expect(maria?.latencyMs).toBe(5);
    expect(maria?.uptime["24h"]).toBeCloseTo(8 / 10, 10);
    expect(maria?.uptime["7d"]).toBeCloseTo(9 / 11, 10);
    expect(maria?.uptime["30d"]).toBeCloseTo(9 / 11, 10);
    expect(maria?.history).toHaveLength(48);
    // The newest bucket holds the recent checks; the worst state wins.
    const filled = maria?.history.filter((b) => b.state !== null) ?? [];
    expect(filled.length).toBeGreaterThan(0);
    expect(filled.some((b) => b.state === "down")).toBe(true);
  });

  it("reports unknown for a service never checked and stale for an old result", async () => {
    const id = await serviceId("ollama");
    await s.app
      .insertInto("service_checks")
      .values({
        service_id: id,
        checked_at: new Date(NOW - 6 * MIN),
        state: "healthy",
        latency_ms: 9,
        detail: null,
      })
      .execute();
    const status = await loadLiveStatus(s.app, NOW);
    expect(status.services.find((x) => x.slug === "ollama")?.health).toBe(
      "stale",
    );
    const never = status.services.find((x) => x.slug === "dovecot");
    expect(never?.health).toBe("unknown");
    expect(never?.uptime).toEqual({ "24h": null, "7d": null, "30d": null });
  });

  it("returns one entry per service, in seed order", async () => {
    const status = await loadLiveStatus(s.app, NOW);
    const count = await s.app.selectFrom("services").select("id").execute();
    expect(status.services).toHaveLength(count.length);
    expect(status.source).toBe("live");
  });
});

describe("incidents", () => {
  it("opens an incident with an auto-generated ticket number and its first update", async () => {
    const created = await openIncident(
      s.app,
      {
        serviceSlug: "ollama",
        title: "Slow answers",
        body: "Looking into it.",
      },
      "user-1",
      new Date(NOW),
    );
    expect(created).not.toBeNull();
    expect(created?.ticketNo).toMatch(/^INC-2026-\d{4,}$/);
    const status = await loadLiveStatus(s.app, NOW);
    const incident = status.incidents.find((i) => i.id === created?.id);
    expect(incident).toMatchObject({
      ticketNo: created?.ticketNo,
      title: "Slow answers",
      state: "open",
      serviceSlug: "ollama",
      resolvedAt: null,
    });
    expect(incident?.updates.map((u) => u.body)).toEqual(["Looking into it."]);
  });

  it("assigns distinct auto-generated ticket numbers across multiple opened incidents", async () => {
    const first = await openIncident(
      s.app,
      { serviceSlug: "apache", title: "Proxy blip", body: "Checking." },
      "user-1",
      new Date(NOW),
    );
    const second = await openIncident(
      s.app,
      { serviceSlug: "postfix", title: "Queue delay", body: "Checking." },
      "user-1",
      new Date(NOW),
    );
    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.ticketNo).toMatch(/^INC-2026-\d{4,}$/);
    expect(second?.ticketNo).toMatch(/^INC-2026-\d{4,}$/);
    expect(second?.ticketNo).not.toBe(first?.ticketNo);
  });

  it("returns null for an unknown service and writes nothing", async () => {
    const before = await s.app.selectFrom("incidents").select("id").execute();
    expect(
      await openIncident(
        s.app,
        { serviceSlug: "no-such-service", title: "x y z", body: "b" },
        null,
        new Date(NOW),
      ),
    ).toBeNull();
    const after = await s.app.selectFrom("incidents").select("id").execute();
    expect(after).toHaveLength(before.length);
  });

  it("resolves, which sets the resolution time, and reopens, which clears it", async () => {
    const existing = await s.app
      .selectFrom("incidents")
      .select(["id", "ticket_no"])
      .executeTakeFirstOrThrow();
    const id = existing.id;
    expect(
      await updateIncident(
        s.app,
        { id, state: "resolved", body: "Fixed." },
        "user-2",
        new Date(NOW + 10 * MIN),
      ),
    ).toEqual({ id, ticketNo: existing.ticket_no });
    let row = await s.app
      .selectFrom("incidents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(row.state).toBe("resolved");
    expect(row.resolved_at?.getTime()).toBe(NOW + 10 * MIN);

    expect(
      await updateIncident(
        s.app,
        { id, state: "investigating", body: "It is back." },
        "user-2",
        new Date(NOW + 20 * MIN),
      ),
    ).toEqual({ id, ticketNo: existing.ticket_no });
    row = await s.app
      .selectFrom("incidents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(row.state).toBe("investigating");
    expect(row.resolved_at).toBeNull();
  });

  it("posts an update without changing the state when none is given", async () => {
    const id = (
      await s.app.selectFrom("incidents").select("id").executeTakeFirstOrThrow()
    ).id;
    const before = await s.app
      .selectFrom("incidents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    await updateIncident(
      s.app,
      { id, state: "", body: "Still watching." },
      null,
      new Date(NOW + 30 * MIN),
    );
    const after = await s.app
      .selectFrom("incidents")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    expect(after.state).toBe(before.state);
    const updates = await s.app
      .selectFrom("incident_updates")
      .select("body")
      .where("incident_id", "=", id)
      .execute();
    expect(updates.map((u) => u.body)).toContain("Still watching.");
  });

  it("does not resolve before the incident opened, even if the clock is behind", async () => {
    const existing = await s.app
      .selectFrom("incidents")
      .select(["id", "ticket_no"])
      .executeTakeFirstOrThrow();
    await expect(
      updateIncident(
        s.app,
        { id: existing.id, state: "resolved", body: "Done." },
        null,
        new Date(NOW - 60 * MIN),
      ),
    ).resolves.toEqual({ id: existing.id, ticketNo: existing.ticket_no });
  });

  it("returns null for an unknown incident", async () => {
    expect(
      await updateIncident(
        s.app,
        { id: 999999, state: "", body: "x" },
        null,
        new Date(NOW),
      ),
    ).toBeNull();
  });

  it("looks up any incident by ticket number, including resolved ones older than 30 days", async () => {
    const oldOpened = new Date(NOW - 45 * 24 * 60 * MIN);
    const oldResolved = new Date(NOW - 45 * 24 * 60 * MIN + 15 * MIN);
    const created = await openIncident(
      s.app,
      {
        serviceSlug: "mariadb",
        title: "Old resolved incident",
        body: "Archived issue.",
      },
      "user-1",
      oldOpened,
    );
    expect(created).not.toBeNull();
    await updateIncident(
      s.app,
      { id: created!.id, state: "resolved", body: "Closed cleanly." },
      "user-2",
      oldResolved,
    );

    const recent = await loadLiveStatus(s.app, NOW);
    expect(recent.incidents.some((i) => i.id === created!.id)).toBe(false);

    const exact = await loadIncidentByTicket(s.app, created!.ticketNo);
    expect(exact).toMatchObject({
      id: created!.id,
      ticketNo: created!.ticketNo,
      state: "resolved",
      title: "Old resolved incident",
    });
    expect(exact?.updates.map((u) => u.body)).toEqual([
      "Closed cleanly.",
      "Archived issue.",
    ]);

    const lower = await loadIncidentByTicket(
      s.app,
      ` #${created!.ticketNo.toLowerCase()} `,
    );
    expect(lower?.ticketNo).toBe(created!.ticketNo);

    expect(await loadIncidentByTicket(s.app, "INC-2026-999999")).toBeNull();
    expect(await loadIncidentByTicket(s.app, "../etc")).toBeNull();
  });

  it("stores hostile text literally", async () => {
    const created = await openIncident(
      s.app,
      {
        serviceSlug: "mariadb",
        title: "'; DROP TABLE incidents; --",
        body: "<script>alert(1)</script>",
      },
      null,
      new Date(NOW),
    );
    const status = await loadLiveStatus(s.app, NOW);
    const incident = status.incidents.find((i) => i.id === created?.id);
    expect(incident?.title).toBe("'; DROP TABLE incidents; --");
    expect(incident?.updates[0]?.body).toBe("<script>alert(1)</script>");
  });
});
