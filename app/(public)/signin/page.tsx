import { redirect } from "next/navigation";
import {
  EnrolForm,
  SignInForm,
  SignUpForm,
  TotpForm,
} from "@/components/auth/auth-forms";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";
import { safeNext } from "@/lib/server/auth/safe-next";
import { getIdentity } from "@/lib/server/identity";
import { getMode } from "@/lib/server/mode";
import { identityToActor } from "@/lib/server/policy";

export const metadata = pageMetadata("/signin");

const single = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function SignInPage({
  searchParams,
}: PageProps<"/signin">) {
  const query = await searchParams;
  const step = single(query.step);
  const tab = single(query.tab) ?? "signin";
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
  // Signed in, but an Administrator who has not set up two-factor yet.
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
        <Body
          title={tab === "signup" ? "Create an account" : "Sign in"}
          tab={tab}
        >
          {tab === "signup" ? <SignUpForm /> : <SignInForm next={next} />}
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
  tab,
  children,
}: {
  title: string;
  tab?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby="signin-title"
      className="flex flex-col gap-6 px-(--spacing-gutter) py-12"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="signin-title" className="text-heading-3 font-semibold">
          {title}
        </h2>
        {tab ? (
          <div className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/60 p-1 text-xs">
            <a
              href="/signin"
              className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                tab !== "signup"
                  ? "bg-cyan-500/15 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign in
            </a>
            <a
              href="/signin?tab=signup"
              className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                tab === "signup"
                  ? "bg-cyan-500/15 text-cyan-300 shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Sign up
            </a>
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}
