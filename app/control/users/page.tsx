import { ControlUsers } from "@/components/auth/control-users";
import { StepUpForm } from "@/components/auth/auth-forms";
import { Backdrop } from "@/components/backdrop/backdrop";
import { ControlShell } from "@/components/layout/control-shell";
import { ModuleHero } from "@/components/layout/module-hero";
import { RelatedModules } from "@/components/layout/related-modules";
import { SectionNav } from "@/components/layout/section-nav";
import { PageTransition } from "@/components/motion/page-transition";
import { findModule, pageInfo } from "@/lib/navigation/modules";
import { controlMetadata } from "@/lib/server/control-metadata";
import { readControlUsersSnapshot } from "@/lib/server/control-users";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";

export const generateMetadata = () => controlMetadata("/control/users");

export default async function ControlUsersPage() {
  const { stepUpRequired } = await requirePage("/control/users");
  const page = pageInfo("/control/users");
  const control = findModule("control");
  const demo = getMode() === "demo";
  const snapshot = stepUpRequired ? null : await readControlUsersSnapshot();

  return (
    <ControlShell>
      <SectionNav label="Control sections" items={control.subNav ?? []} />
      <PageTransition>
        <div>
          <Backdrop path="/control/users" />
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
                  User management changes accounts, roles and subsystem access,
                  so it asks for your password and a code from your
                  authenticator app again. The verification lasts 10 minutes.
                </p>
                <StepUpForm next="/control/users" />
              </section>
            ) : (
              <>
                <section
                  aria-labelledby="users-directory-title"
                  className="flex flex-col gap-4"
                  data-control-users
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2
                      id="users-directory-title"
                      className="text-heading-3 font-semibold"
                    >
                      Accounts & Role Lifecycle
                    </h2>
                  </div>
                  {demo ? (
                    <p className="text-muted text-data max-w-(--spacing-prose)">
                      Demo session: these accounts are examples and changes do
                      not persist.
                    </p>
                  ) : null}
                  <ControlUsers
                    users={snapshot?.usersWithServices ?? []}
                    auditEvents={snapshot?.auditEvents ?? []}
                    serviceRequests={snapshot?.serviceRequests ?? []}
                    demo={demo}
                  />
                </section>

                <RelatedModules slugs={page.related} />
              </>
            )}
          </div>
        </div>
      </PageTransition>
    </ControlShell>
  );
}
