import { describe, expect, it, vi } from "vitest";
import {
  QUERIES,
  RANGES,
  RANGE_IDS,
  RANGE_QUERY_IDS,
  isQueryId,
  isRangeId,
  isRangeQueryId,
} from "@/lib/monitoring/queries";
import { TRACKED_SERVICES } from "@/lib/monitoring/services";
import { collectHost, collectSnapshot } from "@/lib/server/monitoring/collect";
import {
  PrometheusUnavailableError,
  QueryNotAllowedError,
  createPrometheusClient,
  parseSampleValue,
  readPrometheusConfig,
} from "@/lib/server/prometheus";

// Fixture responses in the shape Prometheus returns. The fake fetch finds the
// query ID from the PromQL text it receives, so a test also proves which
// expression went over the wire.

type Vector = { metric: Record<string, string>; value: [number, string] }[];
const scalar = (v: string): Vector => [{ metric: {}, value: [1, v] }];

function fakeFetch(answers: Partial<Record<keyof typeof QUERIES, Vector>>) {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    const promql = url.searchParams.get("query") ?? "";
    const id = (Object.keys(QUERIES) as (keyof typeof QUERIES)[]).find(
      (k) => QUERIES[k] === promql,
    );
    const result = id ? (answers[id] ?? []) : [];
    if (url.pathname.endsWith("/query_range")) {
      return Response.json({
        status: "success",
        data: {
          resultType: "matrix",
          result: [
            {
              metric: {},
              values: [
                [1000, "1.5"],
                [1030, "NaN"],
                [1060, "2.5"],
              ],
            },
          ],
        },
      });
    }
    return Response.json({
      status: "success",
      data: { resultType: "vector", result },
    });
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

const client = (f: typeof fetch) =>
  createPrometheusClient({ baseUrl: "http://127.0.0.1:9090" }, f);

describe("the PromQL allowlist (CMD-02)", () => {
  it("knows its query IDs and nothing inherited from Object", () => {
    expect(isQueryId("cpu_used_pct")).toBe(true);
    for (const bad of [
      "toString",
      "__proto__",
      "constructor",
      "up",
      "node_cpu_seconds_total",
      'up{job="node"}',
      "",
      undefined,
      null,
      42,
    ]) {
      expect(isQueryId(bad), String(bad)).toBe(false);
    }
  });

  it("keeps every expression fixed: no placeholders, no user input", () => {
    for (const [id, promql] of Object.entries(QUERIES)) {
      expect(promql, id).not.toMatch(/\$\{|%s|\{\{/);
      expect(promql.length, id).toBeGreaterThan(3);
    }
  });

  it("builds the unit query from the tracked units only", () => {
    for (const s of TRACKED_SERVICES) {
      expect(QUERIES.unit_states).toContain(s.unit.replace(".", "\\\\."));
    }
  });

  it("limits range charts to known series and ranges", () => {
    for (const id of RANGE_QUERY_IDS) expect(isRangeQueryId(id)).toBe(true);
    expect(isRangeQueryId("unit_states")).toBe(false);
    expect(RANGE_IDS).toEqual(["1h", "6h", "24h", "7d"]);
    expect(isRangeId("30d")).toBe(false);
    expect(isRangeId("toString")).toBe(false);
  });
});

describe("the Prometheus client", () => {
  it("rejects PromQL text and unknown IDs before any network call", async () => {
    const f = fakeFetch({});
    const c = client(f);
    for (const bad of [
      "up",
      'node_cpu_seconds_total{mode="idle"}',
      "toString",
      "__proto__",
      "{__name__=~'.+'}",
      "",
    ]) {
      await expect(c.instant(bad), bad).rejects.toBeInstanceOf(
        QueryNotAllowedError,
      );
    }
    await expect(c.range("unit_states", "1h")).rejects.toBeInstanceOf(
      QueryNotAllowedError,
    );
    await expect(c.range("cpu_used_pct", "30d")).rejects.toBeInstanceOf(
      QueryNotAllowedError,
    );
    expect(f).not.toHaveBeenCalled();
  });

  it("sends exactly the allowlisted expression", async () => {
    const f = fakeFetch({ node_up: scalar("1") });
    await client(f).instant("node_up");
    const url = new URL(String(f.mock.calls[0]?.[0]));
    expect(url.origin).toBe("http://127.0.0.1:9090");
    expect(url.pathname).toBe("/api/v1/query");
    expect(url.searchParams.get("query")).toBe(QUERIES.node_up);
  });

  it("queries a range with the step of its range ID and drops NaN points", async () => {
    const f = fakeFetch({});
    const points = await client(f).range("cpu_used_pct", "6h", 3_600_000);
    const url = new URL(String(f.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/api/v1/query_range");
    expect(url.searchParams.get("step")).toBe(String(RANGES["6h"].stepSeconds));
    expect(
      Number(url.searchParams.get("end")) -
        Number(url.searchParams.get("start")),
    ).toBe(RANGES["6h"].seconds);
    expect(points).toEqual([
      { t: 1_000_000, v: 1.5 },
      { t: 1_060_000, v: 2.5 },
    ]);
  });

  it("reports an unreachable, failing or malformed Prometheus as unavailable", async () => {
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED 127.0.0.1:9090");
    }) as unknown as typeof fetch;
    const failing = vi.fn(
      async () => new Response("boom", { status: 500 }),
    ) as unknown as typeof fetch;
    const malformed = vi.fn(async () =>
      Response.json({ status: "error", error: "bad" }),
    ) as unknown as typeof fetch;
    for (const f of [down, failing, malformed]) {
      const error = await client(f)
        .instant("node_up")
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(PrometheusUnavailableError);
      // No address or internal text leaks through the error.
      expect((error as Error).message).toBe("prometheus-unavailable");
    }
  });

  it("turns NaN and infinity into null", () => {
    expect(parseSampleValue("NaN")).toBeNull();
    expect(parseSampleValue("+Inf")).toBeNull();
    expect(parseSampleValue("-Inf")).toBeNull();
    expect(parseSampleValue("")).toBe(0);
    expect(parseSampleValue("12.5")).toBe(12.5);
  });

  it("defaults to the loopback address", () => {
    expect(readPrometheusConfig({}).baseUrl).toBe("http://127.0.0.1:9090");
    expect(
      readPrometheusConfig({ NEXUS_PROMETHEUS_URL: "http://127.0.0.1:9191/" })
        .baseUrl,
    ).toBe("http://127.0.0.1:9191");
  });
});

describe("collecting a snapshot from fixture responses", () => {
  const unit = (name: string, state: string): Vector[number] => ({
    metric: { name, state },
    value: [1, "1"],
  });

  const answers = {
    cpu_used_pct: scalar("12.5"),
    load1: scalar("0.4"),
    load5: scalar("0.5"),
    load15: scalar("0.6"),
    mem_used_pct: scalar("48"),
    swap_used_pct: scalar("NaN"),
    disk_used_pct: scalar("37.5"),
    disk_read_bps: scalar("1000"),
    disk_write_bps: scalar("2000"),
    net_rx_bps: scalar("300"),
    net_tx_bps: scalar("400"),
    uptime_s: scalar("86400"),
    systemd_collector: scalar("1"),
    unit_states: [
      unit("httpd.service", "active"),
      unit("nexus-web.service", "active"),
      unit("mariadb.service", "failed"),
      unit("dovecot.service", "inactive"),
      unit("ollama.service", "activating"),
      unit("evil.service", "active"),
      unit("php-fpm.service", "bogus-state"),
    ],
  } satisfies Parameters<typeof fakeFetch>[0];

  it("maps values, states, and treats missing units as not installed", async () => {
    const snap = await collectSnapshot(client(fakeFetch(answers)), 5000, 15000);
    expect(snap).toMatchObject({
      source: "live",
      takenAt: 5000,
      intervalMs: 15000,
      reachable: true,
    });
    expect(snap.metrics).toMatchObject({
      cpuPct: 12.5,
      load1: 0.4,
      memPct: 48,
      swapPct: null,
      diskPct: 37.5,
      netRxBps: 300,
      uptimeSeconds: 86400,
    });
    const state = (id: string) => snap.services.find((s) => s.id === id)?.state;
    expect(state("apache")).toBe("active");
    expect(state("mariadb")).toBe("failed");
    expect(state("dovecot")).toBe("inactive");
    expect(state("ollama")).toBe("activating");
    expect(state("sftpgo")).toBe("absent");
    // A state outside the known set is not trusted.
    expect(state("php-fpm")).toBe("absent");
    // A unit that is not tracked never appears.
    expect(snap.services.map((s) => s.unit)).not.toContain("evil.service");
    expect(snap.services).toHaveLength(TRACKED_SERVICES.length);
  });

  it("marks states unknown, not absent, when the systemd collector is silent", async () => {
    const snap = await collectSnapshot(
      client(fakeFetch({ ...answers, systemd_collector: [], unit_states: [] })),
      0,
      15000,
    );
    expect(snap.services.every((s) => s.state === "unknown")).toBe(true);
  });

  it("keeps the other values when one query fails", async () => {
    const f = vi.fn(async (input: string | URL | Request) => {
      const q = new URL(String(input)).searchParams.get("query");
      if (q === QUERIES.cpu_used_pct) return new Response("x", { status: 500 });
      return Response.json({
        status: "success",
        data: { resultType: "vector", result: scalar("7") },
      });
    }) as unknown as typeof fetch;
    const snap = await collectSnapshot(client(f), 0, 15000);
    expect(snap.metrics.cpuPct).toBeNull();
    expect(snap.metrics.memPct).toBe(7);
  });

  it("fails when nothing can be read", async () => {
    const down = vi.fn(async () => {
      throw new Error("down");
    }) as unknown as typeof fetch;
    await expect(
      collectSnapshot(client(down), 0, 15000),
    ).rejects.toBeInstanceOf(PrometheusUnavailableError);
  });

  it("reads server identity and size without a hostname or address", async () => {
    const host = await collectHost(
      client(
        fakeFetch({
          host_kernel: [
            {
              metric: {
                release: "4.18.0-553.el8_10",
                machine: "x86_64",
                nodename: "sn1lyvx1d0002.ytlcomms.my",
              },
              value: [1, "1"],
            },
          ],
          host_os: [
            { metric: { pretty_name: "Rocky Linux 8.10" }, value: [1, "1"] },
          ],
          cores: scalar("4"),
          mem_total_bytes: scalar("8589934592"),
          disk_total_bytes: scalar("85899345920"),
        }),
      ),
    );
    expect(host).toEqual({
      os: "Rocky Linux 8.10",
      kernel: "4.18.0-553.el8_10",
      arch: "x86_64",
      cores: 4,
      memTotalBytes: 8589934592,
      diskTotalBytes: 85899345920,
    });
    expect(JSON.stringify(host)).not.toMatch(/ytlcomms|sn1lyvx/);
  });
});
