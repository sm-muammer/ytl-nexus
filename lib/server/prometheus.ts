import "server-only";
import { z } from "zod";
import {
  QUERIES,
  RANGES,
  isQueryId,
  isRangeId,
  isRangeQueryId,
  type QueryId,
  type RangeId,
  type RangeQueryId,
} from "@/lib/monitoring/queries";
import type { SeriesPoint } from "@/lib/monitoring/snapshot";

// The only code that talks to Prometheus (CMD-02). It accepts a query ID from
// the allowlist in lib/monitoring/queries.ts and nothing else: there is no
// method that takes PromQL text, so a caller cannot widen the questions asked.

export class QueryNotAllowedError extends Error {
  constructor() {
    super("query-not-allowed");
    this.name = "QueryNotAllowedError";
  }
}

export class PrometheusUnavailableError extends Error {
  constructor() {
    super("prometheus-unavailable");
    this.name = "PrometheusUnavailableError";
  }
}

const pair = z.tuple([z.number(), z.string()]);
const body = z.object({
  status: z.literal("success"),
  data: z.object({
    resultType: z.enum(["vector", "matrix", "scalar", "string"]),
    result: z.array(
      z.object({
        metric: z.record(z.string(), z.string()),
        value: pair.optional(),
        values: z.array(pair).optional(),
      }),
    ),
  }),
});

export type Sample = { labels: Record<string, string>; value: number | null };

/** "NaN", "+Inf" and unparsable text become null, never a number. */
export function parseSampleValue(text: string): number | null {
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

export type PrometheusConfig = {
  baseUrl: string;
  timeoutMs?: number;
};

export function readPrometheusConfig(
  env: Record<string, string | undefined> = process.env,
): PrometheusConfig {
  return {
    baseUrl: (env.NEXUS_PROMETHEUS_URL ?? "http://127.0.0.1:9090").replace(
      /\/+$/,
      "",
    ),
  };
}

export type PrometheusClient = {
  instant(id: string): Promise<Sample[]>;
  range(id: string, range: string, endMs?: number): Promise<SeriesPoint[]>;
};

export function createPrometheusClient(
  config: PrometheusConfig,
  fetchImpl: typeof fetch = fetch,
): PrometheusClient {
  async function get(path: string, params: Record<string, string>) {
    const url = `${config.baseUrl}${path}?${new URLSearchParams(params)}`;
    let response: Response;
    try {
      response = await fetchImpl(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(config.timeoutMs ?? 4000),
        cache: "no-store",
      });
    } catch {
      throw new PrometheusUnavailableError();
    }
    if (!response.ok) throw new PrometheusUnavailableError();
    const json: unknown = await response.json().catch(() => null);
    const parsed = body.safeParse(json);
    if (!parsed.success) throw new PrometheusUnavailableError();
    return parsed.data.data.result;
  }

  return {
    async instant(id) {
      if (!isQueryId(id)) throw new QueryNotAllowedError();
      const result = await get("/api/v1/query", {
        query: QUERIES[id as QueryId],
      });
      return result.flatMap((r) =>
        r.value
          ? [{ labels: r.metric, value: parseSampleValue(r.value[1]) }]
          : [],
      );
    },

    async range(id, range, endMs = Date.now()) {
      if (!isRangeQueryId(id) || !isRangeId(range)) {
        throw new QueryNotAllowedError();
      }
      const { seconds, stepSeconds } = RANGES[range as RangeId];
      const end = Math.floor(endMs / 1000 / stepSeconds) * stepSeconds;
      const result = await get("/api/v1/query_range", {
        query: QUERIES[id as RangeQueryId],
        start: String(end - seconds),
        end: String(end),
        step: String(stepSeconds),
      });
      const series = result[0]?.values ?? [];
      return series.flatMap(([t, v]) => {
        const value = parseSampleValue(v);
        return value === null ? [] : [{ t: t * 1000, v: value }];
      });
    },
  };
}
