import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { PageTransition } from "@/components/motion/page-transition";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { StatusBadge } from "@/components/ui/status-badge";
import { accessLabel } from "@/lib/roles";
import { findModule, pageInfo } from "@/lib/navigation/modules";
import { getAdapters } from "@/lib/server/adapters";
import type { AdapterName } from "@/lib/server/adapters/types";
import { ModuleHero } from "./module-hero";
import type { Register } from "./app-shell";

const backingName: Record<AdapterName, string> = {
  db: "MariaDB",
  auth: "Authentication",
  wordpress: "WordPress",
  prometheus: "Prometheus",
  ollama: "Ollama",
  sftpgo: "SFTPGo",
  ops: "Operations agent",
  mail: "Mail",
};

/** Title and description for a registered page, from the registry. */
export function pageMetadata(path: string): Metadata {
  const page = pageInfo(path);
  return { title: page.title, description: page.subtitle };
}

/**
 * The service behind a page. It is its own async component inside Suspense, so
 * a slow live adapter streams in after the rest of the page instead of
 * blocking it.
 */
async function BackingStatus({ name }: { name: AdapterName }) {
  const status = await getAdapters()[name].status();
  return (
    <>
      <dt className="text-muted">Service</dt>
      <dd className="flex flex-col items-start gap-2">
        <span>{backingName[name]}</span>
        <span className="flex flex-wrap items-center gap-2">
          <StatusBadge status={status.state} label={status.label} />
          <LiveDemoLabel source={status.source} />
        </span>
        <span className="text-muted">{status.detail}</span>
      </dd>
    </>
  );
}

/**
 * Stub page for a route whose module is not built yet (Requirement 3.8). It
 * confirms the route, its access level and the sub-brand hero, shows the
 * status of the service behind it (labelled Live or Demo data), and links
 * related modules. The module task replaces the body, not the route.
 */
export function ModulePage({
  path,
  register,
  ambient = false,
}: {
  path: string;
  register: Register;
  ambient?: boolean;
}) {
  const page = pageInfo(path);
  const related = page.related.map(findModule);
  const roomy = register === "public";

  return (
    <PageTransition>
      <div>
        <ModuleHero page={page} register={register} ambient={ambient} />

        <div
          className={`grid gap-x-16 gap-y-12 px-(--spacing-gutter) lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] ${
            roomy ? "py-16" : "py-8"
          }`}
        >
          <section
            data-stub-notice
            aria-labelledby="stub-title"
            className="border-border-strong border-l-2 pl-6"
          >
            <h2 id="stub-title" className="text-heading-3 font-semibold">
              Not available yet
            </h2>
            <p className="text-muted mt-3 max-w-(--spacing-prose)">
              {page.summary}
            </p>
            <p className="text-muted text-data mt-4 max-w-(--spacing-prose)">
              This page confirms the route, the menu entry and the access level.
              The working module is scheduled as task {page.task} of 22 in the
              build plan.
            </p>
          </section>

          <section aria-labelledby="details-title">
            <h2 id="details-title" className="text-heading-3 font-semibold">
              Details
            </h2>
            <dl className="text-data mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3">
              <dt className="text-muted">Access</dt>
              <dd>{accessLabel(page.minRole)}</dd>
              <dt className="text-muted">Route</dt>
              <dd className="font-mono break-all">{page.path}</dd>
              {page.backing ? (
                <Suspense
                  fallback={
                    <>
                      <dt className="text-muted">Service</dt>
                      <dd className="text-muted">Checking</dd>
                    </>
                  }
                >
                  <BackingStatus name={page.backing} />
                </Suspense>
              ) : null}
            </dl>
          </section>

          <section aria-labelledby="related-title" className="lg:col-span-2">
            <h2 id="related-title" className="text-heading-3 font-semibold">
              Related modules
            </h2>
            <ul className="divide-line border-line mt-3 divide-y border-y">
              {related.map((m) => {
                const body = (
                  <>
                    <span className="font-medium">{m.name}</span>
                    <span className="text-muted text-data">{m.subtitle}</span>
                  </>
                );
                const cls =
                  "hover:bg-surface flex min-h-11 flex-col gap-0.5 px-2 py-4 transition-colors duration-(--duration-fast) sm:flex-row sm:items-baseline sm:justify-between sm:gap-6";
                return (
                  <li key={m.slug}>
                    {m.apacheServed ? (
                      <a href={m.href} className={cls}>
                        {body}
                      </a>
                    ) : (
                      <Link href={m.href} className={cls}>
                        {body}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </PageTransition>
  );
}
