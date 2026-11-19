// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  auditEventsToCsv,
  type AuditEventDto,
} from "@/lib/server/audit";
import { ACTION_POLICY } from "@/lib/server/policy";

describe("Audit Completeness & CSV Export", () => {
  it("escapes CSV cells against formula injection", () => {
    expect(escapeCsvCell("normal_text")).toBe("normal_text");
    expect(escapeCsvCell("=1+1")).toBe("`=1+1");
    expect(escapeCsvCell("+SUM(A1:A10)")).toBe("`+SUM(A1:A10)");
    expect(escapeCsvCell("-CMD|' /C calc'!A0")).toBe("`-CMD|' /C calc'!A0");
    expect(escapeCsvCell("@cmd")).toBe("`@cmd");
    expect(escapeCsvCell("\tcalc")).toBe("`\tcalc");
    expect(escapeCsvCell("has,comma")).toBe('"has,comma"');
    expect(escapeCsvCell('has"quotes"')).toBe('"has""quotes"""');
  });

  it("formats audit records into an RFC 4180 CSV with escaped cells", () => {
    const events: AuditEventDto[] = [
      {
        id: 1,
        ts: "2026-11-16T12:00:00.000Z",
        actorId: "user-admin",
        role: "admin",
        action: "control.user.create",
        target: '=HYPERLINK("http://evil.com")',
        result: "success",
        sourceIp: "10.26.1.50",
      },
      {
        id: 2,
        ts: "2026-11-16T12:05:00.000Z",
        actorId: null,
        role: null,
        action: "auth.sign-in",
        target: "user:target@example.com",
        result: "failure",
        sourceIp: "10.26.1.99",
      },
    ];

    const csv = auditEventsToCsv(events);
    expect(csv).toContain(
      "id,ts,actor_id,role,action,target,result,source_ip\n",
    );
    // Target starting with = must be escaped with ` or '
    expect(csv).toContain('"`=HYPERLINK');
    expect(csv).toContain("control.user.create");
  });

  it("ensures every Control action in ACTION_POLICY is configured with audit and admin requirements", () => {
    const controlActions = ACTION_POLICY.filter(
      (a) =>
        a.id.startsWith("control.") ||
        a.id.startsWith("transfer.") ||
        a.id.startsWith("mail."),
    );

    expect(controlActions.length).toBeGreaterThanOrEqual(10);
    for (const action of controlActions) {
      expect(action.minRole, `${action.id} must require admin role`).toBe(
        "admin",
      );
      expect(action.stepUp, `${action.id} must not require stepUp`).toBe(false);
      expect(action.hidden, `${action.id} must be hidden`).toBe(true);
    }
  });
});
