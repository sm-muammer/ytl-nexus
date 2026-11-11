import type { Health } from "./health.ts";

// Plain formatting for Status pages. Times are shown in UTC with the zone named,
// so the server render and the browser agree and nobody has to guess.

export function formatTime(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** Maps a service health to the badge vocabulary of Nexus Command. */
export function badgeHealth(
  health: Health,
): "ok" | "warn" | "bad" | "idle" | "stale" {
  switch (health) {
    case "healthy":
      return "ok";
    case "degraded":
      return "warn";
    case "down":
      return "bad";
    case "stale":
      return "stale";
    case "unknown":
      return "idle";
  }
}
