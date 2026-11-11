// @vitest-environment node
import fc from "fast-check";
import { fakeSecret } from "../helpers/fake-secret";
import { describe, expect, it, vi } from "vitest";
import {
  NonceCache,
  canonicalize,
  signEnvelope,
  validateRequest,
  verifyEnvelope,
} from "@/lib/ops/protocol";
import { HEALTH_CHECK_IDS, OPS_UNITS } from "@/lib/ops/units";
import { createAgent, type Runner } from "@/services/ops-agent/agent";

// Property 10: ops agent request validation (allowlist).
// Property 11: HMAC envelope authentication and replay rejection.

const SECRET = fakeSecret("test");
const NOW = 1_800_000_000_000;

describe("Property 10: validateRequest", () => {
  it("accepts restart and logs only for the four exact units", () => {
    for (const unit of OPS_UNITS) {
      expect(validateRequest({ op: "restart", unit }).ok).toBe(true);
      expect(validateRequest({ op: "logs", unit, lines: 1 }).ok).toBe(true);
      expect(validateRequest({ op: "logs", unit, lines: 500 }).ok).toBe(true);
    }
    for (const check of HEALTH_CHECK_IDS) {
      expect(validateRequest({ op: "health", check }).ok).toBe(true);
    }
  });

  it.each([
    "sshd",
    "mariadb",
    "httpd",
    "nexus-ops",
    "polkit",
    "firewalld",
    "nexus-web.service",
    "nexus-web@1",
    "nexus-web@.service",
    "nexus-web ",
    " nexus-web",
    "NEXUS-WEB",
    "Nexus-Web",
    "nexus-*",
    "*",
    "nexus-w?b",
    "nexus-[wx]eb",
    "../nexus-web",
    "nexus-web/../sshd",
    "/etc/systemd/system/nexus-web.service",
    "nexus-web;reboot",
    "nexus-web && id",
    "nexus-web\nsshd",
    "nexus-web\u0000",
    "$(id)",
    "`id`",
    "-all",
    "--now",
    "",
  ])("refuses the unit %j", (unit) => {
    expect(validateRequest({ op: "restart", unit }).ok).toBe(false);
    expect(validateRequest({ op: "logs", unit, lines: 10 }).ok).toBe(false);
  });

  it.each([0, -1, 501, 1000, 1.5, Number.NaN, Infinity, "10", null, [10], {}])(
    "refuses lines %j",
    (lines) => {
      expect(validateRequest({ op: "logs", unit: "nexus-web", lines }).ok).toBe(
        false,
      );
    },
  );

  it.each([
    null,
    undefined,
    "restart",
    42,
    [],
    {},
    { op: "exec", cmd: "id" },
    { op: "Restart", unit: "nexus-web" },
    { op: "restart" },
    { op: "restart", unit: "nexus-web", extra: 1 },
    { op: "logs", unit: "nexus-web" },
    { op: "logs", unit: "nexus-web", lines: 5, follow: true },
    { op: "health", check: "firewall" },
    { op: "health", check: "web", host: "example.com" },
    { op: "health" },
  ])("refuses the shape %j", (raw) => {
    expect(validateRequest(raw).ok).toBe(false);
  });

  it("refuses a request that carries __proto__ or a prototype-bearing object", () => {
    expect(
      validateRequest(
        JSON.parse('{"op":"restart","unit":"nexus-web","__proto__":{"a":1}}'),
      ).ok,
    ).toBe(false);
    class Request {
      op = "restart";
      unit = "nexus-web";
    }
    expect(validateRequest(new Request()).ok).toBe(false);
  });

  it("for any string, accepts a unit only when it equals an allowlist entry", () => {
    fc.assert(
      fc.property(fc.string(), (unit) => {
        const expected = (OPS_UNITS as readonly string[]).includes(unit);
        expect(validateRequest({ op: "restart", unit }).ok).toBe(expected);
        expect(validateRequest({ op: "logs", unit, lines: 5 }).ok).toBe(
          expected,
        );
      }),
    );
  });

  it("for any near-miss of an allowlisted unit, refuses", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OPS_UNITS),
        fc.string({ minLength: 1 }),
        fc.boolean(),
        (unit, junk, before) => {
          const name = before ? junk + unit : unit + junk;
          fc.pre(!(OPS_UNITS as readonly string[]).includes(name));
          expect(validateRequest({ op: "restart", unit: name }).ok).toBe(false);
        },
      ),
    );
  });

  it("for any number, accepts lines only for integers from 1 to 500", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -1000, max: 1000 }), fc.double()),
        (lines) => {
          const ok = Number.isInteger(lines) && lines >= 1 && lines <= 500;
          expect(
            validateRequest({ op: "logs", unit: "sftpgo", lines }).ok,
          ).toBe(ok);
        },
      ),
    );
  });
});

describe("Property 11: envelope authentication", () => {
  const req = { op: "restart", unit: "nexus-worker" };

  it("accepts a correctly signed, fresh envelope once", () => {
    const seen = new NonceCache();
    const envelope = signEnvelope(req, SECRET, NOW);
    expect(verifyEnvelope(envelope, SECRET, NOW, seen)).toBe("ok");
    expect(verifyEnvelope(envelope, SECRET, NOW, seen)).toBe("auth-failure");
  });

  it("rejects a repeated nonce within 60 s and accepts it again after", () => {
    const seen = new NonceCache();
    const first = signEnvelope(req, SECRET, NOW, "nonce-aaaaaaaaaaaaaaaa");
    expect(verifyEnvelope(first, SECRET, NOW, seen)).toBe("ok");
    const again = signEnvelope(
      req,
      SECRET,
      NOW + 20_000,
      "nonce-aaaaaaaaaaaaaaaa",
    );
    expect(verifyEnvelope(again, SECRET, NOW + 20_000, seen)).toBe(
      "auth-failure",
    );
    const later = signEnvelope(
      req,
      SECRET,
      NOW + 61_000,
      "nonce-aaaaaaaaaaaaaaaa",
    );
    expect(verifyEnvelope(later, SECRET, NOW + 61_000, seen)).toBe("ok");
  });

  it("rejects a timestamp more than 30 s from the agent clock, both ways", () => {
    const seen = new NonceCache();
    for (const shift of [-31_000, 31_000, -3_600_000, 86_400_000]) {
      const envelope = signEnvelope(req, SECRET, NOW + shift);
      expect(verifyEnvelope(envelope, SECRET, NOW, seen)).toBe("auth-failure");
    }
    expect(
      verifyEnvelope(
        signEnvelope(req, SECRET, NOW - 30_000),
        SECRET,
        NOW,
        seen,
      ),
    ).toBe("ok");
    expect(
      verifyEnvelope(
        signEnvelope(req, SECRET, NOW + 30_000),
        SECRET,
        NOW,
        seen,
      ),
    ).toBe("ok");
  });

  it("rejects a wrong secret", () => {
    const envelope = signEnvelope(req, fakeSecret("other"), NOW);
    expect(verifyEnvelope(envelope, SECRET, NOW, new NonceCache())).toBe(
      "auth-failure",
    );
  });

  it("rejects any modified body, signature, timestamp or nonce", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("req", "ts", "nonce", "sig"),
        fc.nat(15),
        (field, position) => {
          const good = signEnvelope(req, SECRET, NOW);
          const bad = { ...good } as Record<string, unknown>;
          if (field === "req") {
            bad.req = { op: "restart", unit: "sftpgo" };
          } else if (field === "ts") {
            bad.ts = good.ts + 1 + position;
          } else if (field === "nonce") {
            bad.nonce = `${good.nonce.slice(0, -1)}${good.nonce.endsWith("A") ? "B" : "A"}`;
          } else {
            const chars = good.sig.split("");
            chars[position] = chars[position] === "0" ? "1" : "0";
            bad.sig = chars.join("");
          }
          expect(verifyEnvelope(bad, SECRET, NOW, new NonceCache())).toBe(
            "auth-failure",
          );
        },
      ),
    );
  });

  it("rejects malformed envelopes without throwing", () => {
    const seen = new NonceCache();
    const good = signEnvelope(req, SECRET, NOW);
    for (const bad of [
      null,
      undefined,
      "x",
      1,
      [],
      {},
      { ...good, extra: 1 },
      { ...good, ts: "1" },
      { ...good, ts: Number.NaN },
      { ...good, nonce: "short" },
      { ...good, sig: "zz" },
      { ...good, sig: good.sig.toUpperCase() },
    ]) {
      expect(verifyEnvelope(bad, SECRET, NOW, seen)).toBe("auth-failure");
    }
  });

  it("does not record the nonce of a forged envelope", () => {
    const seen = new NonceCache();
    const forged = signEnvelope(req, fakeSecret("forged"), NOW);
    verifyEnvelope(forged, SECRET, NOW, seen);
    expect(seen.size).toBe(0);
  });

  it("signs the same bytes whatever the key order", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: 3 } })).toBe(
      canonicalize({ a: { c: 3, d: 2 }, b: 1 }),
    );
  });
});

describe("agent", () => {
  function setup(overrides: Partial<Runner> = {}) {
    const runner: Runner = {
      restart: vi.fn(async () => {}),
      logs: vi.fn(async () => "line one\nline two\n"),
      probe: vi.fn(async () => ({
        state: "healthy" as const,
        latencyMs: 4,
        detail: "Answered",
      })),
      ...overrides,
    };
    const log = vi.fn();
    const handle = createAgent({
      secret: SECRET,
      redact: { ipRanges: ["10.0.0.0/8"], secrets: [SECRET] },
      runner,
      now: () => NOW,
      log,
    });
    const send = (req: unknown, at = NOW, nonce?: string) =>
      handle(JSON.stringify(signEnvelope(req, SECRET, at, nonce)));
    return { runner, log, handle, send };
  }

  it("restarts an allowlisted unit and acknowledges", async () => {
    const { runner, send } = setup();
    const reply = await send({ op: "restart", unit: "nexus-worker" });
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      ok: true,
      op: "restart",
      unit: "nexus-worker",
      accepted: true,
    });
    expect(runner.restart).toHaveBeenCalledWith("nexus-worker");
  });

  it("acknowledges a restart without waiting for it to finish", async () => {
    // The runner resolves when the job is queued; nothing waits for the unit.
    const { send } = setup({ restart: () => Promise.resolve() });
    const started = Date.now();
    await send({ op: "restart", unit: "nexus-web" });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it("runs nothing for sshd, mariadb and path tricks", async () => {
    const { runner, send } = setup();
    for (const unit of [
      "sshd",
      "mariadb",
      "../sshd",
      "nexus-web@x",
      "nexus-*",
    ]) {
      const reply = await send({ op: "restart", unit });
      expect(reply.status).toBe(400);
      expect(reply.body).toEqual({ ok: false, error: "invalid-request" });
    }
    expect(runner.restart).not.toHaveBeenCalled();
    expect(runner.logs).not.toHaveBeenCalled();
  });

  it("runs nothing for a bad signature, a replay or an expired timestamp", async () => {
    const { runner, send, handle } = setup();
    const req = { op: "restart", unit: "nexus-web" };

    const tampered = signEnvelope(req, SECRET, NOW);
    tampered.req = { op: "restart", unit: "sftpgo" };
    expect((await handle(JSON.stringify(tampered))).status).toBe(401);

    expect((await send(req, NOW - 31_000)).status).toBe(401);

    expect((await send(req, NOW, "replay-nonce-0123456789")).status).toBe(200);
    expect((await send(req, NOW, "replay-nonce-0123456789")).status).toBe(401);
    expect(runner.restart).toHaveBeenCalledTimes(1);

    expect((await handle("not json")).status).toBe(401);
  });

  it("returns sanitized log text only", async () => {
    const { send } = setup({
      logs: async () =>
        [
          "2026-11-11T10:00:00+0800 host app[1]: login from 10.26.1.5 user=anna@example.com",
          `2026-11-11T10:00:01+0800 host app[1]: password=hunter22 secret ${SECRET}`,
        ].join("\n"),
    });
    const reply = await send({ op: "logs", unit: "nexus-web", lines: 50 });
    expect(reply.status).toBe(200);
    const text = JSON.stringify(reply.body);
    expect(text).not.toContain("10.26.1.5");
    expect(text).not.toContain("anna@example.com");
    expect(text).not.toContain("hunter22");
    expect(text).not.toContain(SECRET);
  });

  it("reports a failed restart as an error without detail", async () => {
    const { send } = setup({
      restart: async () => {
        throw new Error("Failed to connect to bus: /run/secret/path");
      },
    });
    const reply = await send({ op: "restart", unit: "sftpgo" });
    expect(reply.status).toBe(502);
    expect(reply.body).toEqual({ ok: false, error: "failed" });
  });

  it("runs a predefined health check", async () => {
    const { send, runner } = setup();
    const reply = await send({ op: "health", check: "database" });
    expect(reply.body).toMatchObject({
      ok: true,
      op: "health",
      check: "database",
      state: "healthy",
    });
    expect(runner.probe).toHaveBeenCalledWith({
      kind: "tcp",
      host: "127.0.0.1",
      port: 3306,
    });
  });

  it("never logs a secret", async () => {
    const { send, log } = setup();
    await send({ op: "restart", unit: "nexus-web" });
    expect(JSON.stringify(log.mock.calls)).not.toContain(SECRET);
  });
});
