"use client";

import { useEffect, useRef, useState } from "react";
import {
  MetricsStreamClient,
  ageMs,
  type StreamPayload,
  type StreamStatus,
} from "@/lib/monitoring/stream-client";
import {
  STALE_AFTER_INTERVALS,
  STATE_LABEL,
  type Snapshot,
} from "@/lib/monitoring/snapshot";

export type ChangeEvent = {
  /** Local time the change was seen. */
  at: number;
  service: string;
  from: string;
  to: string;
};

const MAX_EVENTS = 8;

/**
 * Live readings for the dashboard. Starts from the snapshot the server
 * rendered, then follows the SSE stream. `stale` turns true when no fresh
 * reading has arrived for three intervals (CMD-06), whether the stream
 * dropped or the server could not reach Prometheus.
 */
export function useMetricsStream(initial: Snapshot) {
  const [snapshot, setSnapshot] = useState<Snapshot>(initial);
  const [status, setStatus] = useState<StreamStatus>("connecting");
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [age, setAge] = useState<number | null>(null);
  const latest = useRef<{ payload: StreamPayload; receivedAt: number } | null>(
    null,
  );
  const previous = useRef<Snapshot>(initial);

  useEffect(() => {
    const client = new MetricsStreamClient({
      url: "/api/stream/metrics",
      createSource: (url) => new EventSource(url),
      onStatus: setStatus,
      onPayload: (payload, receivedAt) => {
        latest.current = { payload, receivedAt };
        const next = payload.snapshot;
        const before = previous.current;
        const changes: ChangeEvent[] = [];
        for (const s of next.services) {
          const old = before.services.find((o) => o.id === s.id);
          if (old && old.state !== s.state) {
            changes.push({
              at: receivedAt,
              service: s.name,
              from: STATE_LABEL[old.state],
              to: STATE_LABEL[s.state],
            });
          }
        }
        previous.current = next;
        setSnapshot(next);
        setAge(ageMs(payload, receivedAt, receivedAt));
        if (changes.length > 0) {
          setEvents((e) => [...changes.reverse(), ...e].slice(0, MAX_EVENTS));
        }
      },
    });
    client.start();

    // Age is recomputed once a second from the server's own clock.
    const timer = setInterval(() => {
      const l = latest.current;
      if (l) setAge(ageMs(l.payload, l.receivedAt, Date.now()));
    }, 1000);

    return () => {
      clearInterval(timer);
      client.stop();
    };
  }, []);

  const stale =
    age !== null && age > STALE_AFTER_INTERVALS * snapshot.intervalMs;
  return { snapshot, status, events, age, stale };
}
