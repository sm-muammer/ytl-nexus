// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createNonceStore,
  signWebhook,
  tagsForEvent,
  verifyWebhook,
} from "@/lib/content/webhook";
import { signPreviewToken, verifyPreviewToken } from "@/lib/content/preview";

const SECRET = "x".repeat(40);
const NOW = 1_800_000_000_000;
const body = JSON.stringify({
  event: "update",
  type: "runbook",
  id: 12,
  slug: "restart-apache",
});

function signed(overrides: Partial<Record<string, string>> = {}) {
  const timestamp = String(Math.floor(NOW / 1000));
  const nonce = "n-" + Math.random().toString(16).slice(2);
  const signature = signWebhook(SECRET, timestamp, nonce, body);
  return { timestamp, nonce, signature, ...overrides };
}

describe("verifyWebhook", () => {
  it("accepts a correctly signed, fresh request once", () => {
    const store = createNonceStore();
    const h = signed();
    expect(
      verifyWebhook({ secret: SECRET, body, ...h, now: NOW, store }),
    ).toEqual({ ok: true });
  });

  it("rejects a replay of the same request", () => {
    const store = createNonceStore();
    const h = signed();
    verifyWebhook({ secret: SECRET, body, ...h, now: NOW, store });
    expect(
      verifyWebhook({ secret: SECRET, body, ...h, now: NOW, store }),
    ).toEqual({ ok: false, reason: "replay" });
  });

  it("rejects a bad signature and a tampered body", () => {
    const store = createNonceStore();
    expect(
      verifyWebhook({
        secret: SECRET,
        body,
        ...signed({ signature: "sha256=" + "0".repeat(64) }),
        now: NOW,
        store,
      }),
    ).toEqual({ ok: false, reason: "signature" });
    expect(
      verifyWebhook({
        secret: SECRET,
        body: body.replace("update", "delete"),
        ...signed(),
        now: NOW,
        store,
      }),
    ).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects a signature made with another secret and a malformed one", () => {
    const store = createNonceStore();
    const t = String(Math.floor(NOW / 1000));
    const other = signWebhook("y".repeat(40), t, "n1", body);
    expect(
      verifyWebhook({
        secret: SECRET,
        body,
        timestamp: t,
        nonce: "n1",
        signature: other,
        now: NOW,
        store,
      }).ok,
    ).toBe(false);
    expect(
      verifyWebhook({
        secret: SECRET,
        body,
        timestamp: t,
        nonce: "n2",
        signature: "garbage",
        now: NOW,
        store,
      }),
    ).toEqual({ ok: false, reason: "signature" });
  });

  it("rejects stale and future timestamps", () => {
    const store = createNonceStore();
    for (const offset of [-301, 301]) {
      const timestamp = String(Math.floor(NOW / 1000) + offset);
      const nonce = "n" + offset;
      const signature = signWebhook(SECRET, timestamp, nonce, body);
      expect(
        verifyWebhook({
          secret: SECRET,
          body,
          timestamp,
          nonce,
          signature,
          now: NOW,
          store,
        }),
      ).toEqual({ ok: false, reason: "timestamp" });
    }
  });

  it("rejects missing headers and a missing secret", () => {
    const store = createNonceStore();
    expect(
      verifyWebhook({
        secret: SECRET,
        body,
        ...signed({ nonce: "" }),
        now: NOW,
        store,
      }).ok,
    ).toBe(false);
    expect(
      verifyWebhook({ secret: "", body, ...signed(), now: NOW, store }).ok,
    ).toBe(false);
  });

  it("a failed signature does not consume the nonce", () => {
    const store = createNonceStore();
    const good = signed();
    verifyWebhook({
      secret: SECRET,
      body,
      ...good,
      signature: "sha256=00",
      now: NOW,
      store,
    });
    expect(
      verifyWebhook({ secret: SECRET, body, ...good, now: NOW, store }).ok,
    ).toBe(true);
  });

  it("forgets nonces after the window so the store stays bounded", () => {
    const store = createNonceStore();
    store.remember("a", NOW);
    store.remember("b", NOW + 700_000);
    expect(store.size()).toBe(1);
  });
});

describe("tagsForEvent", () => {
  it("revalidates the list, the type and the item", () => {
    expect(
      tagsForEvent({ event: "update", type: "runbook", id: 1, slug: "a-b" }),
    ).toEqual(["content", "content:runbook", "content:runbook:a-b"]);
  });
});

describe("preview token", () => {
  it("round-trips and expires", () => {
    const token = signPreviewToken(SECRET, { type: "runbook", id: 12 }, NOW);
    expect(verifyPreviewToken(SECRET, token, NOW + 60_000)).toEqual({
      type: "runbook",
      id: 12,
    });
    expect(verifyPreviewToken(SECRET, token, NOW + 11 * 60_000)).toBeNull();
  });

  it("rejects tampering and another secret", () => {
    const token = signPreviewToken(SECRET, { type: "runbook", id: 12 }, NOW);
    const [payload, sig] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ type: "runbook", id: 13, exp: NOW + 999_999 }),
    ).toString("base64url");
    expect(verifyPreviewToken(SECRET, `${forged}.${sig}`, NOW)).toBeNull();
    expect(verifyPreviewToken("z".repeat(40), token, NOW)).toBeNull();
    expect(verifyPreviewToken(SECRET, `${payload}`, NOW)).toBeNull();
    expect(verifyPreviewToken(SECRET, "", NOW)).toBeNull();
  });
});
