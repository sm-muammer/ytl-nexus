import "server-only";
import {
  DEMO_TRANSFER_HOST,
  demoTransferAccounts,
} from "@/lib/fixtures/transfer";
import type { DataSource } from "@/lib/server/adapters/types";
import { getMode } from "@/lib/server/mode";
import { createSftpgoClient, readSftpgoConfig } from "@/lib/server/sftpgo";
import { ownAccount } from "@/lib/transfer/ownership";
import type { TransferAccount } from "@/lib/transfer/types";

// The two readers behind Nexus Transfer. /transfer uses `readOwnAccount`, which
// takes the session's user id and nothing else, so a Member can only ever get
// their own account (requirements 12.17 and 12.18). Control uses
// `readAllAccounts`, behind the Administrator guard.

export type OwnAccountView =
  | {
      state: "ready";
      source: DataSource;
      host: string;
      account: TransferAccount;
    }
  | { state: "no-account"; source: DataSource; host: string }
  | { state: "unavailable"; source: DataSource; host: string };

export type AllAccountsView =
  | {
      state: "ready";
      source: DataSource;
      host: string;
      accounts: TransferAccount[];
    }
  | { state: "unavailable"; source: DataSource; host: string };

/** The name users type into their client. */
export function transferHost(
  env: Record<string, string | undefined> = process.env,
): string {
  if (env.NEXUS_SFTPGO_HOST) return env.NEXUS_SFTPGO_HOST;
  try {
    if (env.BETTER_AUTH_URL) return new URL(env.BETTER_AUTH_URL).hostname;
  } catch {
    // fall through to the project name
  }
  return "ytl-nexus.ytlcomms.my";
}

function liveClient() {
  const config = readSftpgoConfig();
  return config ? createSftpgoClient(config) : null;
}

export async function readOwnAccount(userId: string): Promise<OwnAccountView> {
  if (getMode() === "demo") {
    const account = ownAccount(demoTransferAccounts, userId);
    return account
      ? { state: "ready", source: "demo", host: DEMO_TRANSFER_HOST, account }
      : { state: "no-account", source: "demo", host: DEMO_TRANSFER_HOST };
  }
  const host = transferHost();
  const client = liveClient();
  if (!client) return { state: "unavailable", source: "live", host };
  try {
    const account = ownAccount(await client.listAccounts(), userId);
    return account
      ? { state: "ready", source: "live", host, account }
      : { state: "no-account", source: "live", host };
  } catch {
    return { state: "unavailable", source: "live", host };
  }
}

export async function readAllAccounts(): Promise<AllAccountsView> {
  if (getMode() === "demo") {
    return {
      state: "ready",
      source: "demo",
      host: DEMO_TRANSFER_HOST,
      accounts: demoTransferAccounts,
    };
  }
  const host = transferHost();
  const client = liveClient();
  if (!client) return { state: "unavailable", source: "live", host };
  try {
    return {
      state: "ready",
      source: "live",
      host,
      accounts: await client.listAccounts(),
    };
  } catch {
    return { state: "unavailable", source: "live", host };
  }
}
