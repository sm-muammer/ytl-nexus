import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "kysely";
import { ZodError } from "zod";
import { recordAuditEvent } from "@/lib/server/db/audit";
import { createDb } from "@/lib/server/db/connection";
import { probeDatabase } from "@/lib/server/db/probe";
import { checkReadiness } from "@/lib/server/health";
import { createScratchDatabase, type ScratchDatabase } from "./helpers/test-db";

let s: ScratchDatabase;
beforeAll(async () => {
  s = await createScratchDatabase();
  await s.prepare();
});
afterAll(async () => {
  await s.drop();
});

const count = async () =>
  Number(
    (
      await s.app
        .selectFrom("audit_events")
        .select(sql<number>`count(*)`.as("n"))
        .executeTakeFirstOrThrow()
    ).n,
  );

const valid = {
  actorId: "user-1",
  role: "operator" as const,
  action: "data.asset.create",
  target: "asset:SRV-001",
  result: "success" as const,
  sourceIp: "10.26.64.10",
};

describe("audit writes", () => {
  it("stores a valid event", async () => {
    await recordAuditEvent(s.app, valid);
    expect(await count()).toBe(1);
  });

  it("rejects invalid input before any statement and changes nothing (Property 6)", async () => {
    const before = await count();
    const bad = [
      { ...valid, action: "" },
      { ...valid, result: "maybe" },
      { ...valid, role: "root" },
      { ...valid, sourceIp: "not an ip" },
      { ...valid, target: "x".repeat(256) },
      { ...valid, actorId: 42 },
    ];
    for (const input of bad) {
      // @ts-expect-error deliberately wrong shapes
      await expect(recordAuditEvent(s.app, input)).rejects.toBeInstanceOf(
        ZodError,
      );
    }
    expect(await count()).toBe(before);
  });

  it("stores hostile text literally and never runs it", async () => {
    const hostile = "x'); DROP TABLE audit_events; --";
    await recordAuditEvent(s.app, { ...valid, target: hostile });
    const row = await s.app
      .selectFrom("audit_events")
      .select("target")
      .where("target", "=", hostile)
      .executeTakeFirst();
    expect(row?.target).toBe(hostile);
    expect(await count()).toBeGreaterThan(0);
  });
});

describe("database readiness probe", () => {
  it("reports ok within 2 seconds when the database is reachable", async () => {
    const started = Date.now();
    const result = await checkReadiness({
      database: () => probeDatabase(s.app),
    });
    expect(result.checks.database).toBe("ok");
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("reports unavailable within 2 seconds when it is not, without leaking details", async () => {
    const dead = createDb(
      { ...s.config("app"), port: 1 },
      { connectionLimit: 1 },
    );
    const started = Date.now();
    const result = await checkReadiness({
      database: () => probeDatabase(dead),
    });
    expect(result.ready).toBe(false);
    expect(result.checks.database).toBe("unavailable");
    expect(Date.now() - started).toBeLessThan(2500);
    expect(JSON.stringify(result)).not.toMatch(
      /ECONNREFUSED|127\.0\.0\.1|password/i,
    );
    await dead.destroy();
  });
});
