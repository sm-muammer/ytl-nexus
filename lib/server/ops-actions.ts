"use server";

import { z } from "zod";
import { OPS_MESSAGES, type OpsFormState } from "@/lib/ops/form-state";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import type { ActionContext, Refusal } from "@/lib/server/guards-core";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { callOps } from "@/lib/server/ops-client";

// Operator actions through the nexus-ops agent (requirements 9.11 and 9.12).
// Each one is a Server Function for Operators and above that validates its
// input, writes one audit event for the request before anything is sent, and
// lets the guard write one for the result, success or failure.
//
// The unit and check arrive as plain text on purpose. The agent is the authority
// on its allowlist, so a request for a unit it does not list is sent, refused
// there, and shows in the audit as a failed request for that name.

const unit = z
  .string()
  .regex(/^[\x21-\x7e]{1,64}$/, "unit must be 1 to 64 printable characters");

const restartInput = z.object({ unit });
const logsInput = z.object({ unit, lines: z.coerce.number().finite() });
const healthInput = z.object({ check: unit });

type Failure = { ok: false; error: keyof typeof FAILURE };

const FAILURE = {
  demo: OPS_MESSAGES.demo,
  unavailable: OPS_MESSAGES.unavailable,
  "invalid-request": OPS_MESSAGES.invalidRequest,
  "auth-failure": OPS_MESSAGES.authFailure,
  failed: OPS_MESSAGES.failed,
} as const;

/** The audit event for the request, written before the agent is called. */
async function auditRequest(
  ctx: ActionContext,
  action: string,
  target: string,
): Promise<void> {
  const identity = ctx.identity;
  await getAuthRuntime().audit({
    actorId: identity.kind === "user" ? identity.userId : null,
    role: identity.kind === "user" ? identity.role : null,
    action: `${action}.request`,
    target: target.slice(0, 255),
    result: "success",
    sourceIp: ctx.sourceIp,
  });
}

function message(result: Failure | Refusal): string {
  if (result.error in FAILURE) return FAILURE[result.error as Failure["error"]];
  switch (result.error) {
    case "invalid-input":
      return OPS_MESSAGES.invalidInput;
    case "forbidden":
    case "unauthenticated":
      return OPS_MESSAGES.forbidden;
    default:
      return OPS_MESSAGES.failed;
  }
}

const restart = guardAction(
  {
    id: "ops.restart",
    schema: restartInput,
    target: (i) => `unit:${i.unit}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    await auditRequest(ctx, "ops.restart", `unit:${input.unit}`);
    const result = await callOps({ op: "restart", unit: input.unit });
    if (!result.ok) return { ok: false as const, error: result.error };
    return { ok: true as const, unit: input.unit };
  },
);

export async function restartAction(
  _previous: OpsFormState,
  formData: FormData,
): Promise<OpsFormState> {
  const result = await restart({ unit: formData.get("unit") ?? undefined });
  return result.ok
    ? { done: "restart", unit: result.unit }
    : { error: message(result) };
}

const logs = guardAction(
  {
    id: "ops.logs",
    schema: logsInput,
    target: (i) => `unit:${i.unit}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    await auditRequest(ctx, "ops.logs", `unit:${input.unit}`);
    const result = await callOps({
      op: "logs",
      unit: input.unit,
      lines: input.lines,
    });
    if (!result.ok) return { ok: false as const, error: result.error };
    if (result.response.op !== "logs") {
      return { ok: false as const, error: "failed" as const };
    }
    return {
      ok: true as const,
      unit: input.unit,
      lines: result.response.lines,
      truncated: result.response.truncated,
    };
  },
);

export async function logsAction(
  _previous: OpsFormState,
  formData: FormData,
): Promise<OpsFormState> {
  const result = await logs({
    unit: formData.get("unit") ?? undefined,
    lines: formData.get("lines") ?? undefined,
  });
  return result.ok
    ? {
        done: "logs",
        unit: result.unit,
        lines: result.lines,
        truncated: result.truncated,
      }
    : { error: message(result) };
}

const health = guardAction(
  {
    id: "ops.health",
    schema: healthInput,
    target: (i) => `check:${i.check}`,
  },
  async (input, ctx) => {
    if (getMode() === "demo")
      return { ok: false as const, error: "demo" as const };
    await auditRequest(ctx, "ops.health", `check:${input.check}`);
    const result = await callOps({ op: "health", check: input.check });
    if (!result.ok) return { ok: false as const, error: result.error };
    if (result.response.op !== "health") {
      return { ok: false as const, error: "failed" as const };
    }
    const r = result.response;
    return {
      ok: true as const,
      check: r.check,
      state: r.state,
      latencyMs: r.latencyMs,
      detail: r.detail,
    };
  },
);

export async function healthAction(
  _previous: OpsFormState,
  formData: FormData,
): Promise<OpsFormState> {
  const result = await health({ check: formData.get("check") ?? undefined });
  return result.ok
    ? {
        done: "health",
        check: result.check,
        state: result.state,
        latencyMs: result.latencyMs,
        detail: result.detail,
      }
    : { error: message(result) };
}
