// What the operations agent may touch. Pure constants with no imports, so the
// agent, the web client, the worker and the Operator UI all read one list.
// The lists live in code on purpose: a request cannot extend them (OPS-04).

/** Units that may be restarted or whose log may be read. Exact, case-sensitive. */
export const OPS_UNITS = [
  "nexus-web",
  "nexus-worker",
  "sftpgo",
  "prometheus",
] as const;
export type OpsUnit = (typeof OPS_UNITS)[number];

/** Predefined health checks the agent can run (HTTP, database, Prometheus, Ollama, SFTPGo, mail ports). */
export const HEALTH_CHECK_IDS = [
  "web",
  "database",
  "prometheus",
  "ollama",
  "sftpgo",
  "mail",
] as const;
export type HealthCheckId = (typeof HEALTH_CHECK_IDS)[number];

export const HEALTH_CHECK_LABEL: Record<HealthCheckId, string> = {
  web: "Nexus web (HTTP)",
  database: "MariaDB (port)",
  prometheus: "Prometheus (HTTP)",
  ollama: "Ollama (HTTP)",
  sftpgo: "SFTPGo (port)",
  mail: "Mail (SMTP port)",
};

export const OPS_UNIT_LABEL: Record<OpsUnit, string> = {
  "nexus-web": "Nexus web",
  "nexus-worker": "Nexus worker",
  sftpgo: "SFTPGo",
  prometheus: "Prometheus",
};

export const MIN_LOG_LINES = 1;
export const MAX_LOG_LINES = 500;
