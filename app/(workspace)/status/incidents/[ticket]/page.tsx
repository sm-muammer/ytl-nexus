import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Backdrop } from "@/components/backdrop/backdrop";
import { ModuleHero } from "@/components/layout/module-hero";
import { RelatedModules } from "@/components/layout/related-modules";
import { PageTransition } from "@/components/motion/page-transition";
import { UpdateIncidentForm } from "@/components/status/incident-forms";
import {
  INCIDENT_STATE_TEXT,
  IncidentProgressSteps,
  IncidentStateBadge,
} from "@/components/status/status-parts";
import {
  CopyTicketButton,
  CopyTrackingLinkButton,
  IncidentTicketLookup,
} from "@/components/status/ticket-controls";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import { pageInfo } from "@/lib/navigation/modules";
import { meetsRole } from "@/lib/roles";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { identityToActor } from "@/lib/server/policy";
import { getIncidentByTicket } from "@/lib/server/status";
import { formatTime } from "@/lib/status/format";
import {
  formatIncidentDuration,
  incidentTrackingPath,
  normalizeIncidentTicketNo,
} from "@/lib/status/tickets";
import type { IncidentLookupView } from "@/lib/status/types";

export const metadata: Metadata = {
  title: "Incident status",
  robots: { index: false, follow: false },
};

export default async function IncidentTicketPage({
  params,
}: {
  params: Promise<{ ticket: string }>;
}) {
  const { identity } = await requirePage("/status/incidents/[ticket]");
  const { ticket } = await params;

  let decoded = ticket;
  try {
    decoded = decodeURIComponent(ticket);
  } catch {
    decoded = "";
  }
  const normalized = normalizeIncidentTicketNo(decoded);
  if (!normalized) notFound();
  if (decoded !== normalized) {
    redirect(incidentTrackingPath(normalized));
  }

  const actor = identityToActor(identity);
  const lookup = await getIncidentByTicket(actor, normalized).catch(
    (): IncidentLookupView | null => null,
  );
  const canManage = meetsRole(actor, "operator");
  const demo = getMode() === "demo";
  const base = pageInfo("/status");

  return (
    <PageTransition>
      <div>
        <Backdrop path="/status/incidents/[ticket]" />
        <ModuleHero
          page={{
            ...base,
            title: normalized,
            subtitle: lookup?.incident
              ? lookup.incident.title
              : "Incident status tracking",
            parent: { name: "Nexus Status", href: "/status" },
          }}
          register="workspace"
        />

        <div className="grid grid-cols-[minmax(0,1fr)] gap-10 px-(--spacing-gutter) py-8">
          <p className="text-data flex flex-wrap items-center gap-x-4 gap-y-1">
            <EnvironmentBadge mode={demo ? "demo" : "live"} />
            <LiveDemoLabel
              source={lookup?.source ?? (demo ? "demo" : "live")}
            />
            {lookup ? (
              <span className="text-muted">
                Checked {formatTime(lookup.takenAt)}.
              </span>
            ) : null}
          </p>

          {lookup === null ? (
            <p role="status" className="border-border-strong border-l-2 pl-6">
              Incident details could not be read right now. Try again in a
              minute.
            </p>
          ) : !lookup.incident ? (
            <section
              aria-labelledby="ticket-missing-title"
              data-ticket-not-found={normalized}
              className="border-border-strong border-l-2 pl-6"
            >
              <h2
                id="ticket-missing-title"
                className="text-heading-3 font-semibold"
              >
                Ticket {normalized} not found
              </h2>
              <p className="text-muted mt-2 max-w-(--spacing-prose)">
                No incident matches that ticket number. Check the digits and try
                again, or return to Nexus Status to view recent incidents.
              </p>
            </section>
          ) : (
            <section
              aria-labelledby="tracker-summary-title"
              data-incident-tracker={lookup.incident.ticketNo}
              className="grid gap-8"
            >
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="border-line bg-surface text-accent-ink rounded-full border px-3 py-1 font-mono text-xs font-semibold">
                    {lookup.incident.ticketNo}
                  </span>
                  <IncidentStateBadge state={lookup.incident.state} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <CopyTicketButton ticketNo={lookup.incident.ticketNo} />
                  <CopyTrackingLinkButton
                    path={incidentTrackingPath(lookup.incident.ticketNo)}
                  />
                </div>
              </div>

              <div>
                <h2
                  id="tracker-summary-title"
                  className="text-heading-3 font-semibold"
                >
                  Current progress
                </h2>
                <div className="mt-3">
                  <IncidentProgressSteps state={lookup.incident.state} />
                </div>
              </div>

              <dl className="border-line grid grid-cols-1 gap-4 border-y py-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-muted text-data">Ticket number</dt>
                  <dd className="mt-1 font-mono font-semibold">
                    {lookup.incident.ticketNo}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-data">Affected service</dt>
                  <dd className="mt-1">
                    <Link
                      href={`/command/atlas?service=${encodeURIComponent(lookup.incident.serviceSlug)}`}
                      className="inline-flex min-h-11 items-center underline underline-offset-4 md:min-h-6"
                    >
                      {lookup.incident.serviceName}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-data">Current status</dt>
                  <dd className="mt-1 font-medium">
                    {INCIDENT_STATE_TEXT[lookup.incident.state]}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-data">Opened</dt>
                  <dd className="mt-1">
                    {formatTime(lookup.incident.openedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-data">Resolved</dt>
                  <dd className="mt-1">
                    {lookup.incident.resolvedAt === null
                      ? "Not resolved yet"
                      : formatTime(lookup.incident.resolvedAt)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted text-data">Duration</dt>
                  <dd className="mt-1 tabular-nums">
                    {formatIncidentDuration(
                      lookup.incident.openedAt,
                      lookup.incident.resolvedAt,
                      lookup.takenAt,
                    )}
                  </dd>
                </div>
              </dl>

              <div>
                <h2 className="text-heading-3 font-semibold">
                  Update timeline
                </h2>
                <ol
                  className="divide-line border-line mt-3 divide-y border-y"
                  data-incident-timeline
                >
                  {lookup.incident.updates.map((u) => (
                    <li key={u.id} className="py-3">
                      <p className="text-muted text-data">{formatTime(u.ts)}</p>
                      <p className="mt-1 max-w-(--spacing-prose)">{u.body}</p>
                    </li>
                  ))}
                </ol>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/ai?explain=${encodeURIComponent(`Explain incident ${lookup.incident.ticketNo}: "${lookup.incident.title}" on service ${lookup.incident.serviceName} (state: ${lookup.incident.state}).`)}`}
                  className="border-accent-ink/40 bg-surface text-accent-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors"
                >
                  <span aria-hidden="true">✨</span>
                  <span>Explain with Nexus AI</span>
                </Link>
              </div>

              {canManage ? (
                <div className="border-line border-t pt-6">
                  <UpdateIncidentForm
                    id={lookup.incident.id}
                    ticketNo={lookup.incident.ticketNo}
                    current={lookup.incident.state}
                    demo={demo}
                    defaultOpen
                  />
                </div>
              ) : null}
            </section>
          )}

          <section aria-labelledby="track-another-title" className="grid gap-4">
            <h2
              id="track-another-title"
              className="text-heading-3 font-semibold"
            >
              Track another ticket
            </h2>
            <IncidentTicketLookup
              defaultValue={lookup?.incident ? "" : normalized}
            />
            <div>
              <Link
                href="/status"
                className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
              >
                Back to Nexus Status
              </Link>
            </div>
          </section>

          <RelatedModules slugs={["command", "continuity", "atlas"]} />
        </div>
      </div>
    </PageTransition>
  );
}
