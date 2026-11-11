import type { ProbeTarget } from "../ops/probes.ts";

// The predefined service checks the worker runs every 60 seconds (STA-01), keyed
// by the `services.slug` of the seed. Every target is a fixed loopback address.
//
// A service that is not installed yet (Dovecot, Roundcube) or has no
// port to probe (PHP-FPM, chrony) has no entry on purpose. It then reads
// "Unknown", which is honest; a "down" for something never installed would be
// noise. Add an entry when the module that installs the service ships.
export const SERVICE_PROBES: Readonly<Record<string, ProbeTarget>> = {
  apache: { kind: "tcp", host: "127.0.0.1", port: 443 },
  "nexus-web": { kind: "http", url: "http://127.0.0.1:3000/api/health/live" },
  mariadb: { kind: "tcp", host: "127.0.0.1", port: 3306 },
  wordpress: { kind: "tcp", host: "127.0.0.1", port: 8081 },
  postfix: { kind: "tcp", host: "127.0.0.1", port: 25 },
  ollama: { kind: "http", url: "http://127.0.0.1:11434/api/version" },
  prometheus: { kind: "http", url: "http://127.0.0.1:9090/-/healthy" },
  // The SFTP listener itself (Task 12); the admin port is only for the agent's check.
  sftpgo: { kind: "tcp", host: "127.0.0.1", port: 2022 },
  "node-exporter": { kind: "tcp", host: "127.0.0.1", port: 9100 },
};

export const CHECK_INTERVAL_MS = 60_000;
/** Rows older than this are deleted; the longest uptime window is 30 days. */
export const RETENTION_DAYS = 35;
