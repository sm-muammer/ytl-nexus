import "server-only";
import { headers } from "next/headers";
import type { Actor } from "@/lib/roles";
import { authIsConfigured, getAuthRuntime } from "@/lib/server/auth/runtime";
import { resolveIdentity } from "@/lib/server/auth/service";
import { identityToActor } from "@/lib/server/policy";
import type {
  AdapterName,
  AdapterStatus,
  Adapters,
  ServiceAdapter,
  AuthAdapter,
} from "./types";
import { ADAPTER_NAMES } from "./types";

// Live adapters. Task 3 fixed the switch; each module task replaces its stub
// with the real client (Task 7 wordpress, Task 8 prometheus, Task 9 ops, Task 12
// sftpgo, Task 13 mail, Task 14 ollama). The auth adapter is real since Task 6.
// None of them reads the demo cookie.

function notConnected(name: AdapterName): AdapterStatus {
  return {
    name,
    source: "live",
    state: "warn",
    label: "Not connected",
    detail: "The live connection for this service is not set up yet.",
  };
}

function stub(name: AdapterName): ServiceAdapter {
  return {
    name,
    source: "live",
    status: async () => notConnected(name),
  };
}

export function createLiveAdapters(): Adapters {
  const base = Object.fromEntries(
    ADAPTER_NAMES.map((name) => [name, stub(name)]),
  ) as Record<AdapterName, ServiceAdapter>;

  const auth: AuthAdapter = {
    name: "auth",
    source: "live",
    status: async (): Promise<AdapterStatus> =>
      authIsConfigured()
        ? {
            name: "auth",
            source: "live",
            state: "ok",
            label: "Ready",
            detail: "Sign-in is available.",
          }
        : {
            name: "auth",
            source: "live",
            state: "bad",
            label: "Not configured",
            detail: "The authentication settings are missing on the server.",
          },
    getActor: async (): Promise<Actor> => {
      // Headers first: see lib/server/identity.ts.
      const requestHeaders = await headers();
      const { identity } = await resolveIdentity(
        getAuthRuntime(),
        requestHeaders,
      );
      return identityToActor(identity);
    },
  };

  return { ...base, auth };
}
