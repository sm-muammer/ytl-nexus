// Example accounts for the Control page in Demo_Mode (DEMO-01). They are not
// real people and nothing here is read from a database.

import type { Role } from "@/lib/roles";

export type DemoControlUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  twoFactorEnabled: boolean;
  activeSessions: number;
};

const make = (
  id: string,
  name: string,
  role: Role,
  sessions: number,
): DemoControlUser => ({
  id: `demo-${id}`,
  name,
  email: `${id}@example.com`,
  role,
  twoFactorEnabled: role === "operator" || role === "admin",
  activeSessions: sessions,
});

export const demoControlUsers: readonly DemoControlUser[] = [
  make("admin", "Demo Administrator", "admin", 1),
  make("operator", "Demo Operator", "operator", 0),
  make("member", "Demo Member", "member", 2),
  make("viewer", "Demo Viewer", "viewer", 0),
];
