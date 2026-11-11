import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { pageMetadata } from "@/components/layout/module-page";
import { PageTransition } from "@/components/motion/page-transition";
import {
  OpenIncidentForm,
  UpdateIncidentForm,
} from "@/components/status/incident-forms";
import {
  IncidentList,
  MaintenanceNotices,
  OverallBanner,
  PublicServiceList,
  ServiceHistoryTable,
} from "@/components/status/status-parts";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { meetsRole } from "@/lib/roles";
import { pageInfo } from "@/lib/navigation/modules";
import { listContent } from "@/lib/server/content";
import { getMode } from "@/lib/server/mode";
import { getActor } from "@/lib/server/session";
import { getStatusView } from "@/lib/server/status";
import { formatTime } from "@/lib/status/format";
import type { MaintenanceNotice, StatusView } from "@/lib/status/types";

export const metadata = pageMetadata("/status");

// Public page. A Visitor receives service names and states only; Viewers and
// above also get history, uptime, incidents and updates. The split happens in
// getStatusView, not here, so this page cannot show a Visitor more by mistake
// (requirements 9.15 and 9.16). Operators and Administrators can open and update
// incidents; those Server Functions guard themselves.
export default async function StatusPage() {
  const actor = await getActor();
  const [view, notices] = await Promise.all([
    getStatusView(actor).catch((): StatusView | null => null),
    loadNotices(actor),
  ]);
  const canManage = meetsRole(actor, "operator");
  const demo = getMode() === "demo";

  return (
    <PageTransition>
      <div>
        <Backdrop path="/status" />
        <ModuleHero page={pageInfo("/status")} register="public" />
        <div className="grid grid-cols-[minmax(0,1fr)] gap-16 px-(--spacing-gutter) py-16">
          {view === null ? (
            <p role="status" className="border-border-strong border-l-2 pl-6">
              Status could not be read right now. Try again in a minute.
            </p>
          ) : (
            <>
              <section aria-labelledby="overall-title">
                <h2 id="overall-title" className="sr-only">
                  Current status
                </h2>
                <OverallBanner services={view.services} />
                <p className="text-data mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
                  <LiveDemoLabel source={view.source} />
                  <span className="text-muted">
                    Read {formatTime(view.takenAt)}. Checks run every minute.
                  </span>
                </p>
              </section>

              <MaintenanceNotices notices={notices} />

              <section aria-labelledby="services-title">
                <h2
                  id="services-title"
                  className="text-heading-3 font-semibold"
                >
                  Services
                </h2>
                {view.kind === "public" ? (
                  <>
                    <p className="text-muted text-data mt-2 max-w-(--spacing-prose)">
                      Sign in to see check history, uptime and incidents.
                    </p>
                    <div className="mt-4">
                      <PublicServiceList services={view.services} />
                    </div>
                  </>
                ) : (
                  <div className="mt-4">
                    <ServiceHistoryTable services={view.services} />
                    <p className="text-muted text-data mt-3 max-w-(--spacing-prose)">
                      “Unknown” means no check has run for that service yet.
                      Services that are not installed yet have no check.
                    </p>
                  </div>
                )}
              </section>

              {view.kind === "full" ? (
                <section aria-labelledby="incidents-title">
                  <h2
                    id="incidents-title"
                    className="text-heading-3 font-semibold"
                  >
                    Incidents
                  </h2>
                  {canManage ? (
                    <div className="mt-4 mb-8">
                      <OpenIncidentForm services={view.services} demo={demo} />
                    </div>
                  ) : null}
                  <div className="mt-4">
                    <IncidentList
                      incidents={view.incidents}
                      renderActions={
                        canManage
                          ? (incident) => (
                              <UpdateIncidentForm
                                id={incident.id}
                                current={incident.state}
                                demo={demo}
                              />
                            )
                          : undefined
                      }
                    />
                  </div>
                </section>
              ) : null}
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}

async function loadNotices(
  actor: Awaited<ReturnType<typeof getActor>>,
): Promise<MaintenanceNotice[]> {
  const result = await listContent("announcement", actor).catch(() => null);
  if (!result?.ok) return [];
  return result.items.map((i) => ({
    slug: i.slug,
    title: i.title,
    excerpt: i.excerpt,
    modified: i.modified,
  }));
}
