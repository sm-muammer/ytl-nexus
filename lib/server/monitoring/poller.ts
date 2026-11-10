import "server-only";
import { emptySnapshot, type Snapshot } from "@/lib/monitoring/snapshot";

// One poller per process (CMD-03). It asks for a snapshot on a fixed interval
// and hands each result to every subscriber, so ten open dashboards cost one
// set of Prometheus queries. It runs only while someone is subscribed. After
// a failure it waits twice as long each time, up to a ceiling, and goes back to
// the normal interval after the first success.

export type PollerOptions = {
  collect: () => Promise<Snapshot>;
  intervalMs: number;
  maxBackoffMs: number;
  now?: () => number;
};

export type Listener = (snapshot: Snapshot) => void;

export class SnapshotPoller {
  private listeners = new Set<Listener>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastGood: Snapshot | null = null;
  private current: Snapshot | null = null;
  private failures = 0;
  private running = false;

  constructor(private readonly options: PollerOptions) {}

  /** The most recent snapshot, or null before the first poll finishes. */
  latest(): Snapshot | null {
    return this.current;
  }

  get subscriberCount(): number {
    return this.listeners.size;
  }

  /** Delay before the next poll, given the failures so far. */
  nextDelay(): number {
    if (this.failures === 0) return this.options.intervalMs;
    return Math.min(
      this.options.intervalMs * 2 ** this.failures,
      this.options.maxBackoffMs,
    );
  }

  /** Starts polling if this is the first subscriber. Returns the unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    if (this.current) listener(this.current);
    if (this.listeners.size === 1) this.start();
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) this.stop();
    };
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    void this.tick();
  }

  private stop(): void {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  private async tick(): Promise<void> {
    if (!this.running) return;
    let snapshot: Snapshot;
    try {
      snapshot = await this.options.collect();
    } catch {
      snapshot = {
        ...(this.lastGood ?? this.fallback()),
        reachable: false,
      };
    }

    if (snapshot.reachable) {
      this.failures = 0;
      this.lastGood = snapshot;
    } else {
      this.failures += 1;
      // Keep the last readings and their time: they go stale on their own.
      if (this.lastGood) snapshot = { ...this.lastGood, reachable: false };
    }

    this.current = snapshot;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch {
        // A broken subscriber must not stop the others or the poller.
      }
    }

    if (this.running) {
      this.timer = setTimeout(() => void this.tick(), this.nextDelay());
    }
  }

  private fallback(): Snapshot {
    return emptySnapshot(
      "live",
      (this.options.now ?? Date.now)(),
      this.options.intervalMs,
    );
  }
}
