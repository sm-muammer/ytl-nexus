import "server-only";

import { createDb, readDbConfig } from "@/lib/server/db/connection";
import { demoShield } from "@/lib/fixtures/shield";
import { getMode } from "@/lib/server/mode";
import {
  buildShieldSummary,
  severityWeight,
  type ShieldCheckId,
  type ShieldFindingItem,
  type ShieldSummaryDto,
} from "@/lib/shield/model";
import type { Severity } from "@/lib/server/db/schema";

export async function getShieldView(): Promise<ShieldSummaryDto> {
  const mode = getMode();
  if (mode === "demo") {
    return demoShield();
  }

  try {
    const db = createDb(readDbConfig(), { connectionLimit: 2 });
    try {
      // Find the latest scan_id
      const latestScan = await db
        .selectFrom("shield_findings")
        .select(["scan_id", "seen_at"])
        .orderBy("seen_at", "desc")
        .limit(1)
        .executeTakeFirst();

      if (!latestScan) {
        return demoShield();
      }

      // Fetch all findings from the latest scan
      const rows = await db
        .selectFrom("shield_findings")
        .selectAll()
        .where("scan_id", "=", latestScan.scan_id)
        .orderBy("seen_at", "desc")
        .execute();

      const findings: ShieldFindingItem[] = rows.map((r) => ({
        id: Number(r.id),
        scan_id: r.scan_id,
        check_id: r.check_id as ShieldCheckId,
        severity: r.severity as Severity,
        evidence: r.evidence,
        remediation: r.remediation,
        seen_at: new Date(r.seen_at),
      }));

      // Sort by severity (high to info)
      findings.sort(
        (a, b) => severityWeight(b.severity) - severityWeight(a.severity),
      );

      return buildShieldSummary(findings);
    } finally {
      await db.destroy();
    }
  } catch (error) {
    console.error("Failed to load shield findings from database:", error);
    return demoShield();
  }
}
