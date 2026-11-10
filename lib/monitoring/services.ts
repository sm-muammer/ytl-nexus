// The services Nexus Command tracks. One particle cluster per entry. The list
// mirrors the units in the seed data (lib/server/db/seed/data.ts); services
// without a systemd unit of their own (WordPress, Roundcube) are covered by
// the unit they run under. Pure data, client-safe.

export type TrackedService = {
  id: string;
  name: string;
  /** systemd unit name as node_exporter reports it. */
  unit: string;
  /** Runbook in Nexus Library (Task 7 seeds these slugs). */
  runbook: string | null;
};

export const TRACKED_SERVICES: readonly TrackedService[] = [
  { id: "apache", name: "Apache", unit: "httpd.service", runbook: null },
  {
    id: "nexus-web",
    name: "Nexus Web",
    unit: "nexus-web.service",
    runbook: null,
  },
  { id: "mariadb", name: "MariaDB", unit: "mariadb.service", runbook: null },
  { id: "php-fpm", name: "PHP-FPM", unit: "php-fpm.service", runbook: null },
  { id: "postfix", name: "Postfix", unit: "postfix.service", runbook: null },
  { id: "dovecot", name: "Dovecot", unit: "dovecot.service", runbook: null },
  { id: "sftpgo", name: "SFTPGo", unit: "sftpgo.service", runbook: null },
  { id: "ollama", name: "Ollama", unit: "ollama.service", runbook: null },
  {
    id: "prometheus",
    name: "Prometheus",
    unit: "prometheus.service",
    runbook: null,
  },
  {
    id: "node-exporter",
    name: "node_exporter",
    unit: "node_exporter.service",
    runbook: null,
  },
  { id: "chronyd", name: "chrony", unit: "chronyd.service", runbook: null },
] as const;

export const TRACKED_UNITS: readonly string[] = TRACKED_SERVICES.map(
  (s) => s.unit,
);
