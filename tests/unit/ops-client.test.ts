// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { fakeSecret } from "../helpers/fake-secret";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { signEnvelope } from "@/lib/ops/protocol";
import { callOps, readOpsConfig } from "@/lib/server/ops-client";
import { createAgent, type Runner } from "@/services/ops-agent/agent";
import { createOpsServer } from "@/services/ops-agent/server";

// The web client talking to the real agent HTTP layer over a real Unix socket,
// with the system runner replaced.

const SECRET = fakeSecret("client");
let dir: string;
let socketPath: string;
let server: Server;
const runner: Runner = {
  restart: vi.fn(async () => {}),
  logs: vi.fn(async () => "first line\npassword=hunter22\nfrom 10.26.64.164\n"),
  probe: vi.fn(async () => ({
    state: "healthy" as const,
    latencyMs: 3,
    detail: "Answered",
  })),
};

beforeAll(async () => {
  dir = mkdtempSync(path.join(tmpdir(), "nexus-ops-"));
  socketPath = path.join(dir, "ops.sock");
  server = createOpsServer(
    createAgent({
      secret: SECRET,
      redact: { ipRanges: ["10.0.0.0/8"], secrets: [SECRET] },
      runner,
      now: () => Date.now(),
      log: () => {},
    }),
  );
  await new Promise<void>((resolve) => server.listen(socketPath, resolve));
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(dir, { recursive: true, force: true });
});

const cfg = () => ({ secret: SECRET, socketPath });

describe("callOps", () => {
  it("restarts an allowlisted unit", async () => {
    const result = await callOps(
      { op: "restart", unit: "nexus-worker" },
      { config: cfg() },
    );
    expect(result).toEqual({
      ok: true,
      response: {
        ok: true,
        op: "restart",
        unit: "nexus-worker",
        accepted: true,
      },
    });
    expect(runner.restart).toHaveBeenCalledWith("nexus-worker");
  });

  it("gets sanitized log lines", async () => {
    const result = await callOps(
      { op: "logs", unit: "nexus-web", lines: 20 },
      { config: cfg() },
    );
    expect(result.ok).toBe(true);
    const text = JSON.stringify(result);
    expect(text).toContain("first line");
    expect(text).not.toContain("hunter22");
    expect(text).not.toContain("10.26.64.164");
  });

  it("refuses a disallowed unit and runs nothing", async () => {
    vi.mocked(runner.restart).mockClear();
    for (const unit of ["sshd", "mariadb", "../sshd", "nexus-web@x"]) {
      const result = await callOps({ op: "restart", unit }, { config: cfg() });
      expect(result).toEqual({ ok: false, error: "invalid-request" });
    }
    expect(runner.restart).not.toHaveBeenCalled();
  });

  it("is refused with the wrong secret", async () => {
    const result = await callOps(
      { op: "restart", unit: "nexus-web" },
      {
        config: {
          secret: fakeSecret("other"),
          socketPath,
        },
      },
    );
    expect(result).toEqual({ ok: false, error: "auth-failure" });
  });

  it("is refused when the clocks differ by more than 30 seconds", async () => {
    const result = await callOps(
      { op: "health", check: "web" },
      { config: cfg(), now: () => Date.now() - 31_000 },
    );
    expect(result).toEqual({ ok: false, error: "auth-failure" });
  });

  it("is unavailable, without throwing, when there is no socket or no secret", async () => {
    expect(
      await callOps(
        { op: "health", check: "web" },
        { config: { secret: SECRET, socketPath: path.join(dir, "none.sock") } },
      ),
    ).toEqual({ ok: false, error: "unavailable" });
    expect(
      await callOps({ op: "health", check: "web" }, { config: null }),
    ).toEqual({ ok: false, error: "unavailable" });
  });

  it("does not let the same signed request run twice at the HTTP layer", async () => {
    const body = JSON.stringify(
      signEnvelope({ op: "health", check: "web" }, SECRET, Date.now()),
    );
    const post = () =>
      new Promise<number>((resolve, reject) => {
        const req = request(
          {
            socketPath,
            path: "/v1/request",
            method: "POST",
            headers: { "content-length": Buffer.byteLength(body) },
          },
          (res) => {
            res.resume();
            resolve(res.statusCode ?? 0);
          },
        );
        req.on("error", reject);
        req.end(body);
      });
    expect(await post()).toBe(200);
    expect(await post()).toBe(401);
  });

  it("rejects other paths, other methods and oversize bodies", async () => {
    const send = (method: string, url: string, body = "") =>
      new Promise<number>((resolve) => {
        const req = request({ socketPath, path: url, method }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.on("error", () => resolve(0));
        req.end(body);
      });
    expect(await send("GET", "/v1/request")).toBe(404);
    expect(await send("POST", "/other")).toBe(404);
    const big = await send("POST", "/v1/request", "x".repeat(10_000));
    expect([0, 401]).toContain(big);
  });
});

describe("readOpsConfig", () => {
  it("needs a secret of at least 32 characters", () => {
    expect(readOpsConfig({})).toBeNull();
    expect(readOpsConfig({ NEXUS_OPS_SECRET: "short" })).toBeNull();
    expect(readOpsConfig({ NEXUS_OPS_SECRET: SECRET })).toEqual({
      secret: SECRET,
      socketPath: "/run/nexus-ops/ops.sock",
    });
  });
});
