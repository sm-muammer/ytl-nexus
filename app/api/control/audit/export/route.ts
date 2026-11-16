import {
  auditEventsToCsv,
  auditFiltersSchema,
  listAuditEvents,
} from "@/lib/server/audit";
import { guardHandler } from "@/lib/server/guards";
import { policyForHandler } from "@/lib/server/policy";

// CSV export of audit events (requirement CTL-07).
// Administrator-only with fresh Step_Up. Formula injection protected.

export const dynamic = "force-dynamic";

const ID = "control.audit.export";

export const GET = guardHandler(
  { id: ID, requirement: policyForHandler(ID) },
  async (request) => {
    const url = new URL(request.url);
    const parsed = auditFiltersSchema.safeParse(
      Object.fromEntries(url.searchParams),
    );
    if (!parsed.success) {
      return Response.json({ error: "invalid-input" }, { status: 400 });
    }

    try {
      const events = await listAuditEvents(parsed.data, 1000);
      const csv = auditEventsToCsv(events);
      const filename = `nexus-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      return new Response(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
        },
      });
    } catch {
      return Response.json({ error: "unavailable" }, { status: 503 });
    }
  },
);
