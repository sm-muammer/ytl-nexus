import "server-only";
import { demoMailAccounts, demoMailClientSettings } from "@/lib/fixtures/mail";
import type { MailAccount, MailClientSettings } from "@/lib/mail/types";
import { MAIL_DOMAIN } from "@/lib/mail/types";
import type { DataSource } from "@/lib/server/adapters/types";
import { getMode } from "@/lib/server/mode";
import { createMailDb, readMailDbConfig } from "@/lib/server/mail-db";

// The two readers behind Nexus Mail. /mail uses `readMailStatus` to show the
// service status and client settings. Control uses `readAllMailboxes`, behind
// the Administrator guard (requirement MAIL-10).

export type MailStatusView = {
  source: DataSource;
  state: "ok" | "warn" | "bad";
  label: string;
  detail: string;
  settings: MailClientSettings;
};

export type AllMailboxesView =
  | { state: "ready"; source: DataSource; accounts: MailAccount[] }
  | { state: "unavailable"; source: DataSource };

/** Derives the external hostname from the environment. */
function mailHost(
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.NEXUS_MAIL_HOST) return env.NEXUS_MAIL_HOST;
  try {
    if (env.BETTER_AUTH_URL) return new URL(env.BETTER_AUTH_URL).hostname;
  } catch {
    // fall through
  }
  return "ytl-nexus.ytlcomms.my";
}

function liveSettings(
  env: Record<string, string | undefined> = process.env,
): MailClientSettings {
  return {
    host: mailHost(env),
    imapPort: 993,
    smtpPort: 587,
    imapSecurity: "SSL/TLS",
    smtpSecurity: "STARTTLS",
  };
}

/** Minimal IMAP health check: connects and reads CAPABILITY. */
async function checkImap(host: string, port: number): Promise<boolean> {
  // We use a plain Node.js net/tls socket rather than any third-party library so
  // the demo adapter import chain stays clean (DEMO-04). In live mode this is
  // called only inside readMailStatus, which is never imported in demo mode.
  const { connect } = await import("node:tls");
  return new Promise((resolve) => {
    const sock = connect(
      { host, port, rejectUnauthorized: false, timeout: 4000 },
      () => {
        sock.once("data", () => {
          sock.destroy();
          resolve(true);
        });
      },
    );
    sock.on("error", () => resolve(false));
    sock.on("timeout", () => {
      sock.destroy();
      resolve(false);
    });
  });
}

export async function readMailStatus(): Promise<MailStatusView> {
  const demo = getMode() === "demo";
  const settings = demo ? demoMailClientSettings : liveSettings();

  if (demo) {
    return {
      source: "demo",
      state: "ok",
      label: "Healthy",
      detail: "Sample mail service status served from fixtures.",
      settings,
    };
  }

  // Live: quick IMAP connectivity check on loopback.
  const imapOk = await checkImap("127.0.0.1", 993);
  return {
    source: "live",
    state: imapOk ? "ok" : "bad",
    label: imapOk ? "Healthy" : "Unreachable",
    detail: imapOk
      ? `IMAP answering on port 993. Domain: ${MAIL_DOMAIN}.`
      : "IMAP on port 993 did not answer. Check Dovecot.",
    settings,
  };
}

export async function readAllMailboxes(): Promise<AllMailboxesView> {
  if (getMode() === "demo") {
    return { state: "ready", source: "demo", accounts: demoMailAccounts };
  }

  const config = readMailDbConfig();
  if (!config) return { state: "unavailable", source: "live" };

  try {
    const db = createMailDb(config);
    const rows = await db
      .selectFrom("virtual_users as u")
      .leftJoin("virtual_domains as d", "d.id", "u.domain_id")
      .select([
        "u.id",
        "u.username",
        "d.name as domain",
        "u.enabled",
        "u.quota_bytes as quotaBytes",
        "u.used_bytes as usedBytes",
        "u.nexus_user_id as nexusUserId",
        "u.created_at as createdAt",
      ])
      .orderBy("u.username")
      .execute();

    const accounts: MailAccount[] = rows.map((r) => ({
      address: `${r.username}@${r.domain ?? MAIL_DOMAIN}`,
      username: r.username,
      enabled: Boolean(r.enabled),
      quotaBytes: Number(r.quotaBytes),
      usedBytes: r.usedBytes != null ? Number(r.usedBytes) : null,
      nexusUserId: r.nexusUserId ?? null,
      createdAt: r.createdAt ? String(r.createdAt) : null,
    }));
    return { state: "ready", source: "live", accounts };
  } catch {
    return { state: "unavailable", source: "live" };
  }
}
