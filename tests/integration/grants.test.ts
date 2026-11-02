import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { INGEST_TABLES } from "@/lib/server/db/provision";
import { APPLICATION_TABLES } from "@/lib/server/db/schema";
import { createScratchDatabase, type ScratchDatabase } from "./helpers/test-db";

let s: ScratchDatabase;
beforeAll(async () => {
  s = await createScratchDatabase();
  await s.prepare();
});
afterAll(async () => {
  await s.drop();
});

const when = new Date("2026-11-01T00:00:00Z");
const denied = /command denied|access denied/i;

describe("least-privilege users (requirement 5.1)", () => {
  it("lets nexus_app read and write application tables", async () => {
    await s.app
      .insertInto("data_sites")
      .values({
        code: "T-1",
        name: "Test",
        city: "KL",
        state: "WP",
        kind: "office",
      })
      .execute();
    await s.app
      .updateTable("data_sites")
      .set({ name: "Renamed" })
      .where("code", "=", "T-1")
      .execute();
    const row = await s.app
      .selectFrom("data_sites")
      .select("name")
      .where("code", "=", "T-1")
      .executeTakeFirstOrThrow();
    expect(row.name).toBe("Renamed");
    await s.app.deleteFrom("data_sites").where("code", "=", "T-1").execute();
  });

  it("keeps audit_events append-only for nexus_app", async () => {
    await s.app
      .insertInto("audit_events")
      .values({
        actor_id: null,
        role: null,
        action: "test.event",
        target: "t",
        result: "success",
        source_ip: "127.0.0.1",
      })
      .execute();
    expect(
      (await s.app.selectFrom("audit_events").select("id").execute()).length,
    ).toBe(1);
    await expect(
      s.app.updateTable("audit_events").set({ target: "x" }).execute(),
    ).rejects.toThrow(denied);
    await expect(s.app.deleteFrom("audit_events").execute()).rejects.toThrow(
      denied,
    );
  });

  it("refuses schema changes for nexus_app", async () => {
    await expect(
      sql`CREATE TABLE intruder (id INT)`.execute(s.app),
    ).rejects.toThrow(denied);
    await expect(sql`DROP TABLE services`.execute(s.app)).rejects.toThrow(
      denied,
    );
    await expect(
      sql`ALTER TABLE services ADD COLUMN x INT`.execute(s.app),
    ).rejects.toThrow(denied);
  });

  it("lets nexus_ingest insert into scan and backup tables only", async () => {
    await s.ingest
      .insertInto("backup_runs")
      .values({
        started_at: when,
        completed_at: when,
        status: "ok",
        components_json: "[]",
      })
      .execute();
    await s.ingest
      .insertInto("restore_tests")
      .values({
        tested_at: when,
        component: "config",
        result: "ok",
        detail: null,
      })
      .execute();
    await s.ingest
      .insertInto("shield_findings")
      .values({
        scan_id: "s",
        check_id: "c",
        severity: "info",
        evidence: "e",
        remediation: "r",
        seen_at: when,
      })
      .execute();
  });

  it("gives nexus_ingest no SELECT, UPDATE or DELETE anywhere", async () => {
    for (const table of INGEST_TABLES) {
      await expect(
        s.ingest.selectFrom(table).select("id").execute(),
      ).rejects.toThrow(denied);
      await expect(s.ingest.deleteFrom(table).execute()).rejects.toThrow(
        denied,
      );
    }
    await expect(
      s.ingest.updateTable("backup_runs").set({ status: "failed" }).execute(),
    ).rejects.toThrow(denied);
    await expect(
      s.ingest
        .insertInto("services")
        .values({
          slug: "x",
          name: "x",
          kind: "web",
          runbook_slug: null,
          unit: null,
        })
        .execute(),
    ).rejects.toThrow(denied);
    await expect(
      s.ingest.selectFrom("audit_events").select("id").execute(),
    ).rejects.toThrow(denied);
  });

  it("lists exactly the expected grants for the two limited users", async () => {
    const grants = async (user: string) =>
      (
        (await s.admin.query("SHOW GRANTS FOR ?@?", [user, "%"]))[0] as Record<
          string,
          string
        >[]
      )
        .map((r) => Object.values(r)[0] as string)
        .filter((g) => g.includes(`\`${s.name}\``));
    const ingest = await grants(s.options.ingest.user);
    expect(ingest.length).toBe(INGEST_TABLES.length);
    expect(ingest.every((g) => g.startsWith("GRANT INSERT ON"))).toBe(true);
    const app = await grants(s.options.app.user);
    expect(app.length).toBe(APPLICATION_TABLES.length);
    expect(
      app.some(
        (g) => g.includes("audit_events") && g.includes("SELECT, INSERT ON"),
      ),
    ).toBe(true);
    expect(app.some((g) => /GRANT OPTION/i.test(g))).toBe(false);
  });

  it("is repeatable and does not widen access when applied again", async () => {
    const { applyTableGrants } = await import("@/lib/server/db/provision");
    await s.admin.query("USE ??", [s.name]);
    await applyTableGrants(s.admin, s.options);
    await expect(
      s.app.updateTable("audit_events").set({ target: "x" }).execute(),
    ).rejects.toThrow(denied);
  });

  it("lets nexus_migrate change the schema", async () => {
    await sql`CREATE TABLE scratch_probe (id INT)`.execute(s.migrate);
    await sql`DROP TABLE scratch_probe`.execute(s.migrate);
  });
});
