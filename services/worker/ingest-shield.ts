import { createDb } from "../../lib/server/db/connection.ts";
import { readFileSync, existsSync } from "node:fs";
import {
  evaluateShieldChecks,
  parseShieldReport,
} from "../../lib/shield/model.ts";

export const SHIELD_REPORT_PATH = "/var/log/nexus/shield-scan.json";

export async function ingestShieldReport(
  db: ReturnType<typeof createDb>,
  reportPath: string = SHIELD_REPORT_PATH,
): Promise<{ ingested: number; scanId: string | null }> {
  if (!existsSync(reportPath)) {
    return { ingested: 0, scanId: null };
  }

  let text: string;
  try {
    text = readFileSync(reportPath, "utf-8");
  } catch (err) {
    console.error("Failed to read shield report file:", err);
    return { ingested: 0, scanId: null };
  }

  const report = parseShieldReport(text);
  if (!report) {
    console.error("Invalid or unparseable shield report at", reportPath);
    return { ingested: 0, scanId: null };
  }

  const findings = evaluateShieldChecks(report);
  if (findings.length === 0) {
    return { ingested: 0, scanId: report.scan_id };
  }

  let insertedCount = 0;
  for (const f of findings) {
    try {
      await db
        .insertInto("shield_findings")
        .values({
          scan_id: f.scan_id,
          check_id: f.check_id,
          severity: f.severity,
          evidence: f.evidence,
          remediation: f.remediation,
          seen_at: f.seen_at,
        })
        .onDuplicateKeyUpdate({
          severity: f.severity,
          evidence: f.evidence,
          remediation: f.remediation,
          seen_at: f.seen_at,
        })
        .execute();
      insertedCount++;
    } catch (err) {
      console.error(`Failed to ingest finding ${f.check_id}:`, err);
    }
  }

  return { ingested: insertedCount, scanId: report.scan_id };
}
