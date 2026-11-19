"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  INCIDENT_MESSAGES,
  type IncidentFormState,
} from "@/lib/status/form-state";
import { incidentTrackingPath } from "@/lib/status/tickets";
import { INCIDENT_STATES } from "@/lib/status/types";
import { getDb } from "@/lib/server/db";
import { guardAction } from "@/lib/server/guards";
import { openIncident, updateIncident } from "@/lib/server/incidents";
import { getMode } from "@/lib/server/mode";
import { invalidateStatusCache } from "@/lib/server/status";

// Operators and Administrators open, update and resolve incidents (requirement
// 9.17). Each Server Function validates its input, changes the database in one
// transaction and writes one audit event naming the service or incident.
// Incident text is stored as plain text and rendered escaped.

const text = (min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    // Control characters other than tab and newline have no place in a notice.
    .refine((s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s));

const openInput = z.object({
  serviceSlug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  title: text(3, 200),
  body: text(1, 2000),
});

const updateInput = z.object({
  id: z.coerce.number().int().positive(),
  /** Empty keeps the current state. */
  state: z.union([z.enum(INCIDENT_STATES), z.literal("")]),
  body: text(1, 2000),
});

type Failure = "demo" | "not-found";

function message(error: Failure | string): string {
  switch (error) {
    case "demo":
      return INCIDENT_MESSAGES.demo;
    case "not-found":
      return INCIDENT_MESSAGES.notFound;
    case "invalid-input":
      return INCIDENT_MESSAGES.invalidInput;
    case "forbidden":
    case "unauthenticated":
      return INCIDENT_MESSAGES.forbidden;
    default:
      return INCIDENT_MESSAGES.failed;
  }
}

const open = guardAction(
  {
    id: "status.incident.open",
    schema: openInput,
    target: (i) => `service:${i.serviceSlug}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    const author = ctx.identity.kind === "user" ? ctx.identity.userId : null;
    const created = await openIncident(getDb(), input, author, new Date());
    if (!created) return { ok: false as const, error: "not-found" as const };
    invalidateStatusCache();
    revalidatePath("/status");
    revalidatePath(incidentTrackingPath(created.ticketNo));
    return { ok: true as const, id: created.id, ticketNo: created.ticketNo };
  },
);

export async function openIncidentAction(
  _previous: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  const result = await open({
    serviceSlug: formData.get("serviceSlug") ?? undefined,
    title: formData.get("title") ?? undefined,
    body: formData.get("body") ?? undefined,
  });
  return result.ok
    ? { done: "opened", id: result.id, ticketNo: result.ticketNo }
    : { error: message(result.error) };
}

const update = guardAction(
  {
    id: "status.incident.update",
    schema: updateInput,
    target: (i) => `incident:${i.id}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    const author = ctx.identity.kind === "user" ? ctx.identity.userId : null;
    const updated = await updateIncident(getDb(), input, author, new Date());
    if (!updated) return { ok: false as const, error: "not-found" as const };
    invalidateStatusCache();
    revalidatePath("/status");
    revalidatePath(incidentTrackingPath(updated.ticketNo));
    return { ok: true as const, id: updated.id, ticketNo: updated.ticketNo };
  },
);

export async function updateIncidentAction(
  _previous: IncidentFormState,
  formData: FormData,
): Promise<IncidentFormState> {
  const result = await update({
    id: formData.get("id") ?? undefined,
    state: formData.get("state") ?? undefined,
    body: formData.get("body") ?? undefined,
  });
  return result.ok
    ? { done: "updated", id: result.id, ticketNo: result.ticketNo }
    : { error: message(result.error) };
}
