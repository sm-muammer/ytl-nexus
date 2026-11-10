import type { Snapshot } from "./snapshot.ts";

// Browser side of /api/stream/metrics (CMD-03). The built-in EventSource
// retries on its own after a dropped connection, but gives up for good when the
// server answers with an error status (a restart behind Apache often does).
// This wrapper opens a fresh connection with growing delays instead, so the
// dashboard recovers without a page reload. No React or DOM globals: the
// constructors are injected, which is also how the tests drive it.

export type StreamPayload = { snapshot: Snapshot; serverNow: number };

export type StreamStatus = "connecting" | "open" | "reconnecting" | "closed";

type SourceLike = {
  addEventListener(type: string, listener: (event: MessageEvent) => void): void;
  onopen: ((event: Event) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
};

export type StreamClientOptions = {
  url: string;
  createSource: (url: string) => SourceLike;
  onPayload: (payload: StreamPayload, receivedAt: number) => void;
  onStatus: (status: StreamStatus) => void;
  now?: () => number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

/** Parses one event. Returns null for anything that is not a snapshot payload. */
export function parsePayload(text: string): StreamPayload | null {
  try {
    const value = JSON.parse(text) as Partial<StreamPayload> | null;
    if (
      value &&
      typeof value.serverNow === "number" &&
      value.snapshot &&
      typeof value.snapshot.takenAt === "number" &&
      typeof value.snapshot.intervalMs === "number" &&
      Array.isArray(value.snapshot.services)
    ) {
      return value as StreamPayload;
    }
  } catch {
    // Fall through: a malformed event is ignored, not shown.
  }
  return null;
}

export class MetricsStreamClient {
  private source: SourceLike | null = null;
  private timer: unknown = null;
  private attempts = 0;
  private stopped = false;

  constructor(private readonly o: StreamClientOptions) {}

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    this.source?.close();
    this.source = null;
    if (this.timer !== null)
      (this.o.clearTimer ?? clearTimeout)(this.timer as never);
    this.timer = null;
    this.o.onStatus("closed");
  }

  /** Delay before reconnect attempt number `attempt` (1-based). */
  delayFor(attempt: number): number {
    const base = this.o.baseDelayMs ?? 1000;
    return Math.min(base * 2 ** (attempt - 1), this.o.maxDelayMs ?? 30_000);
  }

  private open(): void {
    this.o.onStatus(this.attempts === 0 ? "connecting" : "reconnecting");
    const source = this.o.createSource(this.o.url);
    this.source = source;
    source.onopen = () => {
      this.attempts = 0;
      this.o.onStatus("open");
    };
    source.addEventListener("snapshot", (event) => {
      const payload = parsePayload(String(event.data));
      if (payload) this.o.onPayload(payload, (this.o.now ?? Date.now)());
    });
    source.onerror = () => {
      source.close();
      if (this.source === source) this.source = null;
      if (this.stopped) return;
      this.attempts += 1;
      this.o.onStatus("reconnecting");
      this.timer = (this.o.setTimer ?? setTimeout)(() => {
        this.timer = null;
        if (!this.stopped) this.open();
      }, this.delayFor(this.attempts));
    };
  }
}

/**
 * How old the readings are at `localNow`: their age on the server when they
 * arrived, plus the time since. Using the server's own clock for the first part
 * keeps a wrong clock in the browser from making fresh data look stale.
 */
export function ageMs(
  payload: StreamPayload,
  receivedAt: number,
  localNow: number,
): number {
  const atReceipt = Math.max(0, payload.serverNow - payload.snapshot.takenAt);
  return atReceipt + Math.max(0, localNow - receivedAt);
}
