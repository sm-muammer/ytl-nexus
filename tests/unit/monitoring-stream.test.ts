import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoSnapshot } from "@/lib/fixtures/metrics";
import {
  MetricsStreamClient,
  ageMs,
  parsePayload,
  type StreamPayload,
  type StreamStatus,
} from "@/lib/monitoring/stream-client";
import { emptySnapshot, type Snapshot } from "@/lib/monitoring/snapshot";
import { SnapshotPoller } from "@/lib/server/monitoring/poller";
import {
  createStreamResponse,
  encodeSnapshotEvent,
  streamsOpenFor,
} from "@/lib/server/monitoring/stream";

const good = (takenAt: number): Snapshot => ({
  ...demoSnapshot(takenAt),
  source: "live",
  reachable: true,
});

describe("the poller (CMD-03)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("polls once per interval for all subscribers together", async () => {
    const collect = vi.fn(async () => good(Date.now()));
    const poller = new SnapshotPoller({
      collect,
      intervalMs: 1000,
      maxBackoffMs: 8000,
    });
    const a = vi.fn();
    const b = vi.fn();
    poller.subscribe(a);
    poller.subscribe(b);
    await vi.advanceTimersByTimeAsync(0);
    expect(collect).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(collect).toHaveBeenCalledTimes(2);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it("does nothing while nobody listens, and stops after the last unsubscribe", async () => {
    const collect = vi.fn(async () => good(Date.now()));
    const poller = new SnapshotPoller({
      collect,
      intervalMs: 1000,
      maxBackoffMs: 8000,
    });
    await vi.advanceTimersByTimeAsync(5000);
    expect(collect).not.toHaveBeenCalled();
    const off = poller.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    off();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(collect).toHaveBeenCalledTimes(1);
  });

  it("gives a new subscriber the latest snapshot at once", async () => {
    const poller = new SnapshotPoller({
      collect: async () => good(Date.now()),
      intervalMs: 1000,
      maxBackoffMs: 8000,
    });
    poller.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    const late = vi.fn();
    poller.subscribe(late);
    expect(late).toHaveBeenCalledTimes(1);
  });

  it("backs off after failures, up to the ceiling, and recovers", async () => {
    let fail = true;
    const collect = vi.fn(async () => {
      if (fail) throw new Error("down");
      return good(Date.now());
    });
    const poller = new SnapshotPoller({
      collect,
      intervalMs: 1000,
      maxBackoffMs: 5000,
    });
    poller.subscribe(() => {});
    await vi.advanceTimersByTimeAsync(0);
    expect(poller.nextDelay()).toBe(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(poller.nextDelay()).toBe(4000);
    await vi.advanceTimersByTimeAsync(4000);
    expect(poller.nextDelay()).toBe(5000);
    await vi.advanceTimersByTimeAsync(5000);
    expect(poller.nextDelay()).toBe(5000);
    expect(collect).toHaveBeenCalledTimes(4);

    fail = false;
    await vi.advanceTimersByTimeAsync(5000);
    expect(poller.nextDelay()).toBe(1000);
  });

  it("keeps the last good readings, flagged unreachable, so they go stale", async () => {
    let n = 0;
    const poller = new SnapshotPoller({
      collect: async () => {
        n += 1;
        if (n === 1) return good(1000);
        return emptySnapshot("live", Date.now(), 1000);
      },
      intervalMs: 1000,
      maxBackoffMs: 4000,
    });
    const seen: Snapshot[] = [];
    poller.subscribe((s) => seen.push(s));
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen[0]?.reachable).toBe(true);
    expect(seen[1]?.reachable).toBe(false);
    expect(seen[1]?.takenAt).toBe(seen[0]?.takenAt);
    expect(seen[1]?.metrics).toEqual(seen[0]?.metrics);
  });

  it("survives a subscriber that throws", async () => {
    const poller = new SnapshotPoller({
      collect: async () => good(Date.now()),
      intervalMs: 1000,
      maxBackoffMs: 4000,
    });
    const ok = vi.fn();
    poller.subscribe(() => {
      throw new Error("bad listener");
    });
    poller.subscribe(ok);
    await vi.advanceTimersByTimeAsync(1000);
    expect(ok).toHaveBeenCalled();
  });
});

describe("the SSE response", () => {
  const read = async (res: Response, chunks: number) => {
    const reader = res.body!.getReader();
    const out: string[] = [];
    for (let i = 0; i < chunks; i += 1) {
      const { value } = await reader.read();
      out.push(new TextDecoder().decode(value));
    }
    reader.releaseLock();
    return out.join("");
  };

  it("sends event-stream headers and the snapshot as soon as one exists", async () => {
    const subscribe = (fn: (s: Snapshot) => void) => {
      fn(good(1000));
      return () => {};
    };
    const controller = new AbortController();
    const res = createStreamResponse({
      poller: { subscribe },
      signal: controller.signal,
      key: "u-headers",
      now: () => 1500,
    });
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const text = await read(res, 2);
    expect(text).toContain("event: snapshot");
    const data = text.split("data: ")[1]?.split("\n")[0] ?? "";
    const payload = parsePayload(data);
    expect(payload?.serverNow).toBe(1500);
    controller.abort();
  });

  it("limits the streams one user holds and frees a slot on abort", async () => {
    const off = vi.fn();
    const poller = { subscribe: () => off };
    const open: AbortController[] = [];
    for (let i = 0; i < 3; i += 1) {
      const c = new AbortController();
      open.push(c);
      const r = createStreamResponse({
        poller,
        signal: c.signal,
        key: "u-limit",
        max: 3,
      });
      expect(r.status).toBe(200);
    }
    expect(streamsOpenFor("u-limit")).toBe(3);
    const refused = createStreamResponse({
      poller,
      signal: new AbortController().signal,
      key: "u-limit",
      max: 3,
    });
    expect(refused.status).toBe(429);
    // Another user is not affected.
    const other = new AbortController();
    expect(
      createStreamResponse({
        poller,
        signal: other.signal,
        key: "u-other",
        max: 3,
      }).status,
    ).toBe(200);

    open[0]?.abort();
    expect(streamsOpenFor("u-limit")).toBe(2);
    expect(off).toHaveBeenCalledTimes(1);
    const again = new AbortController();
    expect(
      createStreamResponse({
        poller,
        signal: again.signal,
        key: "u-limit",
        max: 3,
      }).status,
    ).toBe(200);
    for (const c of [...open, other, again]) c.abort();
    expect(streamsOpenFor("u-limit")).toBe(0);
  });

  it("sends a heartbeat comment so proxies keep the connection", async () => {
    vi.useFakeTimers();
    try {
      const c = new AbortController();
      const res = createStreamResponse({
        poller: { subscribe: () => () => {} },
        signal: c.signal,
        key: "u-beat",
        heartbeatMs: 1000,
      });
      const reader = res.body!.getReader();
      await reader.read(); // retry line
      await vi.advanceTimersByTimeAsync(1000);
      const { value } = await reader.read();
      expect(new TextDecoder().decode(value)).toBe(": ping\n\n");
      c.abort();
    } finally {
      vi.useRealTimers();
    }
  });

  it("encodes one event per snapshot with no trailing text", () => {
    const text = encodeSnapshotEvent(good(0), 5);
    expect(text.startsWith("event: snapshot\ndata: ")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(true);
    expect(text.split("\n\n")).toHaveLength(2);
  });

  it("carries no hostname, address or path in a payload", () => {
    const text = encodeSnapshotEvent(good(0), 5);
    expect(text).not.toMatch(/ytlcomms|10\.26\.|\/etc\/|\/var\//);
  });
});

// ---- Browser client: reconnect (CMD-03) --------------------------------------------

class FakeSource {
  static all: FakeSource[] = [];
  onopen: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null;
  closed = false;
  private handlers = new Map<string, (e: MessageEvent) => void>();
  constructor(public url: string) {
    FakeSource.all.push(this);
  }
  addEventListener(type: string, fn: (e: MessageEvent) => void) {
    this.handlers.set(type, fn);
  }
  close() {
    this.closed = true;
  }
  open() {
    this.onopen?.(new Event("open"));
  }
  emit(payload: StreamPayload | string) {
    const data =
      typeof payload === "string" ? payload : JSON.stringify(payload);
    this.handlers.get("snapshot")?.({ data } as MessageEvent);
  }
  fail() {
    this.onerror?.(new Event("error"));
  }
}

describe("the browser stream client", () => {
  beforeEach(() => {
    FakeSource.all = [];
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function build() {
    const statuses: StreamStatus[] = [];
    const payloads: StreamPayload[] = [];
    const client = new MetricsStreamClient({
      url: "/api/stream/metrics",
      createSource: (url) => new FakeSource(url),
      onStatus: (s) => statuses.push(s),
      onPayload: (p) => payloads.push(p),
      baseDelayMs: 1000,
      maxDelayMs: 4000,
    });
    return { client, statuses, payloads };
  }

  const payload = (): StreamPayload => ({
    snapshot: { ...good(1000), takenAt: 1000 },
    serverNow: 1200,
  });

  it("receives snapshots and ignores malformed events", () => {
    const { client, payloads, statuses } = build();
    client.start();
    const s = FakeSource.all[0]!;
    s.open();
    s.emit(payload());
    s.emit("not json");
    s.emit('{"snapshot":{}}');
    expect(payloads).toHaveLength(1);
    expect(statuses).toEqual(["connecting", "open"]);
  });

  it("opens a new connection after a drop, with growing delays", async () => {
    const { client, statuses, payloads } = build();
    client.start();
    FakeSource.all[0]!.open();
    FakeSource.all[0]!.fail();
    expect(FakeSource.all[0]!.closed).toBe(true);
    expect(statuses.at(-1)).toBe("reconnecting");
    expect(FakeSource.all).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSource.all).toHaveLength(2);

    // A second failure before the connection opens waits twice as long.
    FakeSource.all[1]!.fail();
    await vi.advanceTimersByTimeAsync(1999);
    expect(FakeSource.all).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(FakeSource.all).toHaveLength(3);

    FakeSource.all[2]!.open();
    FakeSource.all[2]!.emit(payload());
    expect(payloads).toHaveLength(1);
    expect(statuses.at(-1)).toBe("open");

    // After a success the delay starts over.
    FakeSource.all[2]!.fail();
    await vi.advanceTimersByTimeAsync(1000);
    expect(FakeSource.all).toHaveLength(4);
  });

  it("caps the delay", () => {
    const { client } = build();
    expect([1, 2, 3, 4, 5, 10].map((n) => client.delayFor(n))).toEqual([
      1000, 2000, 4000, 4000, 4000, 4000,
    ]);
  });

  it("stops for good when told to", async () => {
    const { client, statuses } = build();
    client.start();
    FakeSource.all[0]!.fail();
    client.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(FakeSource.all).toHaveLength(1);
    expect(statuses.at(-1)).toBe("closed");
  });

  it("measures age from the server's clock, so a wrong browser clock does not matter", () => {
    const p = payload(); // taken at 1000, sent at 1200: 200 ms old on arrival
    expect(ageMs(p, 5_000_000, 5_000_000)).toBe(200);
    expect(ageMs(p, 5_000_000, 5_003_000)).toBe(3200);
    // A clock that went backwards never gives a negative age.
    expect(ageMs(p, 5_000_000, 4_000_000)).toBe(200);
  });
});
