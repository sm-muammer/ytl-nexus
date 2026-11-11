import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ProbeResult } from "@/lib/ops/probes";
import { SERVICE_PROBES } from "@/lib/status/checks";
import { seedDatabase } from "@/lib/server/db/seed/run";
import { pruneChecks, runCheckRound } from "@/services/worker/run-checks";
import { createScratchDatabase, type ScratchDatabase } from "./helpers/test-db";

// STA-01: the worker stores one row per checked service per round, and removes
// rows past the retention period.

let s: ScratchDatabase;
const NOW = new Date("2026-11-11T08:00:00.000Z");

beforeAll(async () => {
  s = await createScratchDatabase();
  await s.prepare();
  await seedDatabase(s.migrate);
  // The seed holds 24 hours of sample checks. Start from none.
  await s.migrate.deleteFrom("service_checks").execute();
});
afterAll(async () => {
  await s.drop();
});

const probeOk = async (): Promise<ProbeResult> => ({
  state: "healthy",
  latencyMs: 5,
  detail: "Answered",
});

describe("runCheckRound", () => {
  it("stores one row for every service that has a predefined check", async () => {
    const result = await runCheckRound(s.app, NOW, probeOk);
    expect(result.stored).toBe(Object.keys(SERVICE_PROBES).length);
    const rows = await s.app.selectFrom("service_checks").selectAll().execute();
    expect(rows).toHaveLength(result.stored);
    for (const row of rows) {
      expect(row.state).toBe("healthy");
      expect(row.checked_at.getTime()).toBe(NOW.getTime());
    }
  });

  it("records a failing probe as down, and a throwing probe as down", async () => {
    await s.app.deleteFrom("service_checks").execute();
    let call = 0;
    const probe = async (): Promise<ProbeResult> => {
      call += 1;
      if (call === 1) throw new Error("boom with 10.26.64.164 in it");
      if (call === 2) {
        return { state: "down", latencyMs: null, detail: "No answer" };
      }
      return probeOk();
    };
    await runCheckRound(s.app, NOW, probe);
    const rows = await s.app.selectFrom("service_checks").selectAll().execute();
    const down = rows.filter((r) => r.state === "down");
    expect(down).toHaveLength(2);
    for (const row of down) {
      expect(row.detail).toBe("No answer");
      expect(row.latency_ms).toBeNull();
    }
  });

  it("skips services without a predefined check and never invents a row", async () => {
    await s.app.deleteFrom("service_checks").execute();
    const rows = await runCheckRound(s.app, NOW, probeOk);
    expect(rows.skipped).toBeGreaterThan(0);
    const unchecked = await s.app
      .selectFrom("service_checks")
      .innerJoin("services", "services.id", "service_checks.service_id")
      .select("services.slug")
      .execute();
    for (const { slug } of unchecked)
      expect(SERVICE_PROBES).toHaveProperty(slug);
  });
});

describe("pruneChecks", () => {
  it("deletes rows older than the retention period and keeps newer ones", async () => {
    await s.app.deleteFrom("service_checks").execute();
    const service = await s.app
      .selectFrom("services")
      .select("id")
      .executeTakeFirstOrThrow();
    const day = 24 * 3_600_000;
    await s.app
      .insertInto("service_checks")
      .values([
        {
          service_id: service.id,
          checked_at: new Date(NOW.getTime() - 40 * day),
          state: "healthy",
          latency_ms: 1,
          detail: null,
        },
        {
          service_id: service.id,
          checked_at: new Date(NOW.getTime() - 10 * day),
          state: "healthy",
          latency_ms: 1,
          detail: null,
        },
      ])
      .execute();
    expect(await pruneChecks(s.app, NOW, 35)).toBe(1);
    const left = await s.app.selectFrom("service_checks").selectAll().execute();
    expect(left).toHaveLength(1);
  });
});
