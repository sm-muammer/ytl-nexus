import "server-only";
import { DEMO_MAIL_HOST, demoMailAccounts } from "@/lib/fixtures/mail";
import {
  IMAP_PORT,
  SUBMISSION_PORT,
  type MailAccount,
  type MailClientSettings,
} from "@/lib/mail/types";
import type { DataSource } from "@/lib/server/adapters/types";
import { getMode } from "@/lib/server/mode";
import { getMailDb } from "@/lib/server/mail-db";
import { probeMail, type MailProbe } from "@/lib/server/mail-probe";

// The readers behind Nexus Mail. `/mail` uses `readMailStatus` and
// `readOwnMailbox`, which takes the session's user id and nothing else, so a
// Member can only ever read their own mailbox. Control uses
// `readAllMailboxes`, behind the Administrator guard (MAIL-10). No reader
// selects the password column.

export type MailStatusView = {
  source: DataSource;
  state: "ok" | "warn" | "bad";
  label: string;
  detail: string;
  settings: MailClientSettings;
};

export type OwnMailboxView =
  | { state: "ready"; source: DataSource; account: MailAccount }
  | { state: "no-mailbox"; source: DataSource }
  | { state: "unavailable"; source: DataSource };

export type AllMailboxesView =
  | { state: "ready"; source: DataSource; accounts: MailAccount[] }
  | { state: "unavailable"; source: DataSource };

/** The host name users type into their mail program. */
export function mailHost(
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.NEXUS_MAIL_HOST) return env.NEXUS_MAIL_HOST;
  try {
    if (env.BETTER_AUTH_URL) return new URL(env.BETTER_AUTH_URL).hostname;
  } catch {
    // fall through to the project name
  }
  return "ytl-nexus.ytlcomms.my";
}

export function clientSettings(host: string): MailClientSettings {
  return {
    host,
    imapPort: IMAP_PORT,
    smtpPort: SUBMISSION_PORT,
    imapSecurity: "SSL/TLS",
    smtpSecurity: "STARTTLS",
  };
}

/** How the two probes read as one state. Pure, so it is tested without sockets. */
export function judgeProbe(probe: MailProbe): {
  state: MailStatusView["state"];
  label: string;
  detail: string;
} {
  if (probe.imap && probe.submission) {
    return {
      state: "ok",
      label: "Healthy",
      detail:
        "IMAP (993) and mail submission (587) are answering and require TLS.",
    };
  }
  if (!probe.imap && !probe.submission) {
    return {
      state: "bad",
      label: "Unreachable",
      detail: "Neither IMAP (993) nor mail submission (587) answers.",
    };
  }
  return {
    state: "warn",
    label: "Degraded",
    detail: probe.imap
      ? "IMAP answers, but mail submission (587) does not. Reading works; sending does not."
      : "Mail submission answers, but IMAP (993) does not. Sending works; reading does not.",
  };
}

export async function readMailStatus(): Promise<MailStatusView> {
  if (getMode() === "demo") {
    return {
      source: "demo",
      state: "ok",
      label: "Healthy",
      detail: "Sample mail service status served from fixtures.",
      settings: clientSettings(DEMO_MAIL_HOST),
    };
  }
  const probe = await probeMail();
  return {
    source: "live",
    settings: clientSettings(mailHost()),
    ...judgeProbe(probe),
  };
}

const ACCOUNT_COLUMNS = [
  "email",
  "local_part",
  "enabled",
  "quota_bytes",
  "nexus_user_id",
  "created_at",
] as const;

type AccountRow = {
  email: string;
  local_part: string;
  enabled: number | boolean;
  quota_bytes: number | string;
  nexus_user_id: string | null;
  created_at: Date | string | null;
};

function toAccount(row: AccountRow): MailAccount {
  const created =
    row.created_at instanceof Date
      ? row.created_at.toISOString()
      : row.created_at
        ? String(row.created_at)
        : null;
  return {
    address: row.email,
    localPart: row.local_part,
    enabled: Boolean(row.enabled),
    quotaBytes: Number(row.quota_bytes),
    nexusUserId: row.nexus_user_id ?? null,
    createdAt: created,
  };
}

export async function readOwnMailbox(userId: string): Promise<OwnMailboxView> {
  if (getMode() === "demo") {
    const account = demoMailAccounts.find((a) => a.nexusUserId === userId);
    return account
      ? { state: "ready", source: "demo", account }
      : { state: "no-mailbox", source: "demo" };
  }
  const db = getMailDb();
  if (!db) return { state: "unavailable", source: "live" };
  try {
    const row = await db
      .selectFrom("virtual_users")
      .select([...ACCOUNT_COLUMNS])
      .where("nexus_user_id", "=", userId)
      .executeTakeFirst();
    return row
      ? { state: "ready", source: "live", account: toAccount(row) }
      : { state: "no-mailbox", source: "live" };
  } catch {
    return { state: "unavailable", source: "live" };
  }
}

export async function readAllMailboxes(): Promise<AllMailboxesView> {
  if (getMode() === "demo") {
    return { state: "ready", source: "demo", accounts: demoMailAccounts };
  }
  const db = getMailDb();
  if (!db) return { state: "unavailable", source: "live" };
  try {
    const rows = await db
      .selectFrom("virtual_users")
      .select([...ACCOUNT_COLUMNS])
      .orderBy("email")
      .execute();
    return { state: "ready", source: "live", accounts: rows.map(toAccount) };
  } catch {
    return { state: "unavailable", source: "live" };
  }
}
