// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getLive } from "@/app/api/health/live/route";
import { GET as getReady } from "@/app/api/health/ready/route";
import { checkReadiness } from "@/lib/server/health";

describe("GET /api/health/live", () => {
  it("answers 200 with a minimal body and is never cached", async () => {
    const response = await getLive();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ status: "live" });
  });
});

describe("GET /api/health/ready", () => {
  beforeEach(() => {
    vi.stubEnv("NEXUS_MODE", "demo");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 200 when every configured check passes and is never cached", async () => {
    const response = await getReady();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = await response.json();
    expect(body.status).toBe("ready");
    // Honest data: demo mode has no database, so the check says so.
    expect(body.checks).toEqual({ app: "ok", database: "not-configured" });
  });

  it("exposes only check names and states, never versions, paths or secrets", async () => {
    const text = JSON.stringify(await (await getReady()).json());
    expect(text).not.toMatch(/\/|password|secret|token|version|NEXUS_/i);
  });
});

describe("GET /api/health/ready in live mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("answers 503 with an unavailable database when its settings are missing", async () => {
    vi.stubEnv("NEXUS_MODE", "live");
    vi.stubEnv("NEXUS_DB_USER", "");
    vi.stubEnv("NEXUS_DB_PASSWORD", "");
    const response = await getReady();
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.checks.database).toBe("unavailable");
    expect(JSON.stringify(body)).not.toMatch(/NEXUS_DB|password/i);
  });
});

describe("checkReadiness", () => {
  it("reports not ready, with a 503-worthy result, when a check is unavailable", async () => {
    const result = await checkReadiness({
      database: async () => "unavailable",
    });
    expect(result.ready).toBe(false);
    expect(result.checks.database).toBe("unavailable");
  });

  it("treats a check that throws as unavailable instead of failing the request", async () => {
    const result = await checkReadiness({
      database: async () => {
        throw new Error("connection refused at 127.0.0.1:3306");
      },
    });
    expect(result.ready).toBe(false);
    expect(result.checks.database).toBe("unavailable");
    expect(JSON.stringify(result)).not.toContain("127.0.0.1");
  });

  it("treats a check that takes longer than the timeout as unavailable", async () => {
    const result = await checkReadiness(
      { database: () => new Promise(() => {}) },
      { timeoutMs: 20 },
    );
    expect(result.ready).toBe(false);
    expect(result.checks.database).toBe("unavailable");
  });
});
