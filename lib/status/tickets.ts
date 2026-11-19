// Pure helpers for auto-generated incident ticket numbers (`INC-YYYY-NNNN`)
// and duration display. Client-safe and importable directly by Node scripts/migrations.

export const INCIDENT_TICKET_PATTERN = /^INC-\d{4}-\d{4,10}$/;

/**
 * Formats an incident ticket number from its opening timestamp (UTC year) and
 * monotonic integer sequence (padded to at least 4 digits, scaling cleanly
 * beyond 9,999).
 */
export function formatIncidentTicketNo(
  openedAt: Date | number,
  sequence: number,
): string {
  if (!Number.isSafeInteger(sequence) || sequence <= 0) {
    throw new Error(
      `Incident sequence must be a positive integer: ${sequence}`,
    );
  }
  const ms = openedAt instanceof Date ? openedAt.getTime() : openedAt;
  if (!Number.isFinite(ms)) {
    throw new Error("Incident opening time must be a valid date.");
  }
  const year = new Date(ms).getUTCFullYear();
  return `INC-${year}-${String(sequence).padStart(4, "0")}`;
}

/** True only for a canonical uppercase incident ticket number. */
export function isValidIncidentTicketNo(value: string): boolean {
  return INCIDENT_TICKET_PATTERN.test(value);
}

/**
 * Trims whitespace, strips an optional leading `#`, uppercases, and returns
 * the canonical ticket number — or `null` if invalid.
 */
export function normalizeIncidentTicketNo(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw.trim().replace(/^#/, "").toUpperCase();
  return isValidIncidentTicketNo(cleaned) ? cleaned : null;
}

/** Builds the tracking route path for a valid incident ticket number. */
export function incidentTrackingPath(ticketNo: string): string {
  const normalized = normalizeIncidentTicketNo(ticketNo);
  if (!normalized) {
    throw new Error(`Invalid incident ticket number: ${ticketNo}`);
  }
  return `/status/incidents/${normalized}`;
}

/** Formats elapsed time between `openedAt` and `resolvedAt` (or `now`). */
export function formatIncidentDuration(
  openedAt: number,
  resolvedAt: number | null,
  now: number = Date.now(),
): string {
  const end = resolvedAt ?? now;
  const elapsedMs = Math.max(0, end - openedAt);
  const totalMinutes = Math.floor(elapsedMs / 60_000);
  if (totalMinutes < 1) return "< 1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const totalHours = Math.floor(totalMinutes / 60);
  const remMinutes = totalMinutes % 60;
  if (totalHours < 24) {
    return remMinutes === 0
      ? `${totalHours}h`
      : `${totalHours}h ${remMinutes}m`;
  }
  const days = Math.floor(totalHours / 24);
  const remHours = totalHours % 24;
  return remHours === 0 ? `${days}d` : `${days}d ${remHours}h`;
}
