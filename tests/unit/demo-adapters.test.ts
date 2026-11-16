// @vitest-environment node
import net from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADAPTER_NAMES, createAdapters } from "@/lib/server/adapters";
import { getShieldView } from "@/lib/server/shield";
import { getContinuityView } from "@/lib/server/continuity";
import { listContent } from "@/lib/server/content";
import { getPage } from "@/lib/server/data";
import { parseListQuery } from "@/lib/data/query";
import { getStatusView } from "@/lib/server/status";
import { getAtlas } from "@/lib/server/atlas";
import { readAllAccounts } from "@/lib/server/transfer";
import { readAllMailboxes } from "@/lib/server/mail";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";

// Requirement DEMO-05: Demo mode never performs outbound calls to live adapters or network sockets.
// Enforced across all adapters and server data fetchers.

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === DEMO_ROLE_COOKIE ? { value: "admin" } : undefined,
  }),
  headers: async () => new Headers(),
}));

describe("Demo Mode adapter and socket isolation (DEMO-05)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXUS_MODE", "demo");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("never invokes fetch, net.connect, or net.Socket.prototype.connect on adapters", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const connectSpy = vi.spyOn(net, "connect");
    const socketSpy = vi.spyOn(net.Socket.prototype, "connect");

    const adapters = createAdapters("demo", {
      readDemoRole: async () => "admin",
    });
    for (const name of ADAPTER_NAMES) {
      const status = await adapters[name].status();
      expect(status.source).toBe("demo");
    }

    await adapters.auth.getActor();
    await adapters.prometheus.snapshot();
    await adapters.prometheus.host();
    await adapters.prometheus.range("cpu_used_pct", "1h");

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
  });

  it("never makes network or live database calls across core module read helpers in demo mode", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const connectSpy = vi.spyOn(net, "connect");
    const socketSpy = vi.spyOn(net.Socket.prototype, "connect");

    const adminActor = { userId: "demo-admin", role: "admin" as const };

    // Shield
    const shield = await getShieldView();
    expect(shield.totalChecks).toBeGreaterThan(0);

    // Continuity
    const continuity = await getContinuityView(adminActor);
    expect(continuity.components.length).toBeGreaterThan(0);

    // Content (WordPress)
    const runbooks = await listContent("runbook", adminActor);
    expect(runbooks.ok).toBe(true);
    if (runbooks.ok) {
      expect(runbooks.source).toBe("demo");
    }

    const tourSteps = await listContent("tour_step", adminActor);
    expect(tourSteps.ok).toBe(true);

    const storyChapters = await listContent("story_chapter", adminActor);
    expect(storyChapters.ok).toBe(true);

    // Data (MariaDB)
    const parsed = parseListQuery({ table: "data_sites" });
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      const data = await getPage(parsed.query);
      expect(data.source).toBe("demo");
    }

    // Status
    const status = await getStatusView(adminActor);
    expect(status.source).toBe("demo");

    // Atlas
    const atlas = await getAtlas(adminActor);
    expect(atlas).not.toBeNull();
    expect(atlas?.nodes.length).toBeGreaterThan(0);

    // Transfer (SFTPGo)
    const transfer = await readAllAccounts();
    expect(transfer.state).toBe("ready");
    if (transfer.state === "ready") {
      expect(transfer.accounts.length).toBeGreaterThan(0);
    }

    // Mail
    const mail = await readAllMailboxes();
    expect(mail.state).toBe("ready");
    if (mail.state === "ready") {
      expect(mail.accounts.length).toBeGreaterThan(0);
    }

    // Assert that no sockets or HTTP fetches were attempted
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(connectSpy).not.toHaveBeenCalled();
    expect(socketSpy).not.toHaveBeenCalled();
  });
});
