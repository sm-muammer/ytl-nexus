import "server-only";
import { adapterStatusFixtures } from "@/lib/fixtures/adapter-status";
import { demoActor, parseDemoRole } from "@/lib/fixtures/session";
import type { Actor } from "@/lib/roles";
import type {
  AdapterDeps,
  AdapterName,
  Adapters,
  AuthAdapter,
  ServiceAdapter,
} from "./types";
import { ADAPTER_NAMES } from "./types";

// Demo adapters read fixtures only. They import no client library and open no
// socket, which is what makes `NEXUS_MODE=demo` safe with the network off
// (DEMO-04, DEMO-05). tests/unit/adapters.test.ts enforces it.

function fixtureAdapter(name: AdapterName): ServiceAdapter {
  return {
    name,
    source: "demo",
    status: async () => {
      const f = adapterStatusFixtures[name];
      return { name, source: "demo", ...f };
    },
  };
}

export function createDemoAdapters(deps: AdapterDeps): Adapters {
  const base = Object.fromEntries(
    ADAPTER_NAMES.map((name) => [name, fixtureAdapter(name)]),
  ) as Record<AdapterName, ServiceAdapter>;

  const auth: AuthAdapter = {
    ...base.auth,
    getActor: async (): Promise<Actor> => {
      const role = parseDemoRole(await deps.readDemoRole());
      return role === null ? null : demoActor(role);
    },
  };

  return { ...base, auth };
}
