export type DemoAiSource = {
  id: number;
  source: string;
  title: string;
  url?: string;
};

export type DemoAiQA = {
  matchKeywords: string[];
  response: string;
  sources: DemoAiSource[];
};

export const DEMO_AI_KNOWLEDGE_BASE: DemoAiQA[] = [
  {
    matchKeywords: ["deploy", "rollback", "release", "how to deploy"],
    response:
      "To deploy YTL Nexus, `infrastructure/scripts/deploy.sh` creates a timestamped release in `/opt/ytl-nexus/releases/<sha>`, builds the application with `npm run build`, executes pending migrations via `scripts/db/migrate.ts up`, swaps the `current` symlink, restarts `nexus-web`, and runs a health smoke-test against `/api/health/live`. If the health check fails, rollback is automatic.",
    sources: [
      {
        id: 101,
        source: "runbook:deploy.md",
        title: "Platform Deployment & Release Workflow",
        url: "/library/deployment-workflow",
      },
      {
        id: 102,
        source: "runbook:rollback.md",
        title: "Automated & Manual Rollback Procedure",
      },
    ],
  },
  {
    matchKeywords: ["database", "mariadb", "mysql", "migration"],
    response:
      "Nexus Core 01 runs MariaDB 10.5 on 127.0.0.1:3306. Five isolated databases are maintained: `ytl_nexus` (platform), `nexus_wordpress` (Studio), `nexus_roundcube` (Webmail), `nexus_sftpgo` (Transfer), and `nexus_mail` (Virtual mail domain). Migrations use Kysely with raw SQL up/down files.",
    sources: [
      {
        id: 103,
        source: "runbook:database.md",
        title: "Database Topology and Maintenance",
      },
    ],
  },
  {
    matchKeywords: ["atlas", "service", "explain", "topology", "architecture"],
    response:
      "Nexus Atlas maps all core systemd services and host components (nexus-web, nexus-worker, nexus-ops, mariadb, postfix, dovecot, roundcube, sftpgo, prometheus, ollama). Health probes are evaluated every 60 seconds by `nexus-worker`, and allowlisted operational controls (health, logs, restart) are routed via the HMAC-signed operations agent.",
    sources: [
      {
        id: 104,
        source: "runbook:atlas.md",
        title: "Atlas Inventory and Service Map",
      },
      {
        id: 105,
        source: "runbook:ops-and-status.md",
        title: "Operations Agent & Probing Protocol",
      },
    ],
  },
  {
    matchKeywords: ["yes", "5g", "plans", "coverage"],
    response:
      "Yes 5G provides high-speed uncapped mobile and broadband connectivity powered by Malaysia's national 5G DNB infrastructure, offering infinite data plans, FTTH home fiber, and eSIM activation.",
    sources: [
      {
        id: 106,
        source: "wp:product:yes-5g-overview",
        title: "Yes 5G Platform Services Overview",
        url: "/yes",
      },
    ],
  },
];

export const DEMO_AI_DEFAULT_RESPONSE = {
  response:
    "I am Nexus AI, running locally on Nexus Core 01. I answer questions regarding platform runbooks, deployment guides, Atlas services, and verified Yes documentation. Feel free to ask about deployment procedures, services status, or architecture guidelines.",
  sources: [
    {
      id: 100,
      source: "runbook:server-baseline.md",
      title: "Nexus Core 01 Baseline Specification",
    },
  ],
};
