import type { AtlasEdge } from "../atlas/graph.ts";
import type { AtlasAuditEntry, ServiceKind } from "../atlas/types.ts";

// Deterministic Atlas fixtures for Demo_Mode. The edges and kinds mirror the
// seed inventory in lib/server/db/seed/data.ts (a unit test keeps them equal).
// Slugs match lib/fixtures/status.ts. Generic names only.

export const DEMO_KINDS: Readonly<Record<string, ServiceKind>> = {
  apache: "proxy",
  "nexus-web": "web",
  mariadb: "database",
  "php-fpm": "web",
  wordpress: "web",
  roundcube: "mail",
  postfix: "mail",
  dovecot: "mail",
  sftpgo: "storage",
  ollama: "ai",
  prometheus: "monitoring",
  "node-exporter": "monitoring",
  chronyd: "system",
};

/** [service, depends on] */
export const DEMO_EDGES: readonly AtlasEdge[] = [
  { from: "apache", to: "nexus-web" },
  { from: "apache", to: "php-fpm" },
  { from: "nexus-web", to: "mariadb" },
  { from: "nexus-web", to: "prometheus" },
  { from: "php-fpm", to: "mariadb" },
  { from: "wordpress", to: "php-fpm" },
  { from: "wordpress", to: "mariadb" },
  { from: "roundcube", to: "php-fpm" },
  { from: "roundcube", to: "dovecot" },
  { from: "roundcube", to: "mariadb" },
  { from: "postfix", to: "dovecot" },
  { from: "dovecot", to: "mariadb" },
  { from: "sftpgo", to: "mariadb" },
  { from: "ollama", to: "node-exporter" },
  { from: "prometheus", to: "node-exporter" },
];

export function demoAudit(now: number): Record<string, AtlasAuditEntry[]> {
  const HOUR = 3_600_000;
  return {
    "nexus-web": [
      {
        ts: now - 3 * HOUR,
        action: "ops.health",
        result: "success",
        role: "operator",
      },
      {
        ts: now - 26 * HOUR,
        action: "ops.restart",
        result: "success",
        role: "operator",
      },
    ],
    mariadb: [
      {
        ts: now - 9 * 24 * HOUR,
        action: "ops.health",
        result: "success",
        role: "admin",
      },
    ],
  };
}
