import { describe, expect, it } from "vitest";
import {
  formatIncidentDuration,
  formatIncidentTicketNo,
  incidentTrackingPath,
  isValidIncidentTicketNo,
  normalizeIncidentTicketNo,
} from "@/lib/status/tickets";

describe("formatIncidentTicketNo", () => {
  const openedAt = new Date("2026-11-19T10:00:00Z");

  it("formats a UTC year and zero-padded sequence", () => {
    expect(formatIncidentTicketNo(openedAt, 1)).toBe("INC-2026-0001");
    expect(formatIncidentTicketNo(openedAt, 42)).toBe("INC-2026-0042");
    expect(formatIncidentTicketNo(openedAt, 9999)).toBe("INC-2026-9999");
  });

  it("scales cleanly beyond 9,999", () => {
    expect(formatIncidentTicketNo(openedAt, 12345)).toBe("INC-2026-12345");
  });

  it("accepts epoch milliseconds as openedAt", () => {
    expect(formatIncidentTicketNo(Date.UTC(2027, 0, 5), 7)).toBe(
      "INC-2027-0007",
    );
  });

  it("throws on non-positive or non-integer sequence numbers", () => {
    expect(() => formatIncidentTicketNo(openedAt, 0)).toThrow();
    expect(() => formatIncidentTicketNo(openedAt, -3)).toThrow();
    expect(() => formatIncidentTicketNo(openedAt, 1.5)).toThrow();
    expect(() => formatIncidentTicketNo(openedAt, Number.NaN)).toThrow();
  });

  it("throws on invalid dates", () => {
    expect(() => formatIncidentTicketNo(new Date("invalid"), 1)).toThrow();
    expect(() => formatIncidentTicketNo(Number.NaN, 1)).toThrow();
  });
});

describe("normalizeIncidentTicketNo", () => {
  it("trims whitespace, strips optional #, and uppercases valid ticket numbers", () => {
    expect(normalizeIncidentTicketNo("INC-2026-0001")).toBe("INC-2026-0001");
    expect(normalizeIncidentTicketNo(" #inc-2026-0002 ")).toBe("INC-2026-0002");
    expect(normalizeIncidentTicketNo("inc-2026-12345")).toBe("INC-2026-12345");
  });

  it("returns null for invalid or hostile strings", () => {
    const invalid = [
      "",
      "   ",
      "#",
      "INC-26-0001",
      "../etc",
      "INC-2026-1",
      "INC-2026-0001; DROP TABLE",
      "MT-2026-0001",
      "INC-2026-00000000001",
      "INC-2026-0001/extra",
    ];
    for (const raw of invalid) {
      expect(normalizeIncidentTicketNo(raw), raw).toBeNull();
    }
  });
});

describe("isValidIncidentTicketNo", () => {
  it("accepts only canonical uppercase ticket numbers", () => {
    expect(isValidIncidentTicketNo("INC-2026-0001")).toBe(true);
    expect(isValidIncidentTicketNo("INC-2026-123456")).toBe(true);
    expect(isValidIncidentTicketNo("inc-2026-0001")).toBe(false);
    expect(isValidIncidentTicketNo("#INC-2026-0001")).toBe(false);
    expect(isValidIncidentTicketNo("INC-2026-001")).toBe(false);
  });
});

describe("incidentTrackingPath", () => {
  it("builds the tracking route for a ticket number", () => {
    expect(incidentTrackingPath("INC-2026-0002")).toBe(
      "/status/incidents/INC-2026-0002",
    );
    expect(incidentTrackingPath(" #inc-2026-0002 ")).toBe(
      "/status/incidents/INC-2026-0002",
    );
  });

  it("throws on invalid ticket numbers", () => {
    expect(() => incidentTrackingPath("../etc")).toThrow();
  });
});

describe("formatIncidentDuration", () => {
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;
  const start = Date.UTC(2026, 10, 1, 10, 0, 0);

  it("formats sub-minute, minute, hour, and day durations", () => {
    expect(formatIncidentDuration(start, start + 25_000)).toBe("< 1 min");
    expect(formatIncidentDuration(start, start + 45 * MIN)).toBe("45 min");
    expect(formatIncidentDuration(start, start + HOUR + 20 * MIN)).toBe(
      "1h 20m",
    );
    expect(formatIncidentDuration(start, start + 2 * DAY + 4 * HOUR)).toBe(
      "2d 4h",
    );
  });

  it("uses now when resolvedAt is null", () => {
    expect(formatIncidentDuration(start, null, start + 45 * MIN)).toBe(
      "45 min",
    );
    expect(formatIncidentDuration(start, null, start - 5_000)).toBe("< 1 min");
  });
});
