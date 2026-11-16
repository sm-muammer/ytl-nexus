import { describe, expect, it, vi } from "vitest";
import { ingestShieldReport } from "@/services/worker/ingest-shield";
import * as fs from "node:fs";

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
  };
});

describe("ingestShieldReport", () => {
  it("returns 0 if report file does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    const mockDb = {} as unknown as Parameters<typeof ingestShieldReport>[0];
    const res = await ingestShieldReport(mockDb, "/fake/path.json");
    expect(res).toEqual({ ingested: 0, scanId: null });
  });

  it("ingests findings and updates database", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    const mockReport = JSON.stringify({
      scan_id: "scan-mock-1",
      scanned_at: "2026-11-16T10:00:00.000Z",
      tls_certs: [],
      listening_ports: [],
      firewall: { active: true, zone: "public" },
      updates: { security_count: 0 },
      failed_logins_24h: { ssh_failures: 0, sftp_failures: 0 },
      sshd_config: { permit_root_login: "no", password_authentication: "no" },
      selinux: { mode: "Enforcing" },
      disks: [],
      time_sync: { synchronized: true },
      backup_freshness: { latest_backup_hours_ago: 2, status: "ok" },
      fail2ban: { active: true },
    });
    vi.mocked(fs.readFileSync).mockReturnValue(mockReport);

    const insertedValues: Array<Record<string, unknown>> = [];
    const mockDb = {
      insertInto: vi.fn().mockReturnValue({
        values: vi.fn().mockImplementation((val: Record<string, unknown>) => {
          insertedValues.push(val);
          return {
            onDuplicateKeyUpdate: vi.fn().mockReturnValue({
              execute: vi.fn().mockResolvedValue([]),
            }),
          };
        }),
      }),
    } as unknown as Parameters<typeof ingestShieldReport>[0];

    const res = await ingestShieldReport(mockDb, "/fake/path.json");
    expect(res.scanId).toBe("scan-mock-1");
    expect(res.ingested).toBe(11);
    expect(insertedValues.length).toBe(11);
    expect(insertedValues[0]?.scan_id).toBe("scan-mock-1");
  });
});
