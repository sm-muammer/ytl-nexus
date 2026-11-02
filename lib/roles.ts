// Role model shared by the server guards (Task 6) and the role-aware menu.
// Pure data and functions, safe to import from client components.

export const ROLES = ["viewer", "member", "operator", "admin"] as const;

export type Role = (typeof ROLES)[number];

/** `null` is a Visitor: nobody is signed in. */
export type Actor = { userId: string; role: Role } | null;

export const ROLE_RANK: Record<Role, number> = {
  viewer: 1,
  member: 2,
  operator: 3,
  admin: 4,
};

export const ROLE_LABEL: Record<Role, string> = {
  viewer: "Viewer",
  member: "Member",
  operator: "Operator",
  admin: "Administrator",
};

/**
 * True when the actor may see something that needs `min`.
 * `min === null` means public: a Visitor qualifies.
 */
export function meetsRole(actor: Actor, min: Role | null): boolean {
  if (min === null) return true;
  return actor !== null && ROLE_RANK[actor.role] >= ROLE_RANK[min];
}

/** Plain-language access level for a route or module, for labels and chips. */
export function accessLabel(min: Role | null): string {
  if (min === null) return "Public";
  return min === "admin" ? "Administrator" : `${ROLE_LABEL[min]} and above`;
}
