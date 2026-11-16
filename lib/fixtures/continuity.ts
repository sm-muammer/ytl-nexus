import type { Actor } from "@/lib/roles";
import {
  BACKUP_COMPONENTS,
  continuityView,
  type BackupRunRow,
  type ContinuityDto,
  type RestoreTestRow,
} from "@/lib/continuity/model";

// Demo fixtures for Nexus Continuity (Requirement 16.18 / 1.7)
// Demonstrates realistic backups, components, verified restore tests and honest labeling.

const DAY = 24 * 3600_000;
const HOUR = 3600_000;
const MIN = 60_000;

export function buildDemoRuns(now: Date): BackupRunRow[] {
  return Array.from({ length: 7 }, (_, i) => {
    const started = new Date(now.getTime() - (7 - i) * DAY + 2 * HOUR);
    const failed = i === 3;
    const completed = new Date(started.getTime() + (failed ? 3 : 14) * MIN);

    const components = BACKUP_COMPONENTS.map((c, idx) => ({
      name: c.key,
      sizeBytes:
        c.category === "database"
          ? 4_500_000 + idx * 800_000
          : c.category === "storage"
            ? 120_000_000 + idx * 45_000_000
            : 180_000 + idx * 15_000,
      sha256: `demo-sha256-${c.key.slice(0, 8)}-${(idx + 100).toString(16)}`,
    }));

    return {
      id: i + 1,
      started_at: started,
      completed_at: completed,
      status: failed ? ("failed" as const) : ("ok" as const),
      components_json: JSON.stringify(
        failed ? components.slice(0, 3) : components,
      ),
    };
  });
}

export function buildDemoRestoreTests(now: Date): RestoreTestRow[] {
  return [
    {
      id: 1,
      tested_at: new Date(now.getTime() - 21 * DAY),
      component: "ytl_nexus-database",
      result: "ok",
      detail: "Restored into scratch database; row counts matched (3,412 rows)",
    },
    {
      id: 2,
      tested_at: new Date(now.getTime() - 21 * DAY),
      component: "config",
      result: "ok",
      detail: "Archive listed, checksums verified against SHA256SUMS",
    },
    {
      id: 3,
      tested_at: new Date(now.getTime() - 14 * DAY),
      component: "storage-mail",
      result: "failed",
      detail:
        "Archive truncated; backup re-run completed successfully same day",
    },
    {
      id: 4,
      tested_at: new Date(now.getTime() - 7 * DAY),
      component: "ytl_nexus-database",
      result: "ok",
      detail: "Restored into scratch database; all 14 tables verified",
    },
    {
      id: 5,
      tested_at: new Date(now.getTime() - 2 * HOUR),
      component: "nexus_mail-database",
      result: "ok",
      detail: "Restored into scratch database; virtual mailbox counts matched",
    },
    {
      id: 6,
      tested_at: new Date(now.getTime() - 1 * HOUR),
      component: "storage-sftpgo",
      result: "ok",
      detail: "Data snapshot unpacked; user quotas and hostkeys verified",
    },
  ];
}

export function demoContinuity(
  actor: Actor,
  now: Date = new Date(),
): ContinuityDto {
  const runs = buildDemoRuns(now);
  const tests = buildDemoRestoreTests(now);
  return continuityView(actor, runs, tests, now);
}
