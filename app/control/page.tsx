import { ControlUsers } from "@/components/auth/control-users";
import { StepUpForm } from "@/components/auth/auth-forms";
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

// Administrator-only, and only after a fresh Step_Up (password plus a code from
// the authenticator app, within the last 10 minutes). Task 6 delivers the entry,
// the user list, password reset and session revocation; Task 19 the rest.
// No particle field: Control uses no decorative motion.
export const generateMetadata = () => controlMetadata("/control");

export default async function ControlPage() {
  const { stepUpRequired } = await requirePage("/control");
  const page = pageInfo("/control");
  const demo = getMode() === "demo";

  return (
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
                password and a code from your authenticator app again. The check
                lasts 10 minutes.
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
              <ControlUsers
                users={
                  demo
                    ? demoControlUsers
                    : await listUsersForAdmin(getAuthRuntime())
                }
              />
            </section>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
