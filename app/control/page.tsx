import Link from "next/link";
import { ControlUsers } from "@/components/auth/control-users";
import { ControlTransfer } from "@/components/transfer/control-transfer";
import { ControlMail } from "@/components/mail/control-mail";
import { ControlAudit } from "@/components/control/control-audit";
import { ControlConfig } from "@/components/control/control-config";
import { ControlServices } from "@/components/control/control-services";
import { RelatedModules } from "@/components/layout/related-modules";
import { StepUpForm } from "@/components/auth/auth-forms";
import { Backdrop } from "@/components/backdrop/backdrop";
import { ControlShell } from "@/components/layout/control-shell";
import { ModuleHero } from "@/components/layout/module-hero";
import { SectionNav } from "@/components/layout/section-nav";
import { PageTransition } from "@/components/motion/page-transition";
import { findModule, pageInfo } from "@/lib/navigation/modules";
import { controlMetadata } from "@/lib/server/control-metadata";
import { readControlUsersSnapshot } from "@/lib/server/control-users";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";

// Administrator-only, and only after a fresh Step_Up (password plus a code from
// the authenticator app, within the last 10 minutes).
// Task 19 completes Nexus Control with user lifecycle, transfer, mail, service actions,
// system configuration, audit trail, and cross-module linkages.
export const generateMetadata = () => controlMetadata("/control");

export default async function ControlPage() {
  const { stepUpRequired } = await requirePage("/control");
  const page = pageInfo("/control");
  const control = findModule("control");
  const demo = getMode() === "demo";

  const snapshot = stepUpRequired ? null : await readControlUsersSnapshot();
  const users = snapshot?.users ?? [];
  const usersWithServices = snapshot?.usersWithServices ?? [];
  const transfer = snapshot?.transfer ?? null;
  const mail = snapshot?.mail ?? null;
  const auditEvents = snapshot?.auditEvents ?? [];

  return (
    <ControlShell>
      <SectionNav label="Control sections" items={control.subNav ?? []} />
      <PageTransition>
        <div>
          <Backdrop path="/control" />
          <ModuleHero page={page} register="workspace" />
          <div className="flex flex-col gap-12 px-(--spacing-gutter) py-8">
            {stepUpRequired ? (
              <section
                aria-labelledby="stepup-title"
                className="flex flex-col gap-4"
              >
                <h2 id="stepup-title" className="text-heading-3 font-semibold">
                  Confirm it is you
                </h2>
                <p className="text-muted max-w-(--spacing-prose)">
                  Control changes accounts, access and system services, so it
                  asks for your password and a code from your authenticator app
                  again. The verification lasts 10 minutes.
                </p>
                <StepUpForm next="/control" />
              </section>
            ) : (
              <>
                {/* 1. Accounts & Roles */}
                <section
                  aria-labelledby="users-title"
                  className="flex flex-col gap-4"
                  data-control-users
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="users-title"
                      className="text-heading-3 font-semibold"
                    >
                      Accounts
                    </h2>
                    <Link
                      href="/control/users"
                      className="border-line hover:border-ink hover:bg-surface-raised inline-flex min-h-11 items-center rounded-full border px-4 text-xs font-medium transition-colors"
                    >
                      Open User Management →
                    </Link>
                  </div>
                  {demo ? (
                    <p className="text-muted text-data max-w-(--spacing-prose)">
                      Demo session: these accounts are examples and changes do
                      not persist.
                    </p>
                  ) : null}
                  <ControlUsers
                    users={usersWithServices}
                    auditEvents={auditEvents}
                    demo={demo}
                  />
                </section>

                {/* Legacy Subsystem Tables: Details & Unlinked Service Accounts */}
                <details className="group border-line rounded-xl border p-5">
                  <summary className="text-muted hover:text-ink cursor-pointer text-sm font-semibold">
                    Advanced Subsystems: Direct SFTPGo & Virtual Mailbox Tables
                  </summary>
                  <div className="mt-6 flex flex-col gap-10">
                    {/* 2. File Transfer Accounts */}
                    {transfer ? (
                      <section
                        aria-labelledby="transfer-title"
                        className="flex flex-col gap-4"
                        data-control-transfer
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <h2
                            id="transfer-title"
                            className="text-heading-3 font-semibold"
                          >
                            File Transfer Accounts (SFTPGo)
                          </h2>
                        </div>
                        {demo ? (
                          <p className="text-muted text-data max-w-(--spacing-prose)">
                            Demo session: these accounts are examples and file
                            controls are switched off.
                          </p>
                        ) : null}
                        {transfer.state === "ready" ? (
                          <ControlTransfer
                            accounts={transfer.accounts}
                            people={users.map((u) => ({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                            }))}
                            demo={demo}
                          />
                        ) : (
                          <p className="text-muted max-w-(--spacing-prose)">
                            The file transfer service did not answer. Check its
                            status on the services section below.
                          </p>
                        )}
                      </section>
                    ) : null}

                    {/* 3. Mailboxes */}
                    {mail ? (
                      <section
                        aria-labelledby="mail-title"
                        className="flex flex-col gap-4"
                        data-control-mail
                      >
                        <div className="flex flex-wrap items-center gap-3">
                          <h2
                            id="mail-title"
                            className="text-heading-3 font-semibold"
                          >
                            Mailboxes & Virtual Accounts
                          </h2>
                        </div>
                        {demo ? (
                          <p className="text-muted text-data max-w-(--spacing-prose)">
                            Demo session: these mailboxes are examples and every
                            control is simulated.
                          </p>
                        ) : null}
                        {mail.state === "ready" ? (
                          <ControlMail
                            accounts={mail.accounts}
                            people={users.map((u) => ({
                              id: u.id,
                              name: u.name,
                              email: u.email,
                            }))}
                            demo={demo}
                          />
                        ) : (
                          <p className="text-muted max-w-(--spacing-prose)">
                            The mail database did not answer. Check it on the
                            services section below.
                          </p>
                        )}
                      </section>
                    ) : null}
                  </div>
                </details>

                {/* 4. Service Actions (Allowlist) */}
                <section
                  aria-labelledby="services-control-title"
                  className="flex flex-col gap-4"
                  data-control-services
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h2
                      id="services-control-title"
                      className="text-heading-3 font-semibold"
                    >
                      Service Actions & Operations Agent
                    </h2>
                  </div>
                  <ControlServices demo={demo} />
                </section>

                {/* 5. Configuration View */}
                <section
                  aria-labelledby="config-title"
                  className="flex flex-col gap-4"
                  data-control-config
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h2
                      id="config-title"
                      className="text-heading-3 font-semibold"
                    >
                      Platform Configuration
                    </h2>
                  </div>
                  <ControlConfig mode={demo ? "demo" : "live"} />
                </section>

                {/* 6. Audit Trail Viewer */}
                <section
                  aria-labelledby="audit-title"
                  className="flex flex-col gap-4"
                  data-control-audit
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <h2
                      id="audit-title"
                      className="text-heading-3 font-semibold"
                    >
                      Audit Trail & Authorization Events
                    </h2>
                  </div>
                  <ControlAudit events={auditEvents} demo={demo} />
                </section>

                {/* 7. Connected Subsystems */}
                <RelatedModules slugs={page.related} />
              </>
            )}
          </div>
        </div>
      </PageTransition>
    </ControlShell>
  );
}
