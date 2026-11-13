// Shapes shared by the server and the pages for Nexus Mail. Plain data only —
// no password, no hash, no raw DB row leaves this module.

export type MailAccount = {
  /** The full mailbox address, e.g. user@ytl-nexus.internal */
  address: string;
  /** The local part only, used as a display name. */
  username: string;
  enabled: boolean;
  /**
   * Quota in bytes. 0 means unlimited. Dovecot quota is per-user and tracked by
   * the quota plugin (not by counting Maildir files).
   */
  quotaBytes: number;
  /** Bytes used as reported by Dovecot quota; null when quota is unlimited or unread. */
  usedBytes: number | null;
  /** The Nexus user this mailbox belongs to, or null for a service account. */
  nexusUserId: string | null;
  createdAt: string | null;
};

export type MailDomain = "ytl-nexus.internal";
export const MAIL_DOMAIN: MailDomain = "ytl-nexus.internal";

/** Ports and TLS settings shown on the /mail entry page. */
export type MailClientSettings = {
  host: string;
  imapPort: number;
  smtpPort: number;
  imapSecurity: "SSL/TLS";
  smtpSecurity: "STARTTLS";
};
