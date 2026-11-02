import Link from "next/link";

// Shown with a 403 when someone is signed in but their role is too low for the
// page (the forbidden() call in the guards). It names no page and no role. It
// renders inside the workspace shell, which supplies the main landmark.
export const metadata = { title: "No access", robots: { index: false } };

export default function Forbidden() {
  return (
    <section
      aria-labelledby="forbidden-title"
      className="flex max-w-2xl flex-col gap-4 px-(--spacing-gutter) py-16"
    >
      <h1
        id="forbidden-title"
        className="text-heading-2 font-display font-semibold"
      >
        You do not have access to this page
      </h1>
      <p className="text-muted max-w-(--spacing-prose)">
        Your account is signed in, but its role does not include this page. If
        you need it, ask an Administrator of the IT Infrastructure team.
      </p>
      <p>
        <Link
          href="/"
          className="text-accent-ink inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Back to the home page
        </Link>
      </p>
    </section>
  );
}
