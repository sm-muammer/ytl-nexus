import type { ContentItem, ContentType } from "../content/types.ts";

// Demo content and the seed for WordPress (Task 7). Same shape as live items.
// `infrastructure/wordpress/seed-content.json` is generated from this list by
// `npm run content:seed-json`. No company claim here needs a source: the text
// describes this internship project only.

const MODIFIED = "2026-11-09T09:00:00.000Z";

let nextId = 1;
function item(
  type: ContentType,
  slug: string,
  title: string,
  audience: ContentItem["audience"],
  body: string,
  extra: Partial<ContentItem> = {},
): ContentItem {
  return {
    id: nextId++,
    type,
    slug,
    title,
    excerpt: body.replace(/<[^>]+>/g, "").slice(0, 140),
    html: body,
    audience,
    businessUnit: null,
    relatedService: null,
    sourceUrl: null,
    order: nextId,
    modified: MODIFIED,
    ...extra,
  };
}

export const contentFixtures: readonly ContentItem[] = [
  item(
    "runbook",
    "platform-overview",
    "Platform overview",
    "public",
    "<p>YTL Nexus is one web platform plus a handful of host services (WordPress, mail, file transfer, monitoring and a local AI model) running on one server, Nexus Core 01. Each part has its own page, called a module.</p><p>This is an internship project, not an official YTL commercial product.</p>",
  ),
  item(
    "runbook",
    "check-the-platform-is-healthy",
    "Check that the platform is healthy",
    "public",
    "<p>Open Nexus Status. A green badge means the last check passed. If a service shows amber or red, note its name and the time, then tell the operations team.</p>",
    { relatedService: "nexus-web" },
  ),
  item(
    "runbook",
    "restart-the-web-application",
    "Restart the web application",
    "internal",
    "<p>Use Nexus Control, never a shell, for routine restarts.</p><ol><li>Sign in as an Operator and open Nexus Control.</li><li>Choose <strong>nexus-web</strong> and confirm the restart.</li><li>Wait one minute and check Nexus Status.</li></ol><p>If the status stays red, roll back with the steps in the rollback runbook.</p>",
    { relatedService: "nexus-web" },
  ),
  item(
    "runbook",
    "roll-back-a-release",
    "Roll back a release",
    "internal",
    "<p>A rollback swaps the <code>current</code> and <code>previous</code> release folders and restarts the web application.</p><ol><li>Ask an Administrator to run the rollback script on the server.</li><li>Check <code>/api/health/ready</code> returns ready.</li><li>Write down why you rolled back.</li></ol>",
    { relatedService: "nexus-web" },
  ),
  item(
    "faq",
    "what-is-ytl-nexus",
    "What is YTL Nexus?",
    "public",
    "<p>A single platform that shows how infrastructure, content, mail, file transfer and monitoring can work together on one server. It was built during an internship.</p>",
  ),
  item(
    "faq",
    "why-do-i-see-demo-data",
    "Why do some figures say Demo?",
    "public",
    "<p>Every figure is labelled Live or Demo. Demo means a built-in sample, shown when the real service is not connected.</p>",
  ),
  item(
    "faq",
    "who-can-read-internal-notes",
    "Who can read internal notes?",
    "internal",
    "<p>Signed-in Viewers and above. Public visitors never receive internal items, not even through the API.</p>",
  ),
  item(
    "story_chapter",
    "the-starting-point",
    "The starting point",
    "public",
    "<p>The project began with an older set of drafts and an empty server. The drafts were read for ideas only. Everything in the platform was built again from a plan.</p>",
  ),
  item(
    "story_chapter",
    "security-from-the-start",
    "Security from the start",
    "public",
    "<p>Every protected page checks who is asking on the server. A hidden address is never the protection.</p>",
  ),
  item(
    "announcement",
    "planned-maintenance-example",
    "Planned maintenance (example)",
    "public",
    "<p>This is a sample notice. Real notices written in Nexus Studio appear here and in Nexus Status.</p>",
  ),
  item(
    "tour_step",
    "tour-welcome",
    "Welcome",
    "public",
    "<p>This tour walks through each module using sample data only.</p>",
  ),
  item(
    "mail_help",
    "signing-in-to-webmail",
    "Signing in to webmail",
    "internal",
    "<p>Use the <strong>Open Roundcube Webmail</strong> button on this page or go directly to <code>/webmail/</code>. Sign in with your full mailbox address (e.g. <code>username@ytl-nexus.internal</code>) and your mailbox password.</p><p>Webmail credentials are separate from your Nexus platform password. If you forgot your mailbox password, an Administrator can reset it in Nexus Control.</p>",
  ),
  item(
    "mail_help",
    "configuring-your-email-client",
    "Configuring your email client",
    "internal",
    "<p>You can connect desktop and mobile mail clients (such as Thunderbird, Apple Mail or Outlook) using standard IMAP and SMTP submission.</p><ul><li><strong>Incoming (IMAP):</strong> port 993, SSL/TLS required.</li><li><strong>Outgoing (SMTP):</strong> port 587, STARTTLS required.</li><li><strong>Username:</strong> your full email address (<code>username@ytl-nexus.internal</code>).</li><li><strong>Authentication:</strong> Normal password.</li></ul><p>Nexus uses certificates from the YTL Nexus internal CA. Make sure the CA certificate is installed on your client device.</p>",
  ),
];
