import type { Kysely } from "kysely";
import { z } from "zod";
import { AUDIT_RESULTS, ROLES, type Database } from "./schema.ts";

// Writes one row to the append-only audit trail. Input is validated before any
// statement runs (requirement 5.10); the values then travel as bound
// parameters, never as SQL text (5.9). Task 6 calls this for every
// authentication event and mutation.

export const auditEventInputSchema = z.object({
  actorId: z.string().min(1).max(64).nullable(),
  role: z.enum(ROLES).nullable(),
  action: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9][a-z0-9._:-]*$/i, "action must be a dotted identifier"),
  target: z.string().min(1).max(255),
  result: z.enum(AUDIT_RESULTS),
  sourceIp: z
    .string()
    .min(2)
    .max(45)
    .regex(/^[0-9a-fA-F:.]+$/, "not an IP address"),
});

export type AuditEventInput = z.input<typeof auditEventInputSchema>;

export async function recordAuditEvent(
  db: Kysely<Database>,
  input: AuditEventInput,
): Promise<void> {
  const event = auditEventInputSchema.parse(input);
  await db
    .insertInto("audit_events")
    .values({
      actor_id: event.actorId,
      role: event.role,
      action: event.action,
      target: event.target,
      result: event.result,
      source_ip: event.sourceIp,
    })
    .execute();
}
