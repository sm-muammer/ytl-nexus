// Shared account profile, self-service request, and session types & demo fixtures.
// Client-safe: contains no database or server secrets.

import type { Role } from "../roles.ts";

export const USER_REQUEST_CATEGORIES = [
  "role-upgrade",
  "sftp-provision",
  "sftp-quota",
  "sftp-key",
  "mail-provision",
  "mail-quota",
  "password-reset-subsystems",
  "general",
] as const;

export type UserRequestCategory = (typeof USER_REQUEST_CATEGORIES)[number];

export const USER_REQUEST_CATEGORY_LABEL: Record<UserRequestCategory, string> =
  {
    "role-upgrade": "Role / Stage Promotion",
    "sftp-provision": "SFTP Account Provisioning",
    "sftp-quota": "SFTP Quota Increase",
    "sftp-key": "Register SSH Public Key",
    "mail-provision": "Internal Mailbox Provisioning",
    "mail-quota": "Mailbox Quota Increase",
    "password-reset-subsystems": "SFTP / Mailbox Password Reset",
    general: "General Access / Operational Request",
  };

export type UserRequestStatus = "pending" | "approved" | "dismissed";

export type UserProfileMeta = {
  jobTitle: string;
  department: string;
  phone: string;
  sshPublicKey: string;
  bio: string;
  updatedAt: string | null;
};

export const EMPTY_PROFILE_META: UserProfileMeta = {
  jobTitle: "",
  department: "",
  phone: "",
  sshPublicKey: "",
  bio: "",
  updatedAt: null,
};

export type UserRequestDto = {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userRole: Role;
  category: UserRequestCategory;
  title: string;
  requestedRole?: Role;
  requestedQuotaMb?: number;
  sshPublicKey?: string;
  reason: string;
  status: UserRequestStatus;
  createdAt: string;
  updatedAt: string;
  resolvedBy?: string | null;
  resolutionNote?: string | null;
};

export type OwnSessionDto = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  current: boolean;
};

const DEMO_PROFILES: Record<Role, UserProfileMeta> = {
  viewer: {
    jobTitle: "IT Audit Observer",
    department: "Risk & Assurance",
    phone: "+60 3-2099 8800",
    sshPublicKey: "",
    bio: "Read-only observer reviewing Nexus Core 01 telemetry, Atlas topology, and service uptime.",
    updatedAt: "2026-11-15T09:00:00.000Z",
  },
  member: {
    jobTitle: "Network Systems Engineer",
    department: "IT Infrastructure",
    phone: "+60 3-2099 8812",
    sshPublicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoMemberKeyLaptop",
    bio: "Core routing & internal transfer pilot member. Uses Nexus AI runbooks, SFTPGo, and internal webmail.",
    updatedAt: "2026-11-16T08:15:00.000Z",
  },
  operator: {
    jobTitle: "Infrastructure Operations Specialist",
    department: "IT Infrastructure",
    phone: "+60 3-2099 8824",
    sshPublicKey:
      "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoOperatorWorkstation",
    bio: "Responsible for Nexus Core 01 service restarts, Continuity restore reviews, Shield findings triage, and incident response.",
    updatedAt: "2026-11-17T04:30:00.000Z",
  },
  admin: {
    jobTitle: "Platform Lead Administrator",
    department: "IT Infrastructure",
    phone: "+60 3-2099 8801",
    sshPublicKey: "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDemoAdminPrimary",
    bio: "Primary platform custodian managing identity, SFTPGo, mailboxes, Nexus Ops controls, and audit governance.",
    updatedAt: "2026-11-17T10:00:00.000Z",
  },
};

export function demoProfileForRole(role: Role): UserProfileMeta {
  return DEMO_PROFILES[role];
}

export const demoAllUserRequests: readonly UserRequestDto[] = [
  {
    id: "req-demo-1",
    userId: "demo-member",
    userEmail: "member@example.com",
    userName: "Demo Member",
    userRole: "member",
    category: "role-upgrade",
    title: "Promote to Stage 2 (Operator) for night-shift incident triage",
    requestedRole: "operator",
    reason:
      "Need read access to Nexus Shield findings and ability to inspect bounded unit logs during on-call rotations.",
    status: "pending",
    createdAt: "2026-11-17T07:30:00.000Z",
    updatedAt: "2026-11-17T07:30:00.000Z",
  },
  {
    id: "req-demo-2",
    userId: "demo-operator",
    userEmail: "operator@example.com",
    userName: "Demo Operator",
    userRole: "operator",
    category: "sftp-quota",
    title: "Expand SFTP storage quota from 5 GB to 10 GB",
    requestedQuotaMb: 10240,
    reason:
      "Staging full Continuity restore archive bundles and MariaDB snapshot verifications.",
    status: "pending",
    createdAt: "2026-11-17T09:15:00.000Z",
    updatedAt: "2026-11-17T09:15:00.000Z",
  },
  {
    id: "req-demo-3",
    userId: "demo-member",
    userEmail: "member@example.com",
    userName: "Demo Member",
    userRole: "member",
    category: "mail-provision",
    title: "Internal mailbox setup for pilot notifications",
    reason: "Required to receive internal Roundcube alerts and test mail.",
    status: "approved",
    createdAt: "2026-11-14T04:00:00.000Z",
    updatedAt: "2026-11-14T06:20:00.000Z",
    resolvedBy: "admin@example.com",
    resolutionNote: "Provisioned demo-member@ytl-nexus.internal with 512 MiB.",
  },
  {
    id: "req-demo-4",
    userId: "demo-viewer",
    userEmail: "viewer@example.com",
    userName: "Demo Viewer",
    userRole: "viewer",
    category: "general",
    title: "Request temporary access to Nexus Data change history",
    reason: "Reviewing Q4 site inventory audit spreadsheet.",
    status: "pending",
    createdAt: "2026-11-18T02:10:00.000Z",
    updatedAt: "2026-11-18T02:10:00.000Z",
  },
];

export function demoRequestsForUser(userId: string): UserRequestDto[] {
  return demoAllUserRequests.filter((r) => r.userId === userId);
}

export function demoSessionsForUser(role: Role): OwnSessionDto[] {
  return [
    {
      id: `demo-sess-${role}-1`,
      ipAddress: "10.26.64.25",
      userAgent: "Mozilla/5.0 (Macintosh; Apple Silicon Mac OS X)",
      createdAt: "2026-11-18T07:00:00.000Z",
      updatedAt: "2026-11-18T08:05:00.000Z",
      expiresAt: "2026-11-18T19:00:00.000Z",
      current: true,
    },
    ...(role === "member" || role === "admin"
      ? [
          {
            id: `demo-sess-${role}-2`,
            ipAddress: "10.26.64.42",
            userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            createdAt: "2026-11-18T05:10:00.000Z",
            updatedAt: "2026-11-18T06:40:00.000Z",
            expiresAt: "2026-11-18T17:10:00.000Z",
            current: false,
          },
        ]
      : []),
  ];
}
