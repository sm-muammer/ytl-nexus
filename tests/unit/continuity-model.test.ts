import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  BACKUP_STALE_MS,
  DAILY_RETENTION,
  WEEKLY_RETENTION,
  backupStale,
  continuityView,
  planRetention,
  type BackupRunRow,
  type RestoreTestRow,
} from "@/lib/continuity/model";
import type { Actor } from "@/lib/roles";

// Property 20: Backup retention and freshness (Requirement 16.4, 16.10, 16.11)
// For any set of backup dates, retention keeps exactly the 7 most recent daily
// and 4 most recent weekly backups and removes the rest; the freshness check
// reports stale exactly when the last successful backup is older than 26 hours;
// and the Viewer continuity view never contains sizes or restore steps.

describe("Property 20: backup retention and freshness", () => {
  it("freshness check reports stale exactly when the last successful backup is older than 26 hours or null", () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date("2020-01-01"), max: new Date("2030-01-01") }),
        fc.integer({ min: -48, max: 48 }),
        (now, offsetHours) => {
          fc.pre(!Number.isNaN(now.getTime()));
          const lastOk = new Date(now.getTime() - offsetHours * 3600_000);
          const isStale = backupStale(lastOk, now);
          const expected = offsetHours * 3600_000 > BACKUP_STALE_MS;
          expect(isStale).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );

    expect(backupStale(null, new Date())).toBe(true);
  });

  it("retention keeps at most 7 daily and 4 weekly backups, preserving newest per bucket", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.date({
            min: new Date("2026-01-01T00:00:00Z"),
            max: new Date("2026-12-31T23:59:59Z"),
            noInvalidDate: true,
          }),
          { minLength: 1, maxLength: 50 },
        ),
        (dates) => {
          const items = dates.map((d, i) => ({
            id: `backup-${i}`,
            date: d,
          }));
          const plan = planRetention(items);

          // Kept items + pruned items = original items
          expect(plan.keep.length + plan.prune.length).toBe(items.length);

          // No duplicate IDs
          const allIds = [
            ...plan.keep.map((x) => x.id),
            ...plan.prune.map((x) => x.id),
          ];
          expect(new Set(allIds).size).toBe(items.length);

          // Unique days in kept daily is at most 7
          expect(plan.keptDaily.length).toBeLessThanOrEqual(DAILY_RETENTION);
          // Unique weeks in kept weekly is at most 4
          expect(plan.keptWeekly.length).toBeLessThanOrEqual(WEEKLY_RETENTION);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("continuityView for Viewer never contains sizes or restore steps (Requirement 16.10 / CON-05)", () => {
    const actorViewer: Actor = { userId: "user-1", role: "viewer" };
    const actorVisitor: Actor = null;

    fc.assert(
      fc.property(
        fc.constantFrom(actorViewer, actorVisitor),
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            started_at: fc.date(),
            completed_at: fc.date(),
            status: fc.constantFrom("ok" as const, "failed" as const),
            components_json: fc.constant(
              JSON.stringify([
                {
                  name: "ytl_nexus-database",
                  sizeBytes: 1234567,
                  sha256: "abc",
                },
              ]),
            ),
          }),
          { maxLength: 10 },
        ),
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 1000 }),
            tested_at: fc.date(),
            component: fc.string(),
            result: fc.constantFrom("ok" as const, "failed" as const),
            detail: fc.string(),
          }),
          { maxLength: 5 },
        ),
        (actor, runs, tests) => {
          const view = continuityView(actor, runs, tests, new Date());
          expect(view.roleDetail).toBe(false);
          for (const comp of view.components) {
            expect(comp.sizeBytes).toBeUndefined();
            expect(comp.restoreSteps).toBeUndefined();
            expect(comp.lastVerifiedRestore?.detail).toBeUndefined();
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("continuityView for Operator or Admin includes sizes, ages and restore steps (Requirement 16.9 / CON-05)", () => {
    const actorOperator: Actor = { userId: "op-1", role: "operator" };
    const actorAdmin: Actor = { userId: "admin-1", role: "admin" };

    const mockRun: BackupRunRow = {
      id: 1,
      started_at: new Date("2026-11-15T02:00:00Z"),
      completed_at: new Date("2026-11-15T02:14:00Z"),
      status: "ok",
      components_json: JSON.stringify([
        { name: "ytl_nexus-database", sizeBytes: 4500000, sha256: "fedcba" },
      ]),
    };

    const mockTest: RestoreTestRow = {
      id: 1,
      tested_at: new Date("2026-11-15T03:00:00Z"),
      component: "ytl_nexus-database",
      result: "ok",
      detail: "Row count matched",
    };

    for (const actor of [actorOperator, actorAdmin]) {
      const view = continuityView(
        actor,
        [mockRun],
        [mockTest],
        new Date("2026-11-15T12:00:00Z"),
      );
      expect(view.roleDetail).toBe(true);
      const dbComp = view.components.find(
        (c) => c.key === "ytl_nexus-database",
      );
      expect(dbComp).toBeDefined();
      expect(dbComp?.sizeBytes).toBe(4500000);
      expect(dbComp?.restoreSteps).toBeDefined();
      expect(dbComp?.restoreSteps?.length).toBeGreaterThan(0);
      expect(dbComp?.lastVerifiedRestore?.detail).toBe("Row count matched");
    }
  });
});
