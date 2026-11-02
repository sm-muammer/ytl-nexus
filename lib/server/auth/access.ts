import { createAccessControl } from "better-auth/plugins/access";
import { ROLES } from "../../roles.ts";

// What each role may do through Better Auth's admin plugin. Operators and below
// have no administration rights. The Administrator can do everything except
// impersonate: the "impersonate" and "impersonate-admins" permissions exist in
// the statement (the plugin checks for them) but no role holds them, so
// requirement 6.12 holds even if someone re-enables the endpoint.

const statement = {
  user: [
    "create",
    "list",
    "set-role",
    "ban",
    "impersonate",
    "impersonate-admins",
    "delete",
    "set-password",
    "set-email",
    "get",
    "update",
  ],
  session: ["list", "revoke", "delete"],
} as const;

export const ac = createAccessControl(statement);

export const roles = {
  viewer: ac.newRole({ user: [], session: [] }),
  member: ac.newRole({ user: [], session: [] }),
  operator: ac.newRole({ user: [], session: [] }),
  admin: ac.newRole({
    user: [
      "create",
      "list",
      "set-role",
      "ban",
      "delete",
      "set-password",
      "get",
      "update",
    ],
    session: ["list", "revoke", "delete"],
  }),
};

/** Keeps the role map and the application's role list from drifting apart. */
export const ROLE_NAMES = ROLES;
