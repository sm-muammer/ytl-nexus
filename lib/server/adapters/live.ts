import "server-only";
import { headers } from "next/headers";
import type { Actor } from "@/lib/roles";
import { authIsConfigured, getAuthRuntime } from "@/lib/server/auth/runtime";
import { resolveIdentity } from "@/lib/server/auth/service";
import { callOps } from "@/lib/server/ops-client";
import { identityToActor } from "@/lib/server/policy";
import {
  emptySnapshot,
  type HostInfo,
  type Snapshot,
} from "@/lib/monitoring/snapshot";
import { collectHost, collectSnapshot } from "@/lib/server/monitoring/collect";
import {
  createPrometheusClient,
  readPrometheusConfig,
  type PrometheusClient,
} from "@/lib/server/prometheus";
import type {
  AdapterName,
  AdapterStatus,
  Adapters,
  ServiceAdapter,
  AuthAdapter,
  PrometheusAdapter,
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

/** Poll interval of the live metrics poller; also what "stale" is measured in. */
export const LIVE_INTERVAL_MS = 5000;

export function createLivePrometheus(
  client: PrometheusClient = createPrometheusClient(readPrometheusConfig()),
  now: () => number = Date.now,
): PrometheusAdapter {
  return {
    name: "prometheus",
    source: "live",
    async status(): Promise<AdapterStatus> {
      try {
        const up = (await client.instant("node_up"))[0]?.value;
        return up === 1
          ? {
              name: "prometheus",
              source: "live",
              state: "ok",
              label: "Connected",
              detail: "Prometheus is collecting metrics from Nexus Core 01.",
            }
          : {
              name: "prometheus",
              source: "live",
              state: "warn",
              label: "No data",
              detail: "Prometheus answers but is not receiving server metrics.",
            };
      } catch {
        return {
          name: "prometheus",
          source: "live",
          state: "bad",
          label: "Unreachable",
          detail: "Prometheus does not answer.",
        };
      }
    },
    async snapshot(): Promise<Snapshot> {
      try {
        return await collectSnapshot(client, now(), LIVE_INTERVAL_MS);
      } catch {
        return emptySnapshot("live", now(), LIVE_INTERVAL_MS);
      }
    },
    async range(id, range) {
      try {
        return await client.range(id, range);
      } catch {
        return null;
      }
    },
    async host(): Promise<HostInfo> {
      return collectHost(client);
    },
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

  const ops: ServiceAdapter = {
    name: "ops",
    source: "live",
    status: async (): Promise<AdapterStatus> => {
      // A harmless health check proves the socket, the secret and the clock.
      const result = await callOps({ op: "health", check: "web" });
      if (result.ok) {
        return {
          name: "ops",
          source: "live",
          state: "ok",
          label: "Connected",
          detail: "The operations agent answers signed requests.",
        };
      }
      return {
        name: "ops",
        source: "live",
        state: result.error === "unavailable" ? "bad" : "warn",
        label: result.error === "unavailable" ? "Unreachable" : "Refused",
        detail:
          result.error === "unavailable"
            ? "The operations agent does not answer."
            : "The operations agent refused the request.",
      };
    },
  };
  return { ...base, auth, ops, prometheus: createLivePrometheus() };
}
