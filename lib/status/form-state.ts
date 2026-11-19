// Shapes the incident forms exchange with their Server Functions. Types and
// messages only, so client components can import them.

export type IncidentFormState =
  | null
  | { error: string }
  | { done: "opened" | "updated"; id: number; ticketNo: string };

export const INCIDENT_MESSAGES = {
  demo: "This is a demo session. Nothing was saved.",
  invalidInput: "Check the form and try again.",
  notFound: "That service or incident does not exist.",
  forbidden: "You do not have access to do that.",
  failed: "Something went wrong. Nothing was saved.",
} as const;
