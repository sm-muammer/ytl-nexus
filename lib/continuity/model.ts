import type { Actor } from "@/lib/roles";

export const BACKUP_STALE_HOURS = 26;
export const BACKUP_STALE_MS = BACKUP_STALE_HOURS * 3600_000;
export const DAILY_RETENTION = 7;
export const WEEKLY_RETENTION = 4;

export interface BackupComponentDef {
  key: string;
  name: string;
  category: "database" | "storage" | "config";
  restoreDoc: string;
  restoreSteps: string[];
}

export const BACKUP_COMPONENTS: readonly BackupComponentDef[] = [
  {
    key: "ytl_nexus-database",
    name: "Platform Database (ytl_nexus)",
    category: "database",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "mariadb ytl_nexus < <archive_extract>/ytl_nexus.sql",
      "mariadb ytl_nexus -e 'CALL migrate_status();' (or npm run db:migrate)",
      "systemctl restart nexus-web",
    ],
  },
  {
    key: "nexus_mail-database",
    name: "Mail Virtual Users Database (nexus_mail)",
    category: "database",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "mariadb nexus_mail < <archive_extract>/nexus_mail.sql",
      "systemctl restart dovecot postfix",
    ],
  },
  {
    key: "nexus_roundcube-database",
    name: "Roundcube Webmail Database (nexus_roundcube)",
    category: "database",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "mariadb nexus_roundcube < <archive_extract>/nexus_roundcube.sql",
    ],
  },
  {
    key: "nexus_sftpgo-database",
    name: "SFTPGo Metadata Database (nexus_sftpgo)",
    category: "database",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "mariadb nexus_sftpgo < <archive_extract>/nexus_sftpgo.sql",
      "systemctl restart sftpgo",
    ],
  },
  {
    key: "nexus_wordpress-database",
    name: "WordPress CMS Database (nexus_wordpress)",
    category: "database",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "mariadb nexus_wordpress < <archive_extract>/nexus_wordpress.sql",
    ],
  },
  {
    key: "config",
    name: "System & App Configuration (/etc/ytl-nexus, services, roundcube)",
    category: "config",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "tar -C / -xzf config.tar.gz",
      "systemctl daemon-reload",
      "chmod 0600 /etc/ytl-nexus/*.env",
    ],
  },
  {
    key: "storage-mail",
    name: "Virtual Mail Storage (/var/mail/vmail)",
    category: "storage",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "tar -C / -xzf mail-storage.tar.gz",
      "chown -R vmail:vmail /var/mail/vmail",
    ],
  },
  {
    key: "storage-sftpgo",
    name: "Transfer User Data & Hostkeys (/srv/nexus-transfer, /var/lib/sftpgo/hostkeys)",
    category: "storage",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "tar -C / -xzf sftpgo-data.tar.gz",
      "chown -R sftpgo:sftpgo /srv/nexus-transfer /var/lib/sftpgo/hostkeys",
    ],
  },
  {
    key: "storage-wordpress",
    name: "WordPress Media Uploads (/var/www/wordpress/wp-content/uploads)",
    category: "storage",
    restoreDoc: "docs/operations/backup-restore.md",
    restoreSteps: [
      "tar -C / -xzf wp-uploads.tar.gz",
      "chown -R apache:apache /var/www/wordpress/wp-content/uploads",
    ],
  },
] as const;

export type BackupComponentKey = (typeof BACKUP_COMPONENTS)[number]["key"];

export interface BackupRunRow {
  id: number;
  started_at: Date;
  completed_at: Date;
  status: "ok" | "failed";
  components_json: string;
}

export interface RestoreTestRow {
  id: number;
  tested_at: Date;
  component: string;
  result: "ok" | "failed";
  detail: string | null;
}

export interface ComponentItemView {
  key: string;
  name: string;
  category: "database" | "storage" | "config";
  status: "ok" | "failed" | "pending";
  lastBackupAgeHours?: number;
  lastBackupAt?: string;
  sizeBytes?: number;
  sha256?: string;
  lastVerifiedRestore?: {
    testedAt: string;
    result: "ok" | "failed";
    detail?: string;
  };
  restoreSteps?: string[];
  restoreDoc?: string;
}

export interface ContinuityDto {
  roleDetail: boolean;
  freshness: "fresh" | "stale";
  lastBackupAt: string | null;
  lastBackupStatus: "ok" | "failed" | "none";
  components: ComponentItemView[];
  summary: {
    totalComponents: number;
    verifiedComponents: number;
    failedBackups: number;
  };
}

/**
 * Checks whether the last successful backup is older than 26 hours.
 * If null (never backed up), it is stale.
 */
export function backupStale(lastOk: Date | null, now: Date): boolean {
  if (!lastOk || Number.isNaN(lastOk.getTime())) return true;
  if (Number.isNaN(now.getTime())) return true;
  return now.getTime() - lastOk.getTime() > BACKUP_STALE_MS;
}

/**
 * Computes backup retention keeping at most 7 daily backups and 4 weekly backups.
 * Backups are grouped by day (YYYY-MM-DD) and by ISO week (YYYY-WW).
 */
export function planRetention<T extends { id: string; date: Date }>(
  items: T[],
): {
  keep: T[];
  prune: T[];
  keptDaily: T[];
  keptWeekly: T[];
} {
  // Filter out any invalid dates
  const valid = items.filter((x) => !isNaN(x.date.getTime()));

  // Sort descending by date (newest first)
  const sorted = [...valid].sort((a, b) => b.date.getTime() - a.date.getTime());

  const dayMap = new Map<string, T>();
  const weekMap = new Map<string, T>();

  for (const item of sorted) {
    const d = item.date;
    const dayKey = d.toISOString().slice(0, 10);
    if (!dayMap.has(dayKey)) {
      dayMap.set(dayKey, item);
    }

    // Weekly bucket: year and week number
    const target = new Date(d.valueOf());
    const dayNr = (d.getUTCDay() + 6) % 7;
    target.setUTCDate(target.getUTCDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setUTCMonth(0, 1);
    if (target.getUTCDay() !== 4) {
      target.setUTCMonth(0, 1 + ((4 - target.getUTCDay() + 7) % 7));
    }
    const weekNr =
      1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    const weekKey = `${d.getUTCFullYear()}-W${String(weekNr).padStart(2, "0")}`;

    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, item);
    }
  }

  const keptDaily = Array.from(dayMap.values()).slice(0, DAILY_RETENTION);
  const keptWeekly = Array.from(weekMap.values()).slice(0, WEEKLY_RETENTION);

  const keepIds = new Set<string>([
    ...keptDaily.map((x) => x.id),
    ...keptWeekly.map((x) => x.id),
  ]);

  const keep: T[] = [];
  const prune: T[] = [];

  for (const item of sorted) {
    if (keepIds.has(item.id)) {
      keep.push(item);
    } else {
      prune.push(item);
    }
  }

  return { keep, prune, keptDaily, keptWeekly };
}

/**
 * Derives the Continuity view for a given actor.
 * Viewers and Visitors see status only (no sizes, no restore steps, no restore details).
 * Operators and Admins see full detail.
 */
export function continuityView(
  actor: Actor,
  runs: BackupRunRow[],
  restoreTests: RestoreTestRow[],
  now: Date = new Date(),
): ContinuityDto {
  const isOperatorOrAdmin =
    actor !== null && (actor.role === "operator" || actor.role === "admin");

  // Sort runs newest first
  const sortedRuns = [...runs].sort(
    (a, b) => b.completed_at.getTime() - a.completed_at.getTime(),
  );

  const latestRun = sortedRuns[0] ?? null;
  const latestOkRun = sortedRuns.find((r) => r.status === "ok") ?? null;

  const isStale = backupStale(
    latestOkRun ? latestOkRun.completed_at : null,
    now,
  );

  // Parse latest run's components JSON
  type ParsedComp = { name: string; sizeBytes?: number; sha256?: string };
  const runCompsMap = new Map<string, ParsedComp>();
  if (latestRun) {
    try {
      const parsed = JSON.parse(latestRun.components_json) as ParsedComp[];
      if (Array.isArray(parsed)) {
        for (const c of parsed) {
          if (c && typeof c.name === "string") {
            runCompsMap.set(c.name, c);
          }
        }
      }
    } catch {
      // Ignore JSON parse errors
    }
  }

  // Sort restore tests newest first
  const sortedTests = [...restoreTests].sort(
    (a, b) => b.tested_at.getTime() - a.tested_at.getTime(),
  );

  const testsByComp = new Map<string, RestoreTestRow>();
  for (const t of sortedTests) {
    if (!testsByComp.has(t.component)) {
      testsByComp.set(t.component, t);
    }
  }

  const componentViews: ComponentItemView[] = BACKUP_COMPONENTS.map((def) => {
    const runInfo = runCompsMap.get(def.key);
    const testInfo = testsByComp.get(def.key);

    let compStatus: "ok" | "failed" | "pending" = "pending";
    if (latestRun) {
      if (latestRun.status === "failed") {
        compStatus = runInfo ? "ok" : "failed";
      } else {
        compStatus = runInfo ? "ok" : "failed";
      }
    }

    const ageHours = latestRun
      ? Math.max(
          0,
          Math.round(
            (now.getTime() - latestRun.completed_at.getTime()) / 3600_000,
          ),
        )
      : undefined;

    const lastVerified =
      testInfo && !Number.isNaN(testInfo.tested_at.getTime())
        ? {
            testedAt: testInfo.tested_at.toISOString(),
            result: testInfo.result,
            detail: isOperatorOrAdmin
              ? (testInfo.detail ?? undefined)
              : undefined,
          }
        : undefined;

    const base: ComponentItemView = {
      key: def.key,
      name: def.name,
      category: def.category,
      status: compStatus,
      lastBackupAt:
        latestRun?.completed_at &&
        !Number.isNaN(latestRun.completed_at.getTime())
          ? latestRun.completed_at.toISOString()
          : undefined,
      lastVerifiedRestore: lastVerified,
    };

    if (isOperatorOrAdmin) {
      base.lastBackupAgeHours = ageHours;
      base.sizeBytes = runInfo?.sizeBytes;
      base.sha256 = runInfo?.sha256;
      base.restoreSteps = def.restoreSteps;
      base.restoreDoc = def.restoreDoc;
    }

    return base;
  });

  const verifiedCount = componentViews.filter(
    (c) => c.lastVerifiedRestore?.result === "ok",
  ).length;

  const failedBackupsCount = runs.filter((r) => r.status === "failed").length;

  return {
    roleDetail: isOperatorOrAdmin,
    freshness: isStale ? "stale" : "fresh",
    lastBackupAt:
      latestRun && !Number.isNaN(latestRun.completed_at.getTime())
        ? latestRun.completed_at.toISOString()
        : null,
    lastBackupStatus: latestRun ? latestRun.status : "none",
    components: componentViews,
    summary: {
      totalComponents: BACKUP_COMPONENTS.length,
      verifiedComponents: verifiedCount,
      failedBackups: failedBackupsCount,
    },
  };
}
