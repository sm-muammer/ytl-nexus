import "server-only";
import { cookies } from "next/headers";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { getMode, type NexusMode } from "@/lib/server/mode";
import { createDemoAdapters } from "./demo";
import { createLiveAdapters } from "./live";
import type { AdapterDeps, Adapters } from "./types";

export { ADAPTER_NAMES } from "./types";
export type {
  AdapterDeps,
  AdapterName,
  AdapterStatus,
  Adapters,
  DataSource,
} from "./types";

/** Builds the adapter set for a mode. Pure apart from what `deps` reads. */
export function createAdapters(mode: NexusMode, deps: AdapterDeps): Adapters {
  return mode === "demo" ? createDemoAdapters(deps) : createLiveAdapters();
}

const requestDeps: AdapterDeps = {
  readDemoRole: async () => (await cookies()).get(DEMO_ROLE_COOKIE)?.value,
};

const sets = new Map<NexusMode, Adapters>();

/**
 * The adapters for this process. Chosen from NEXUS_MODE and then reused, so
 * every caller sees the same set. Demo adapters never open a connection.
 */
export function getAdapters(): Adapters {
  const mode = getMode();
  let set = sets.get(mode);
  if (!set) {
    set = createAdapters(mode, requestDeps);
    sets.set(mode, set);
  }
  return set;
}
