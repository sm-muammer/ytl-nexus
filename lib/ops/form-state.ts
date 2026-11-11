import type { ProbeState } from "./probes.ts";

// Shapes the Operator forms exchange with their Server Functions. Types and
// messages only, so client components can import them. Messages are written for
// the person at the keyboard and never carry a path, host or system error.

export type OpsFormState =
  | null
  | { error: string }
  | { done: "restart"; unit: string }
  | { done: "logs"; unit: string; lines: string[]; truncated: boolean }
  | {
      done: "health";
      check: string;
      state: ProbeState;
      latencyMs: number | null;
      detail: string;
    };

export const OPS_MESSAGES = {
  demo: "This is a demo session. Operations controls are disabled and nothing was run.",
  unavailable:
    "The operations agent does not answer. Nothing was changed. Check that the nexus-ops service is running.",
  invalidRequest:
    "The operations agent refused this request. That unit or check is not on its allowlist.",
  authFailure:
    "The operations agent did not accept the request signature. Nothing was changed.",
  failed: "The request failed. Nothing was changed.",
  invalidInput: "Check the form and try again.",
  forbidden: "You do not have access to do that.",
} as const;
