import "server-only";
import type { Actor } from "@/lib/roles";
import type {
  AdapterName,
  AdapterStatus,
  Adapters,
  ServiceAdapter,
  AuthAdapter,
} from "./types";
import { ADAPTER_NAMES } from "./types";

// Live adapters. Task 3 only fixes the switch: none of them connects anywhere
// yet, and none reads the demo cookie. Each module task replaces its stub with
// the real client (Task 5 db, Task 6 auth, Task 7 wordpress, Task 8
// prometheus, Task 9 ops, Task 12 sftpgo, Task 13 mail, Task 14 ollama).

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
    ...base.auth,
    // Nobody can sign in until Task 6, so every request is a Visitor.
    getActor: async (): Promise<Actor> => null,
  };

  return { ...base, auth };
}
