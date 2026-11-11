import { ControlUsers } from "@/components/auth/control-users";
import { ControlTransfer } from "@/components/transfer/control-transfer";
import { StepUpForm } from "@/components/auth/auth-forms";
import { ControlShell } from "@/components/layout/control-shell";
import { ModuleHero } from "@/components/layout/module-hero";
import { PageTransition } from "@/components/motion/page-transition";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { demoControlUsers } from "@/lib/fixtures/control-users";
import { pageInfo } from "@/lib/navigation/modules";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { listUsersForAdmin } from "@/lib/server/auth/service";
import { controlMetadata } from "@/lib/server/control-metadata";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { readAllAccounts } from "@/lib/server/transfer";

// Administrator-only, and only after a fresh Step_Up (password plus a code from
// the authenticator app, within the last 10 minutes). Task 6 delivers the entry,
// the user list, password reset and session revocation; Task 12 adds the file
// transfer accounts; Task 19 the rest.
// No particle field: Control uses no decorative motion.
export const generateMetadata = () => controlMetadata("/control");

export default async function ControlPage() {
  const { stepUpRequired } = await requirePage("/control");
  const page = pageInfo("/control");
  const demo = getMode() === "demo";
  // Read once and share: the account list and the person choice for new SFTP accounts.
  const users = stepUpRequired
    ? []
    : demo
      ? demoControlUsers
      : await listUsersForAdmin(getAuthRuntime());
  const transfer = stepUpRequired ? null : await readAllAccounts();

  return (
    <ControlShell>
      <PageTransition>
        <div>
          <ModuleHero page={page} register="workspace" />
          <div className="flex flex-col gap-10 px-(--spacing-gutter) py-8">
            {stepUpRequired ? (
              <section
                aria-labelledby="stepup-title"
                className="flex flex-col gap-4"
              >
                <h2 id="stepup-title" className="text-heading-3 font-semibold">
                  Confirm it is you
                </h2>
                <p className="text-muted max-w-(--spacing-prose)">
                  Control changes accounts and access, so it asks for your
                  password and a code from your authenticator app again. The
                  check lasts 10 minutes.
                </p>
                <StepUpForm />
              </section>
            ) : (
              <section
                aria-labelledby="users-title"
                className="flex flex-col gap-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <h2 id="users-title" className="text-heading-3 font-semibold">
                    Accounts
                  </h2>
                  <LiveDemoLabel source={demo ? "demo" : "live"} />
                </div>
                {demo ? (
                  <p className="text-muted text-data max-w-(--spacing-prose)">
                    Demo session: these accounts are examples and the buttons
                    change nothing.
                  </p>
                ) : null}
                <ControlUsers users={users} />
              </section>
            )}
            {!stepUpRequired && transfer ? (
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
                    File transfer accounts
                  </h2>
                  <LiveDemoLabel source={transfer.source} />
                </div>
                {demo ? (
                  <p className="text-muted text-data max-w-(--spacing-prose)">
                    Demo session: these accounts are examples and every control
                    is switched off.
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
                    The file transfer service does not answer, so no accounts
                    are shown. Check it on the services page.
                  </p>
                )}
              </section>
            ) : null}
          </div>
        </div>
      </PageTransition>
    </ControlShell>
  );
}
