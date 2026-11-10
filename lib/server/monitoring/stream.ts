import "server-only";
import { DEMO_INTERVAL_MS, demoSnapshot } from "@/lib/fixtures/metrics";
import type { Snapshot } from "@/lib/monitoring/snapshot";
import { getAdapters } from "@/lib/server/adapters";
import { LIVE_INTERVAL_MS } from "@/lib/server/adapters/live";
import { getMode } from "@/lib/server/mode";
import { SnapshotPoller } from "./poller";

// The process-wide poller and the SSE response built on it.

/** Open streams one signed-in user may hold at a time (CMD security rules). */
export const MAX_STREAMS_PER_USER = 3;
const HEARTBEAT_MS = 15_000;
const MAX_BACKOFF_MS = 60_000;

type Store = { poller: SnapshotPoller | null; mode: string | null };
const g = globalThis as unknown as { __nexusMetrics?: Store };

/** One poller per process and mode. Next.js may load this module twice, so it lives on globalThis. */
export function getPoller(): SnapshotPoller {
  const mode = getMode();
  const store = (g.__nexusMetrics ??= { poller: null, mode: null });
  if (!store.poller || store.mode !== mode) {
    store.mode = mode;
    store.poller =
      mode === "demo"
        ? new SnapshotPoller({
            collect: async () => demoSnapshot(Date.now()),
            intervalMs: DEMO_INTERVAL_MS,
            maxBackoffMs: MAX_BACKOFF_MS,
          })
        : new SnapshotPoller({
            collect: () => getAdapters().prometheus.snapshot(),
            intervalMs: LIVE_INTERVAL_MS,
            maxBackoffMs: MAX_BACKOFF_MS,
          });
  }
  return store.poller;
}

export function encodeSnapshotEvent(snapshot: Snapshot, serverNow: number) {
  return `event: snapshot\ndata: ${JSON.stringify({ snapshot, serverNow })}\n\n`;
}

const openStreams = new Map<string, number>();

export function streamsOpenFor(key: string): number {
  return openStreams.get(key) ?? 0;
}

export function createStreamResponse(args: {
  poller: Pick<SnapshotPoller, "subscribe">;
  signal: AbortSignal;
  key: string;
  max?: number;
  heartbeatMs?: number;
  now?: () => number;
}): Response {
  const max = args.max ?? MAX_STREAMS_PER_USER;
  const now = args.now ?? Date.now;
  if (streamsOpenFor(args.key) >= max) {
    return Response.json({ error: "too-many-streams" }, { status: 429 });
  }
  openStreams.set(args.key, streamsOpenFor(args.key) + 1);

  const encoder = new TextEncoder();
  let release: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (text: string) => {
        if (!closed) controller.enqueue(encoder.encode(text));
      };
      const unsubscribe = args.poller.subscribe((snapshot) =>
        send(encodeSnapshotEvent(snapshot, now())),
      );
      const heartbeat = setInterval(
        () => send(": ping\n\n"),
        args.heartbeatMs ?? HEARTBEAT_MS,
      );
      send("retry: 3000\n\n");

      release = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        const left = streamsOpenFor(args.key) - 1;
        if (left <= 0) openStreams.delete(args.key);
        else openStreams.set(args.key, left);
        try {
          controller.close();
        } catch {
          // Already closed by the runtime.
        }
      };
      if (args.signal.aborted) release();
      else
        args.signal.addEventListener("abort", () => release?.(), {
          once: true,
        });
    },
    cancel() {
      release?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Tells Apache and other proxies not to hold the stream back.
      "X-Accel-Buffering": "no",
    },
  });
}
