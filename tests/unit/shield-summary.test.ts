import { buildShieldSummary, type ShieldFindingItem } from "@/lib/shield/model";
import { describe, expect, it } from "vitest";

describe("buildShieldSummary", () => {
  it("counts severities and aggregates correctly", () => {
    const findings: ShieldFindingItem[] = [
      {
        scan_id: "scan-1",
        check_id: "SHD-01",
        severity: "high",
        evidence: "Cert expiring",
        remediation: "Renew",
        seen_at: new Date("2026-11-16T00:00:00Z"),
      },
      {
        scan_id: "scan-1",
        check_id: "SHD-02",
        severity: "medium",
        evidence: "Port 9999 open",
        remediation: "Close",
        seen_at: new Date("2026-11-16T00:00:00Z"),
      },
      {
        scan_id: "scan-1",
        check_id: "SHD-03",
        severity: "low",
        evidence: "Minor update",
        remediation: "Update",
        seen_at: new Date("2026-11-16T00:00:00Z"),
      },
      {
        scan_id: "scan-1",
        check_id: "SHD-04",
        severity: "info",
        evidence: "All good",
        remediation: "None",
        seen_at: new Date("2026-11-16T00:00:00Z"),
      },
    ];

    const summary = buildShieldSummary(findings);
    expect(summary.totalChecks).toBe(4);
    expect(summary.highCount).toBe(1);
    expect(summary.mediumCount).toBe(1);
    expect(summary.lowCount).toBe(1);
    expect(summary.infoCount).toBe(1);
    expect(summary.scanId).toBe("scan-1");
  });

  it("handles empty findings gracefully", () => {
    const summary = buildShieldSummary([]);
    expect(summary.totalChecks).toBe(0);
    expect(summary.highCount).toBe(0);
    expect(summary.scanId).toBeNull();
  });
});
