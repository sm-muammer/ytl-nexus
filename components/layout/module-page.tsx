import Link from "next/link";
import type { Metadata } from "next";
import { PageTransition } from "@/components/motion/page-transition";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { StatusBadge } from "@/components/ui/status-badge";
import { accessLabel } from "@/lib/roles";
import { findModule, pageInfo } from "@/lib/navigation/modules";
import { getAdapters } from "@/lib/server/adapters";
import { ModuleHero } from "./module-hero";
import type { Register } from "./app-shell";

const backingName: Record<string, string> = {
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
 * Stub page for a route whose module is not built yet (Requirement 3.8). It
 * confirms the route, its access level and the sub-brand hero, shows the
 * status of the service behind it (labelled Live or Demo data), and links
 * related modules. The module task replaces the body, not the route.
 */
export async function ModulePage({
  path,
  register,
  ambient = false,
}: {
  path: string;
  register: Register;
  ambient?: boolean;
}) {
  const page = pageInfo(path);
  const backing = page.backing
    ? await getAdapters()[page.backing].status()
    : null;
  const related = page.related.map(findModule);
  const roomy = register === "public";

  return (
    <PageTransition>
      <div>
        <ModuleHero page={page} register={register} ambient={ambient} />

        <div
          className={`grid gap-8 px-(--spacing-gutter) lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] ${
            roomy ? "py-16" : "py-8"
          }`}
        >
          <section
            data-stub-notice
            aria-labelledby="stub-title"
            className="border-line bg-surface rounded-lg border p-6"
          >
            <h2 id="stub-title" className="text-heading-3 font-semibold">
              Not available yet
            </h2>
            <p className="text-muted mt-3 max-w-(--spacing-prose)">
              {page.summary}
            </p>
            <p className="text-muted text-data mt-4 max-w-(--spacing-prose)">
              This page confirms the route, the menu entry and the access level.
              The working module is Task {page.task} of the build plan.
            </p>
          </section>

          <section
            aria-labelledby="details-title"
            className="flex flex-col gap-3"
          >
            <h2 id="details-title" className="text-heading-3 font-semibold">
              Details
            </h2>
            <dl className="border-line bg-surface text-data grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-lg border p-5">
              <dt className="text-muted">Access</dt>
              <dd>{accessLabel(page.minRole)}</dd>
              <dt className="text-muted">Route</dt>
              <dd className="font-mono break-all">{page.path}</dd>
              {backing && page.backing ? (
                <>
                  <dt className="text-muted">Service</dt>
                  <dd className="flex flex-col items-start gap-2">
                    <span>{backingName[page.backing]}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge
                        status={backing.state}
                        label={backing.label}
                      />
                      <LiveDemoLabel source={backing.source} />
                    </span>
                    <span className="text-muted">{backing.detail}</span>
                  </dd>
                </>
              ) : null}
            </dl>
          </section>

          <section
            aria-labelledby="related-title"
            className="flex flex-col gap-3 lg:col-span-2"
          >
            <h2 id="related-title" className="text-heading-3 font-semibold">
              Related modules
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((m) => {
                const body = (
                  <>
                    <span className="block font-medium">{m.name}</span>
                    <span className="text-muted text-data block">
                      {m.subtitle}
                    </span>
                  </>
                );
                const cls =
                  "border-line bg-surface hover:bg-surface-raised block min-h-11 rounded-lg border px-4 py-3 transition-colors duration-(--duration-fast)";
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
