import "server-only";
import { headers } from "next/headers";
import {
  EMPTY_PROFILE_META,
  demoProfileForRole,
  demoRequestsForUser,
  demoSessionsForUser,
  type OwnSessionDto,
  type UserProfileMeta,
  type UserRequestDto,
} from "@/lib/fixtures/account";
import { demoAuditEvents } from "@/lib/fixtures/audit";
import { demoControlUsers } from "@/lib/fixtures/control-users";
import type { Role } from "@/lib/roles";
import { listAuditEvents, type AuditEventDto } from "@/lib/server/audit";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import {
  listOwnSessions,
  listUserRequests,
  readUserProfileMeta,
  readUserSummary,
  resolveIdentity,
} from "@/lib/server/auth/service";
import { readOwnMailbox, type OwnMailboxView } from "@/lib/server/mail";
import { getMode } from "@/lib/server/mode";
import type { Identity } from "@/lib/server/policy";
import { readOwnAccount, type OwnAccountView } from "@/lib/server/transfer";

export type AccountSnapshot = {
  demo: boolean;
  user: {
    id: string;
    name: string;
    email: string;
    role: Role;
    twoFactorEnabled: boolean;
    createdAt: string;
  };
  profile: UserProfileMeta;
  requests: UserRequestDto[];
  sessions: OwnSessionDto[];
  transfer: OwnAccountView;
  mail: OwnMailboxView;
  auditEvents: AuditEventDto[];
};

export async function readOwnAccountSnapshot(
  identity: Extract<Identity, { kind: "user" }>,
): Promise<AccountSnapshot> {
  const demo = getMode() === "demo";

  if (demo) {
    const demoUser = demoControlUsers.find((u) => u.role === identity.role);
    const [transfer, mail] = await Promise.all([
      readOwnAccount(identity.userId),
      readOwnMailbox(identity.userId),
    ]);
    const ownEvents = demoAuditEvents.filter(
      (e) =>
        e.actorId === identity.userId ||
        e.target.includes(identity.userId) ||
        (demoUser?.email ? e.target.includes(demoUser.email) : false),
    );
    return {
      demo: true,
      user: {
        id: identity.userId,
        name: demoUser?.name ?? `Demo ${identity.role}`,
        email: demoUser?.email ?? `${identity.role}@example.com`,
        role: identity.role,
        twoFactorEnabled: identity.twoFactorEnabled,
        createdAt: "2026-10-20T03:00:00.000Z",
      },
      profile: demoProfileForRole(identity.role),
      requests: demoRequestsForUser(identity.userId),
      sessions: demoSessionsForUser(identity.role),
      transfer,
      mail,
      auditEvents: ownEvents.slice(0, 15),
    };
  }

  const rt = getAuthRuntime();
  const requestHeaders = await headers();
  const [resolved, summary, profile, requests, transfer, mail, rawEvents] =
    await Promise.all([
      resolveIdentity(rt, requestHeaders).catch(() => ({
        identity,
        session: null,
      })),
      readUserSummary(rt, identity.userId),
      readUserProfileMeta(rt, identity.userId).catch(() => EMPTY_PROFILE_META),
      listUserRequests(rt, identity.userId).catch(() => []),
      readOwnAccount(identity.userId),
      readOwnMailbox(identity.userId),
      listAuditEvents({ actorId: identity.userId }, 25).catch(() => []),
    ]);

  const currentSessionId = resolved.session?.id ?? null;
  const sessions = await listOwnSessions(
    rt,
    identity.userId,
    currentSessionId,
  ).catch(() => []);

  return {
    demo: false,
    user: summary ?? {
      id: identity.userId,
      name: resolved.session?.name ?? "Nexus User",
      email: resolved.session?.email ?? "",
      role: identity.role,
      twoFactorEnabled: identity.twoFactorEnabled,
      createdAt: new Date().toISOString(),
    },
    profile,
    requests,
    sessions,
    transfer,
    mail,
    auditEvents: rawEvents.filter((e) => e.actorId === identity.userId),
  };
}
