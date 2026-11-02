import { redirect } from "next/navigation";
import { EnrolForm, SignInForm, TotpForm } from "@/components/auth/auth-forms";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";
import { safeNext } from "@/lib/server/auth/safe-next";
import { getIdentity } from "@/lib/server/identity";
import { getMode } from "@/lib/server/mode";
import { identityToActor } from "@/lib/server/policy";

// The form page: no particle field. In Demo_Mode there is nothing to sign in
// to; the session switcher in the menu stands in for it.
export const metadata = pageMetadata("/signin");

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const query = await searchParams;
  const step = single(query.step);
  const next = safeNext(single(query.next));
  const page = pageInfo("/signin");

  if (getMode() === "demo") {
    return (
      <Frame>
        <ModuleHero page={page} register="public" />
        <Body title="Demo session">
          <p className="text-muted max-w-(--spacing-prose)">
            This copy of YTL Nexus runs on demo data, so there are no accounts.
            Open the menu and choose a role under Demo session to see the site
            as that role.
          </p>
        </Body>
      </Frame>
    );
  }

  const identity = await getIdentity();
  const signedIn = identity.kind === "user";
  // Signed in, but an Operator or Administrator who has not set up two-factor yet.
  const needsEnrolment = signedIn && identityToActor(identity) === null;

  if (signedIn && !needsEnrolment) redirect(next);
  if (step === "enrol" && !needsEnrolment) redirect("/signin");

  return (
    <Frame>
      <ModuleHero page={page} register="public" />
      {step === "enrol" && needsEnrolment ? (
        <Body title="Set up two-factor sign-in">
          <EnrolForm next={next} />
        </Body>
      ) : step === "totp" ? (
        <Body title="Enter your code">
          <TotpForm next={next} />
        </Body>
      ) : (
        <Body title="Sign in">
          <SignInForm next={next} />
        </Body>
      )}
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <PageTransition>
      <div>{children}</div>
    </PageTransition>
  );
}

function Body({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="signin-title"
      className="flex flex-col gap-6 px-(--spacing-gutter) py-12"
    >
      <h2 id="signin-title" className="text-heading-3 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
