// Demo session fixtures (DEMO-06). A presenter picks a role; the choice lives
// in an HttpOnly cookie that only the demo auth adapter reads.

import { ROLES, type Actor, type Role } from "@/lib/roles";

export const DEMO_ROLE_COOKIE = "nexus-demo-role";

/** Strict parse: exact lower-case role names only. Anything else is a Visitor. */
export function parseDemoRole(value: string | undefined): Role | null {
  return ROLES.find((role) => role === value) ?? null;
}

export function demoActor(role: Role): Actor {
  return { userId: `demo-${role}`, role };
}
