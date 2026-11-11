import type { TransferAccount } from "@/lib/transfer/types";

// Sample accounts for Demo_Mode (requirement 12.22). Invented: the names, sizes
// and key fingerprints refer to nothing real, and the demo session has no
// account of its own, so the signed-in demo user is given the first one.

export const DEMO_TRANSFER_HOST = "ytl-nexus.example";

const MIB = 1024 * 1024;

export const demoTransferAccounts: TransferAccount[] = [
  {
    username: "demo-member",
    enabled: true,
    nexusUserId: "demo-member",
    quotaBytes: 2048 * MIB,
    usedBytes: 412 * MIB,
    usedFiles: 37,
    keys: [
      {
        fingerprint: "SHA256:Zm9yLWRlbW8tb25seS1ub3QtYS1yZWFsLWtleS0wMDE",
        type: "ssh-ed25519",
        comment: "laptop",
      },
      {
        fingerprint: "SHA256:c2FtcGxlLWZpbmdlcnByaW50LWZvci10aGUtZGVtby0wMg",
        type: "ssh-rsa",
        comment: "workstation",
      },
    ],
    lastLoginAt: "2026-11-10T08:42:00.000Z",
    createdAt: "2026-10-20T03:00:00.000Z",
  },
  {
    username: "demo-operator",
    enabled: true,
    nexusUserId: "demo-operator",
    quotaBytes: 5120 * MIB,
    usedBytes: 3900 * MIB,
    usedFiles: 214,
    keys: [],
    lastLoginAt: "2026-11-11T01:15:00.000Z",
    createdAt: "2026-10-20T03:05:00.000Z",
  },
  {
    username: "demo-archive",
    enabled: false,
    nexusUserId: null,
    quotaBytes: 0,
    usedBytes: 120 * MIB,
    usedFiles: 9,
    keys: [],
    lastLoginAt: null,
    createdAt: "2026-10-22T03:00:00.000Z",
  },
];
