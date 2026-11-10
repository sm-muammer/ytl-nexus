import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Identity } from "@/lib/server/policy";
import {
  ADAPTER_NAMES,
  createAdapters,
  getAdapters,
} from "@/lib/server/adapters";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { ROLES } from "@/lib/roles";
import { createLivePrometheus } from "@/lib/server/adapters/live";
import type { PrometheusClient } from "@/lib/server/prometheus";

const noCookie = async () => undefined;

// The live auth adapter reads the Better Auth session. These doubles stand in
// for the request headers and the session store, so no database is involved.
let liveIdentity: Identity = { kind: "visitor" };
let configured = false;
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/server/auth/runtime", () => ({
  getAuthRuntime: () => ({}),
  authIsConfigured: () => configured,
}));
vi.mock("@/lib/server/auth/service", () => ({
  resolveIdentity: async () => ({ identity: liveIdentity, session: null }),
}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("adapter set", () => {
  it("covers the eight server adapters from the design", () => {
    expect([...ADAPTER_NAMES].sort()).toEqual(
      [
        "auth",
        "db",
        "mail",
        "ollama",
        "ops",
        "prometheus",
        "sftpgo",
        "wordpress",
      ].sort(),
    );
  });

  it.each(["live", "demo"] as const)(
    "%s mode provides every adapter with the matching source",
    (mode) => {
      const set = createAdapters(mode, { readDemoRole: noCookie });
      for (const name of ADAPTER_NAMES) {
        expect(set[name].name).toBe(name);
        expect(set[name].source).toBe(mode);
      }
    },
  );
});

describe("demo adapters (Demo_Mode)", () => {
  it("return deterministic fixture statuses labelled as demo", async () => {
    const set = createAdapters("demo", { readDemoRole: noCookie });
    for (const name of ADAPTER_NAMES) {
      const first = await set[name].status();
      const second = await set[name].status();
      expect(first).toEqual(second);
      expect(first.source).toBe("demo");
      expect(first.name).toBe(name);
      expect(first.detail.length).toBeGreaterThan(0);
    }
  });

  it("make no network or socket call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const connectSpy = vi.spyOn(net, "connect");
    const socketSpy = vi.spyOn(net.Socket.prototype, "connect");

    const set = createAdapters("demo", { readDemoRole: noCookie });
    for (const name of ADAPTER_NAMES) await set[name].status();
    await set.auth.getActor();

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
  });

  it.each(ROLES)(
    "auth reads the %s demo session from the cookie",
    async (r) => {
      const set = createAdapters("demo", { readDemoRole: async () => r });
      expect(await set.auth.getActor()).toEqual({
        userId: `demo-${r}`,
        role: r,
      });
    },
  );

  it.each([undefined, "", "root", "ADMIN", "visitor", "admin "])(
    "auth treats %j as a Visitor",
    async (value) => {
      const set = createAdapters("demo", { readDemoRole: async () => value });
      expect(await set.auth.getActor()).toBeNull();
    },
  );

  it("names the cookie used by the demo session", () => {
    expect(DEMO_ROLE_COOKIE).toBe("nexus-demo-role");
  });
});

describe("live adapters (Live_Mode)", () => {
  it("report that they are not connected yet, without calling the network", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const connectSpy = vi.spyOn(net, "connect");

    const set = createAdapters("live", { readDemoRole: noCookie });
    // auth is real since Task 6 and prometheus since Task 8 (own tests below).
    for (const name of ADAPTER_NAMES.filter(
      (n) => n !== "auth" && n !== "prometheus",
    )) {
      const status = await set[name].status();
      expect(status.source).toBe("live");
      expect(status.state).toBe("warn");
      expect(status.label).toBe("Not connected");
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("report the Prometheus adapter from its answers, and never throw when it is down", async () => {
    const answer = (value: string) =>
      ({
        instant: async () => [{ labels: {}, value: Number(value) }],
        range: async () => [],
      }) as unknown as PrometheusClient;
    expect((await createLivePrometheus(answer("1")).status()).state).toBe("ok");
    expect((await createLivePrometheus(answer("0")).status()).state).toBe(
      "warn",
    );

    const down = {
      instant: async () => {
        throw new Error("ECONNREFUSED");
      },
      range: async () => {
        throw new Error("ECONNREFUSED");
      },
    } as unknown as PrometheusClient;
    const adapter = createLivePrometheus(down, () => 42);
    expect(await adapter.status()).toMatchObject({
      source: "live",
      state: "bad",
      label: "Unreachable",
    });
    const snap = await adapter.snapshot();
    expect(snap).toMatchObject({
      reachable: false,
      takenAt: 42,
      source: "live",
    });
    expect(snap.services.every((s) => s.state === "unknown")).toBe(true);
    expect(await adapter.range("cpu_used_pct", "1h")).toBeNull();
  });

  it("report the auth adapter as configured or not, without a connection", async () => {
    const connectSpy = vi.spyOn(net, "connect");
    const set = createAdapters("live", { readDemoRole: noCookie });
    configured = false;
    expect(await set.auth.status()).toMatchObject({
      source: "live",
      state: "bad",
      label: "Not configured",
    });
    configured = true;
    expect(await set.auth.status()).toMatchObject({ state: "ok" });
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("ignore the demo cookie: the actor comes from the Better Auth session only", async () => {
    const readDemoRole = vi.fn(async () => "admin");
    const set = createAdapters("live", { readDemoRole });
    liveIdentity = { kind: "visitor" };
    expect(await set.auth.getActor()).toBeNull();
    liveIdentity = {
      kind: "user",
      userId: "u1",
      role: "operator",
      twoFactorEnabled: true,
      stepUpAt: null,
    };
    expect(await set.auth.getActor()).toEqual({
      userId: "u1",
      role: "operator",
    });
    expect(readDemoRole).not.toHaveBeenCalled();
  });

  it("does not treat an unenrolled Operator as signed in", async () => {
    const set = createAdapters("live", { readDemoRole: noCookie });
    liveIdentity = {
      kind: "user",
      userId: "u2",
      role: "operator",
      twoFactorEnabled: false,
      stepUpAt: null,
    };
    expect(await set.auth.getActor()).toBeNull();
  });
});

describe("getAdapters", () => {
  it("selects the set from NEXUS_MODE and reuses it", () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    const a = getAdapters();
    expect(a.db.source).toBe("demo");
    expect(getAdapters()).toBe(a);

    vi.stubEnv("NEXUS_MODE", "live");
    const b = getAdapters();
    expect(b.db.source).toBe("live");
    expect(b).not.toBe(a);
  });

  it("refuses an invalid NEXUS_MODE", () => {
    vi.stubEnv("NEXUS_MODE", "staging");
    expect(() => getAdapters()).toThrowError(/NEXUS_MODE/);
  });
});
