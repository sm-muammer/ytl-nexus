import { ModuleHero } from "@/components/layout/module-hero";
import { PageTransition } from "@/components/motion/page-transition";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { StatusBadge } from "@/components/ui/status-badge";
import { pageInfo } from "@/lib/navigation/modules";
import { formatBytes } from "@/lib/transfer/format";
import { WEBMAIL_PATH, type MailClientSettings } from "@/lib/mail/types";
import type { MailStatusView, OwnMailboxView } from "@/lib/server/mail";
import type { ContentItem } from "@/lib/content/types";

function SettingsList({ settings }: { settings: MailClientSettings }) {
  return (
    <dl
      data-mail-settings
      className="text-data mt-3 grid max-w-2xl grid-cols-[auto_minmax(0,1fr)] gap-x-8 gap-y-3"
    >
      <dt className="text-muted">Host</dt>
      <dd className="font-mono break-all">{settings.host}</dd>
      <dt className="text-muted">Incoming (IMAP)</dt>
      <dd>
        <span className="font-mono">Port {settings.imapPort}</span>
        <span className="text-muted ml-2">· {settings.imapSecurity}</span>
      </dd>
      <dt className="text-muted">Outgoing (SMTP)</dt>
      <dd>
        <span className="font-mono">Port {settings.smtpPort}</span>
        <span className="text-muted ml-2">· {settings.smtpSecurity}</span>
      </dd>
      <dt className="text-muted">Username</dt>
      <dd className="text-muted">
        Your full email address (e.g.{" "}
        <span className="text-ink font-mono">username@ytl-nexus.internal</span>)
      </dd>
    </dl>
  );
}

export function MailView({
  status,
  ownMailbox,
  helpItems,
  demoSession,
}: {
  status: MailStatusView;
  ownMailbox: OwnMailboxView;
  helpItems: readonly ContentItem[];
  demoSession: boolean;
}) {
  const page = pageInfo("/mail");

  return (
    <PageTransition>
      <div>
        <ModuleHero page={page} register="workspace" />
        <div className="flex flex-col gap-10 px-(--spacing-gutter) py-8">
          <div className="flex flex-wrap items-center gap-3">
            <LiveDemoLabel source={status.source} />
            {demoSession ? (
              <span className="text-muted text-data">
                Demo session: mailboxes and service status are samples.
              </span>
            ) : null}
          </div>

          {/* Service status */}
          <section aria-labelledby="status-title" data-mail-status>
            <h2 id="status-title" className="text-heading-3 font-semibold">
              Service status
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <StatusBadge status={status.state} label={status.label} />
              <span className="text-muted text-data">{status.detail}</span>
            </div>
          </section>

          {/* Webmail portal link */}
          <section aria-labelledby="webmail-title" data-mail-webmail>
            <h2 id="webmail-title" className="text-heading-3 font-semibold">
              Webmail
            </h2>
            <p className="text-muted mt-2 max-w-(--spacing-prose)">
              Access your internal inbox in the browser with Roundcube. Sign in
              with your full mailbox address and mailbox password.
            </p>
            <div className="mt-4">
              <a
                href={WEBMAIL_PATH}
                className="bg-accent-ink text-canvas inline-flex min-h-11 items-center rounded-full px-6 text-sm font-semibold hover:opacity-90"
              >
                Open Roundcube Webmail
              </a>
            </div>
          </section>

          {/* User's own mailbox */}
          <section aria-labelledby="mailbox-title" data-mail-mailbox>
            <h2 id="mailbox-title" className="text-heading-3 font-semibold">
              Your mailbox
            </h2>
            {ownMailbox.state === "ready" ? (
              <dl className="text-data mt-3 grid max-w-2xl grid-cols-[auto_minmax(0,1fr)] gap-x-8 gap-y-3">
                <dt className="text-muted">Address</dt>
                <dd className="font-mono font-medium break-all">
                  {ownMailbox.account.address}
                </dd>
                <dt className="text-muted">Status</dt>
                <dd>
                  {ownMailbox.account.enabled
                    ? "Active"
                    : "Disabled. Ask an Administrator to re-enable it."}
                </dd>
                <dt className="text-muted">Storage limit</dt>
                <dd>
                  {ownMailbox.account.quotaBytes > 0
                    ? formatBytes(ownMailbox.account.quotaBytes)
                    : "Unlimited"}
                </dd>
              </dl>
            ) : ownMailbox.state === "no-mailbox" ? (
              <div
                className="border-border-strong mt-3 max-w-(--spacing-prose) border-l-2 pl-6"
                data-mail-state="no-mailbox"
              >
                <p className="text-muted">
                  You do not have a mailbox linked to your Nexus account yet.
                  Ask an Administrator to create one for you in Nexus Control.
                </p>
              </div>
            ) : (
              <p className="text-muted mt-3" data-mail-state="unavailable">
                The mailbox database could not be reached. Try again in a
                moment.
              </p>
            )}
          </section>

          {/* Client connection settings */}
          <section aria-labelledby="settings-title">
            <h2 id="settings-title" className="text-heading-3 font-semibold">
              Client configuration
            </h2>
            <p className="text-muted mt-2 max-w-(--spacing-prose)">
              Connect desktop or mobile mail applications (such as Apple Mail,
              Thunderbird or Outlook) using these settings.
            </p>
            <SettingsList settings={status.settings} />
          </section>

          {/* Help articles */}
          {helpItems.length > 0 ? (
            <section aria-labelledby="help-title" data-mail-help>
              <h2 id="help-title" className="text-heading-3 font-semibold">
                Setup and guides
              </h2>
              <div className="divide-line border-line mt-4 divide-y border-y">
                {helpItems.map((item, index) => (
                  <details
                    key={item.slug}
                    open={index === 0}
                    className="group py-3"
                  >
                    <summary className="flex min-h-11 cursor-pointer items-center justify-between font-medium">
                      <span>{item.title}</span>
                    </summary>
                    <div
                      dangerouslySetInnerHTML={{ __html: item.html }}
                      className="text-muted [&_code]:text-ink mt-2 flex max-w-(--spacing-prose) flex-col gap-3 text-sm [&_code]:font-mono [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                    />
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
