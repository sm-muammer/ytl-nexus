import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { SEEDED_TABLES, seedDatabase } from "@/lib/server/db/seed/run";
import { createScratchDatabase, type ScratchDatabase } from "./helpers/test-db";

let a: ScratchDatabase;
let b: ScratchDatabase;
beforeAll(async () => {
  [a, b] = await Promise.all([
    createScratchDatabase(),
    createScratchDatabase(),
  ]);
  await Promise.all([a.prepare(), b.prepare()]);
});
afterAll(async () => {
  await Promise.all([a.drop(), b.drop()]);
});

async function dump(s: ScratchDatabase): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  for (const table of SEEDED_TABLES) {
    const [rows] = await s.admin.query(
      `SELECT * FROM \`${s.name}\`.\`${table}\` ORDER BY 1, 2`,
    );
    // created_at and updated_at are set by the database clock, not the seed.
    out[table] = (rows as Record<string, unknown>[]).map((row) => {
      const rest = { ...row };
      delete rest.created_at;
      delete rest.updated_at;
      return rest;
    });
  }
  return out;
}

describe("seed", () => {
  it("produces identical rows on two empty databases (Property 9)", async () => {
    await seedDatabase(a.migrate);
    await seedDatabase(b.migrate);
    expect(await dump(a)).toEqual(await dump(b));
  });

  it("produces identical rows again after a reset", async () => {
    const before = await dump(a);
    await seedDatabase(a.migrate, { reset: true });
    expect(await dump(a)).toEqual(before);
  });

  it("refuses to run over existing rows unless told to reset", async () => {
    await expect(seedDatabase(a.migrate)).rejects.toThrow(/Seed refused/);
  });

  it("fills every seeded table and records itself in the audit trail", async () => {
    for (const table of SEEDED_TABLES) {
      const row = await a.migrate
        .selectFrom(table)
        .select(sql<number>`count(*)`.as("n"))
        .executeTakeFirstOrThrow();
      expect(Number(row.n), table).toBeGreaterThan(0);
    }
    const audit = await a.migrate
      .selectFrom("audit_events")
      .select("action")
      .where("action", "=", "database.seed")
      .execute();
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });

  it("leaves no orphan rows", async () => {
    const orphans = async (query: string) =>
      Number(((await a.admin.query(query))[0] as { n: number }[])[0]?.n);
    const db = `\`${a.name}\``;
    expect(
      await orphans(
        `SELECT COUNT(*) n FROM ${db}.service_checks c LEFT JOIN ${db}.services s ON s.id = c.service_id WHERE s.id IS NULL`,
      ),
    ).toBe(0);
    expect(
      await orphans(
        `SELECT COUNT(*) n FROM ${db}.data_tickets t LEFT JOIN ${db}.data_sites s ON s.id = t.site_id WHERE s.id IS NULL`,
      ),
    ).toBe(0);
    expect(
      await orphans(
        `SELECT COUNT(*) n FROM ${db}.incident_updates u LEFT JOIN ${db}.incidents i ON i.id = u.incident_id WHERE i.id IS NULL`,
      ),
    ).toBe(0);
  });

  it("contains no password, key or token material (requirement 5.8)", async () => {
    const text = JSON.stringify(await dump(a));
    expect(text).not.toMatch(/BEGIN [A-Z ]*PRIVATE KEY/);
    expect(text).not.toMatch(/"(password|secret|token|api[_-]?key)"/i);
    expect(text).not.toMatch(/(password|passwd|secret|bearer)\s*[:=]/i);
  });
});
