import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { PageTransition } from "@/components/motion/page-transition";
import { pageInfo } from "@/lib/navigation/modules";

/**
 * Title, backdrop and transition shared by the Nexus Command pages. The
 * content streams in below, so a slow Prometheus never blocks the heading.
 */
export function CommandFrame({
  path,
  children,
}: {
  path: string;
  children: React.ReactNode;
}) {
  return (
    <PageTransition>
      <div>
        <Backdrop path={path} />
        <ModuleHero page={pageInfo(path)} register="workspace" />
        {children}
      </div>
    </PageTransition>
  );
}

export function CommandLoading({ what }: { what: string }) {
  return (
    <p role="status" className="text-muted px-(--spacing-gutter) py-8">
      Loading {what}.
    </p>
  );
}

/** Shown when a live reading is not available at all. */
export function Unavailable({ what }: { what: string }) {
  return (
    <section
      data-unavailable
      className="border-border-strong mx-(--spacing-gutter) my-8 border-l-2 pl-6"
    >
      <h2 className="text-heading-3 font-semibold">No data</h2>
      <p className="text-muted mt-2 max-w-(--spacing-prose)">
        {what} could not be read. Prometheus does not answer, or it has not
        collected this yet. Nothing is shown rather than a guess.
      </p>
    </section>
  );
}
