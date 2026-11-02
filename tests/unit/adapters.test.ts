import net from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ADAPTER_NAMES,
  createAdapters,
  getAdapters,
} from "@/lib/server/adapters";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { ROLES } from "@/lib/roles";

const noCookie = async () => undefined;

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
    for (const name of ADAPTER_NAMES) {
      const status = await set[name].status();
      expect(status.source).toBe("live");
      expect(status.state).toBe("warn");
      expect(status.label).toBe("Not connected");
    }

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
  });

  it("ignore the demo cookie: nobody is signed in until Task 6", async () => {
    const set = createAdapters("live", { readDemoRole: async () => "admin" });
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
