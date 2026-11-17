import { ModuleHero } from "@/components/layout/module-hero";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";
import type { OwnAccountView } from "@/lib/server/transfer";
import { formatBytes, usagePercent } from "@/lib/transfer/format";
import { buildGuides, SFTP_PORT } from "@/lib/transfer/guides";
import type { TransferAccount } from "@/lib/transfer/types";

// /transfer (TRF-09): the signed-in Member's own file transfer account, the
// connection guides and the link to the browser portal. The account comes from
// the session alone; nothing on this page can be pointed at another account.
// There are no controls here: keys, quotas and passwords are managed by an
// Administrator in Nexus Control.

function formatTime(iso: string | null): string {
  return iso ? `${iso.replace("T", " ").slice(0, 16)} UTC` : "Never";
}

function Notice({
  title,
  children,
  name,
}: {
  title: string;
  children: React.ReactNode;
  name: string;
}) {
  return (
    <section
      data-transfer-state={name}
      aria-labelledby="transfer-notice"
      className="border-border-strong max-w-(--spacing-prose) border-l-2 pl-6"
    >
      <h2 id="transfer-notice" className="text-heading-3 font-semibold">
        {title}
      </h2>
      <div className="text-muted mt-2 flex flex-col gap-3">{children}</div>
    </section>
  );
}

function Quota({ account }: { account: TransferAccount }) {
  const percent = usagePercent(account.usedBytes, account.quotaBytes);
  return (
    <div data-quota>
      <p>
        {formatBytes(account.usedBytes)} used of{" "}
        {account.quotaBytes > 0
          ? formatBytes(account.quotaBytes)
          : "unlimited space"}
        {percent !== null ? ` (${percent}%)` : ""}
      </p>
      {percent !== null ? (
        <div
          role="progressbar"
          aria-label="Storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="bg-surface-raised mt-2 h-2 max-w-sm overflow-hidden rounded-full"
        >
          <div
            className={`${percent >= 90 ? "bg-bad-ink" : "bg-accent-ink"} h-full`}
            style={{ width: `${percent}%` }}
          />
        </div>
      ) : null}
      <p className="text-muted text-data mt-2">
        {account.usedFiles === 1 ? "1 file" : `${account.usedFiles} files`}. An
        upload that would pass the limit is refused and your existing files stay
        as they are.
      </p>
    </div>
  );
}

function Keys({ account }: { account: TransferAccount }) {
  return (
    <section aria-labelledby="keys-title" data-transfer-keys>
      <h2 id="keys-title" className="text-heading-3 font-semibold">
        Registered keys
      </h2>
      {account.keys.length === 0 ? (
        <p className="text-muted mt-2 max-w-(--spacing-prose)">
          No public key is registered, so you sign in with your password. To use
          a key, send the public half (the file ending in .pub) to an
          Administrator, who adds it in Nexus Control.
        </p>
      ) : (
        <>
          <ul className="divide-line border-line mt-3 divide-y border-y">
            {account.keys.map((key) => (
              <li
                key={key.fingerprint}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <span className="font-mono text-sm break-all">
                  {key.fingerprint}
                </span>
                <span className="text-muted text-data">
                  {key.type}
                  {key.comment ? ` · ${key.comment}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-muted text-data mt-2 max-w-(--spacing-prose)">
            An Administrator adds and removes keys. Up to 10 keys are allowed.
          </p>
        </>
      )}
    </section>
  );
}

function Guides({ host, username }: { host: string; username: string }) {
  const guides = buildGuides({ host, username });
  return (
    <section aria-labelledby="guides-title" data-transfer-guides>
      <h2 id="guides-title" className="text-heading-3 font-semibold">
        Connect with your own program
      </h2>
      <div className="divide-line border-line mt-3 divide-y border-y">
        {guides.map((guide, index) => (
          <details key={guide.id} data-guide={guide.id} open={index === 0}>
            <summary className="flex min-h-11 cursor-pointer items-center py-2 font-medium">
              {guide.name}
            </summary>
            <div className="pb-4">
              <ol className="text-muted list-decimal space-y-1.5 pl-5">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
              {guide.command ? (
                <pre
                  tabIndex={0}
                  aria-label="Command"
                  className="bg-surface text-data mt-3 overflow-x-auto rounded-md p-3 font-mono"
                >
                  <code>{guide.command}</code>
                </pre>
              ) : null}
              {guide.keyCommand ? (
                <pre
                  tabIndex={0}
                  aria-label="Command with a key file"
                  className="bg-surface text-data mt-2 overflow-x-auto rounded-md p-3 font-mono"
                >
                  <code>{guide.keyCommand}</code>
                </pre>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export function TransferView({
  view,
  demoSession,
}: {
  view: OwnAccountView;
  demoSession: boolean;
}) {
  const page = pageInfo("/transfer");
  return (
    <PageTransition>
      <div>
        <ModuleHero page={page} register="workspace" />
        <div className="flex flex-col gap-10 px-(--spacing-gutter) py-8">
          {demoSession ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted text-data">
                Demo session: this account is an example and nothing here
                connects to a real server.
              </span>
            </div>
          ) : null}

          {view.state === "unavailable" ? (
            <Notice
              name="unavailable"
              title="The file transfer service is not answering"
            >
              <p>
                Your account could not be read, so nothing is shown rather than
                a guess. Try again in a minute. If it stays like this, tell an
                Administrator.
              </p>
            </Notice>
          ) : null}

          {view.state === "no-account" ? (
            <Notice
              name="no-account"
              title="You do not have a file transfer account yet"
            >
              <p>
                File transfer accounts are not created automatically. Ask an
                Administrator to create one for you in Nexus Control. They will
                give you your SFTP name and a first password.
              </p>
            </Notice>
          ) : null}

          {view.state === "ready" ? (
            <>
              <section aria-labelledby="account-title" data-transfer-account>
                <h2 id="account-title" className="text-heading-3 font-semibold">
                  Your account
                </h2>
                <dl className="text-data mt-3 grid max-w-3xl grid-cols-[auto_minmax(0,1fr)] gap-x-8 gap-y-3">
                  <dt className="text-muted">SFTP name</dt>
                  <dd className="font-mono break-all">
                    {view.account.username}
                  </dd>
                  <dt className="text-muted">Status</dt>
                  <dd>
                    {view.account.enabled
                      ? "Active"
                      : "Disabled. Ask an Administrator to enable it."}
                  </dd>
                  <dt className="text-muted">Server</dt>
                  <dd className="font-mono break-all">
                    {view.host}, port {SFTP_PORT}
                  </dd>
                  <dt className="text-muted">Storage</dt>
                  <dd>
                    <Quota account={view.account} />
                  </dd>
                  <dt className="text-muted">Last sign-in</dt>
                  <dd>{formatTime(view.account.lastLoginAt)}</dd>
                </dl>
              </section>

              {/* Embedded Transfer File Portal */}
              <section
                aria-labelledby="portal-title"
                data-transfer-portal
                className="space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2
                      id="portal-title"
                      className="text-heading-3 font-semibold"
                    >
                      File Portal
                    </h2>
                    <p className="text-muted mt-1 max-w-(--spacing-prose)">
                      Upload, download, and organize files directly inside
                      Nexus. Connected with your Nexus account.
                    </p>
                  </div>
                  <a
                    href="/files/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="border-line text-muted hover:text-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors"
                    title="Open in new window"
                  >
                    <span>Pop out window</span>
                    <span className="sr-only">(opens in new window)</span>
                  </a>
                </div>

                <div className="border-line bg-surface relative h-[780px] w-full overflow-hidden rounded-xl border shadow-sm">
                  <iframe
                    src="/files/"
                    title="Nexus Transfer File Portal"
                    className="h-full w-full border-0"
                    allow="clipboard-read; clipboard-write"
                  />
                </div>
              </section>

              <Keys account={view.account} />
              <Guides host={view.host} username={view.account.username} />
            </>
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
