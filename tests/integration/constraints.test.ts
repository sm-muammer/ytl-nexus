import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedDatabase } from "@/lib/server/db/seed/run";
import { createScratchDatabase, type ScratchDatabase } from "./helpers/test-db";

let s: ScratchDatabase;
beforeAll(async () => {
  s = await createScratchDatabase();
  await s.prepare();
  await seedDatabase(s.migrate);
});
afterAll(async () => {
  await s.drop();
});

const when = new Date("2026-11-01T00:00:00Z");

describe("constraints", () => {
  it("rejects a duplicate service slug", async () => {
    await expect(
      s.migrate
        .insertInto("services")
        .values({
          slug: "apache",
          name: "Duplicate",
          kind: "proxy",
          runbook_slug: null,
          unit: null,
        })
        .execute(),
    ).rejects.toThrow(/Duplicate entry/);
  });

  it("rejects a value outside an enum column", async () => {
    await expect(
      s.migrate
        .insertInto("data_tickets")
        .values({
          ticket_no: "MT-X",
          title: "t",
          site_id: 1,
          priority: "urgent" as never,
          description: "d",
        })
        .execute(),
    ).rejects.toThrow();
  });

  it("rejects a row that points at a missing parent", async () => {
    await expect(
      s.migrate
        .insertInto("service_checks")
        .values({
          service_id: 9999,
          checked_at: when,
          state: "healthy",
          latency_ms: 1,
          detail: null,
        })
        .execute(),
    ).rejects.toThrow(/foreign key/i);
  });

  it("rejects a service that depends on itself", async () => {
    await expect(
      s.migrate
        .insertInto("service_dependencies")
        .values({ service_id: 1, depends_on_id: 1 })
        .execute(),
    ).rejects.toThrow(/constraint/i);
  });

  it("rejects a resolved incident without a resolution time and the reverse", async () => {
    const base = {
      service_id: 1,
      title: "x",
      opened_at: when,
      opened_by: null,
    };
    await expect(
      s.migrate
        .insertInto("incidents")
        .values({ ...base, state: "resolved", resolved_at: null })
        .execute(),
    ).rejects.toThrow(/constraint/i);
    await expect(
      s.migrate
        .insertInto("incidents")
        .values({ ...base, state: "open", resolved_at: when })
        .execute(),
    ).rejects.toThrow(/constraint/i);
  });

  it("rejects a resolution that happens before the incident opened", async () => {
    await expect(
      s.migrate
        .insertInto("incidents")
        .values({
          service_id: 1,
          title: "x",
          state: "resolved",
          opened_at: when,
          resolved_at: new Date(when.getTime() - 1000),
          opened_by: null,
        })
        .execute(),
    ).rejects.toThrow(/constraint/i);
  });

  it("rejects invalid JSON in backup components", async () => {
    await expect(
      s.migrate
        .insertInto("backup_runs")
        .values({
          started_at: when,
          completed_at: when,
          status: "ok",
          components_json: "{not json",
        })
        .execute(),
    ).rejects.toThrow(/constraint/i);
  });

  it("blocks deleting a site that still has assets", async () => {
    await expect(
      s.migrate.deleteFrom("data_sites").where("id", "=", 1).execute(),
    ).rejects.toThrow(/foreign key/i);
  });

  it("keeps a ticket when its asset is deleted, clearing the link", async () => {
    const ticket = await s.migrate
      .selectFrom("data_tickets")
      .select(["id", "asset_id"])
      .where("asset_id", "is not", null)
      .limit(1)
      .executeTakeFirstOrThrow();
    await s.migrate
      .deleteFrom("data_tickets")
      .where("asset_id", "=", ticket.asset_id)
      .where("id", "<>", ticket.id)
      .execute();
    await s.migrate
      .deleteFrom("data_assets")
      .where("id", "=", ticket.asset_id!)
      .execute();
    const after = await s.migrate
      .selectFrom("data_tickets")
      .select("asset_id")
      .where("id", "=", ticket.id)
      .executeTakeFirstOrThrow();
    expect(after.asset_id).toBeNull();
  });
});
