import Link from "next/link";

// The 404 for an unknown path and, by design, the answer to anyone who asks for
// Nexus Control without being an Administrator (requirement 6.11). One file
// serves both, so they cannot drift apart. It says nothing about why.
export const metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-(--spacing-gutter) py-16 outline-none"
    >
      <h1 className="text-heading-2 font-display font-semibold">
        This page could not be found
      </h1>
      <p className="text-muted max-w-(--spacing-prose)">
        Check the address, or start again from the home page.
      </p>
      <p>
        <Link
          href="/"
          className="text-accent-ink inline-flex min-h-11 items-center underline underline-offset-4"
        >
          Back to the home page
        </Link>
      </p>
    </main>
  );
}
