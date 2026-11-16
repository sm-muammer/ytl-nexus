import type { MailAccount, MailClientSettings } from "@/lib/mail/types";
import { MAIL_DOMAIN } from "@/lib/mail/types";

// Sample mailboxes for Demo_Mode (MAIL-09). Invented: the names refer to
// nothing real. The demo "member" and "operator" sessions are shown the
// mailbox linked to their demo user id as "yours" on /mail (see
// lib/fixtures/session.ts for the ids).

const MIB = 1024 * 1024;

export const demoMailAccounts: MailAccount[] = [
  {
    address: `demo-member@${MAIL_DOMAIN}`,
    localPart: "demo-member",
    enabled: true,
    quotaBytes: 512 * MIB,
    nexusUserId: "demo-member",
    createdAt: "2026-10-20T03:00:00.000Z",
  },
  {
    address: `demo-operator@${MAIL_DOMAIN}`,
    localPart: "demo-operator",
    enabled: true,
    quotaBytes: 1024 * MIB,
    nexusUserId: "demo-operator",
    createdAt: "2026-10-20T03:05:00.000Z",
  },
  {
    address: `svc-alerts@${MAIL_DOMAIN}`,
    localPart: "svc-alerts",
    enabled: true,
    quotaBytes: 256 * MIB,
    nexusUserId: null,
    createdAt: "2026-10-20T03:10:00.000Z",
  },
  {
    address: `demo-disabled@${MAIL_DOMAIN}`,
    localPart: "demo-disabled",
    enabled: false,
    quotaBytes: 512 * MIB,
    nexusUserId: null,
    createdAt: "2026-10-22T03:00:00.000Z",
  },
];

export const DEMO_MAIL_HOST = "ytl-nexus.example";

export const demoMailClientSettings: MailClientSettings = {
  host: DEMO_MAIL_HOST,
  imapPort: 993,
  smtpPort: 587,
  imapSecurity: "SSL/TLS",
  smtpSecurity: "STARTTLS",
};
