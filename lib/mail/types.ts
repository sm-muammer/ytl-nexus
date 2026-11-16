// Shapes shared by the server and the pages for Nexus Mail. Plain data only:
// no password, no hash and no raw database row leaves lib/server.

export type MailDomain = "ytl-nexus.internal";
export const MAIL_DOMAIN: MailDomain = "ytl-nexus.internal";

export type MailAccount = {
  /** The full mailbox address, e.g. amira@ytl-nexus.internal. It is also the IMAP and SMTP user name. */
  address: string;
  /** The part before the @. */
  localPart: string;
  enabled: boolean;
  /** Storage limit in bytes (Dovecot quota rule). Always above zero. */
  quotaBytes: number;
  /** The Nexus user this mailbox belongs to, or null for a service address. */
  nexusUserId: string | null;
  createdAt: string | null;
};

/** What a mail program needs. The user name is the full address; the password is the mailbox password. */
export type MailClientSettings = {
  host: string;
  imapPort: number;
  smtpPort: number;
  imapSecurity: "SSL/TLS";
  smtpSecurity: "STARTTLS";
};

export const IMAP_PORT = 993;
export const SUBMISSION_PORT = 587;
/** Where the webmail lives. Served by Apache and PHP-FPM, never by Next.js. */
export const WEBMAIL_PATH = "/webmail/";
