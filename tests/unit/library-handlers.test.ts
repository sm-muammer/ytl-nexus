// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNonceStore, signWebhook } from "@/lib/content/webhook";
import { contentFixtures } from "@/lib/fixtures/content";
import { handleRevalidate } from "@/lib/server/revalidate-handler";
import type { Actor } from "@/lib/roles";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));

const actorRef: { current: Actor } = { current: null };
vi.mock("@/lib/server/session", () => ({
  getActor: async () => actorRef.current,
}));

const SECRET = "s".repeat(40);
const NOW = 1_800_000_000_000;
const body = JSON.stringify({
  event: "update",
  type: "runbook",
  id: 3,
  slug: "restart-the-web-application",
});

function request(over: { body?: string; sig?: string; nonce?: string } = {}) {
  const ts = String(Math.floor(NOW / 1000));
  const nonce = over.nonce ?? "nonce-1";
  const b = over.body ?? body;
  return new Request("http://localhost/api/revalidate", {
    method: "POST",
    body: b,
    headers: {
      "x-nexus-timestamp": ts,
      "x-nexus-nonce": nonce,
      "x-nexus-signature": over.sig ?? signWebhook(SECRET, ts, nonce, b),
    },
  });
}

function deps() {
  const revalidate = vi.fn();
  const audit = vi.fn(async () => undefined);
  return {
    revalidate,
    audit,
    d: {
      secret: SECRET,
      now: () => NOW,
      store: createNonceStore(),
      revalidate,
      audit,
      sourceIp: "10.0.0.5",
    },
  };
}

describe("POST /api/revalidate logic", () => {
  it("revalidates list, type and item tags for a valid request", async () => {
    const { d, revalidate, audit } = deps();
    const res = await handleRevalidate(request(), d);
    expect(res.status).toBe(200);
    expect(revalidate.mock.calls.map((c) => c[0])).toEqual([
      "content",
      "content:runbook",
      "content:runbook:restart-the-web-application",
    ]);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "content.revalidate",
        result: "success",
      }),
    );
  });

  it("answers 401 to a bad signature and revalidates nothing", async () => {
    const { d, revalidate, audit } = deps();
    const res = await handleRevalidate(
      request({ sig: "sha256=" + "a".repeat(64) }),
      d,
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(revalidate).not.toHaveBeenCalled();
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ result: "refused" }),
    );
  });

  it("answers 401 to a replay", async () => {
    const { d, revalidate } = deps();
    expect((await handleRevalidate(request(), d)).status).toBe(200);
    expect((await handleRevalidate(request(), d)).status).toBe(401);
    expect(revalidate).toHaveBeenCalledTimes(3);
  });

  it("answers 400 to a signed body that is not an event", async () => {
    const { d, revalidate } = deps();
    const bad = JSON.stringify({
      event: "update",
      type: "../etc",
      id: 1,
      slug: "x",
    });
    const res = await handleRevalidate(request({ body: bad }), d);
    expect(res.status).toBe(400);
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("answers 401 when no secret is configured", async () => {
    const { d } = deps();
    const res = await handleRevalidate(request(), { ...d, secret: "" });
    expect(res.status).toBe(401);
  });

  it("still answers when the audit store is down", async () => {
    const { d } = deps();
    const res = await handleRevalidate(request(), {
      ...d,
      audit: async () => {
        throw new Error("db down");
      },
    });
    expect(res.status).toBe(200);
  });
});

describe("GET /api/library (audience leak)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXUS_MODE", "demo");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    actorRef.current = null;
  });

  async function list(type: string) {
    const { GET } = await import("@/app/api/library/route");
    const res = await GET(
      new Request(`http://localhost/api/library?type=${type}`),
    );
    return {
      status: res.status,
      json: (await res.json()) as {
        items: { slug: string; audience: string }[];
      },
    };
  }

  const internal = contentFixtures.filter((i) => i.audience === "internal");

  it("never returns an internal item to a Visitor, for any type", async () => {
    const types = [...new Set(contentFixtures.map((i) => i.type))];
    for (const type of types) {
      const { status, json } = await list(type);
      expect(status).toBe(200);
      const text = JSON.stringify(json);
      for (const i of internal) expect(text).not.toContain(i.slug);
      expect(json.items.every((i) => i.audience === "public")).toBe(true);
    }
  });

  it("returns internal items to a signed-in Viewer", async () => {
    actorRef.current = { userId: "u1", role: "viewer" };
    const { json } = await list("runbook");
    expect(json.items.some((i) => i.audience === "internal")).toBe(true);
  });

  it("rejects an unknown type", async () => {
    expect((await list("users")).status).toBe(400);
  });
});
