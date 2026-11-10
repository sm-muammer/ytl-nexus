// Runs every allowlisted query against a real Prometheus and prints what came
// back, so a wrong label or a missing collector shows up before the dashboard
// does. Read-only.
//
//   ssh -N -L 19090:127.0.0.1:9090 root@10.26.64.164 &      # tunnel from the Mac
//   NEXUS_PROMETHEUS_URL=http://127.0.0.1:19090 npm run monitoring:check
//
// On the server itself the default http://127.0.0.1:9090 works.
import {
  QUERIES,
  RANGES,
  RANGE_QUERY_IDS,
} from "../../lib/monitoring/queries.ts";

const base = (
  process.env.NEXUS_PROMETHEUS_URL ?? "http://127.0.0.1:9090"
).replace(/\/+$/, "");

type Result = {
  metric: Record<string, string>;
  value?: [number, string];
  values?: [number, string][];
};

async function get(
  path: string,
  params: Record<string, string>,
): Promise<Result[]> {
  const res = await fetch(`${base}${path}?${new URLSearchParams(params)}`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = (await res.json()) as {
    status: string;
    data: { result: Result[] };
  };
  if (json.status !== "success") throw new Error("status " + json.status);
  return json.data.result;
}

let problems = 0;
console.log(`Prometheus at ${base}\n`);
for (const [id, promql] of Object.entries(QUERIES)) {
  try {
    const result = await get("/api/v1/query", { query: promql });
    const first = result[0]?.value?.[1];
    const shown =
      id === "unit_states"
        ? result.map((r) => `${r.metric.name}=${r.metric.state}`).join(", ")
        : id === "host_kernel" || id === "host_os"
          ? JSON.stringify({ ...result[0]?.metric, nodename: undefined })
          : first;
    console.log(
      `${result.length === 0 ? "EMPTY" : "ok   "}  ${id.padEnd(18)} ${shown ?? ""}`,
    );
    if (result.length === 0 && id !== "swap_used_pct") problems += 1;
  } catch (e) {
    problems += 1;
    console.log(`FAIL   ${id.padEnd(18)} ${(e as Error).message}`);
  }
}

console.log("\nRange queries (1h)");
for (const id of RANGE_QUERY_IDS) {
  try {
    const { seconds, stepSeconds } = RANGES["1h"];
    const end = Math.floor(Date.now() / 1000);
    const result = await get("/api/v1/query_range", {
      query: QUERIES[id],
      start: String(end - seconds),
      end: String(end),
      step: String(stepSeconds),
    });
    const n = result[0]?.values?.length ?? 0;
    console.log(
      `${n === 0 ? "EMPTY" : "ok   "}  ${id.padEnd(18)} ${n} points, ${result.length} series`,
    );
    if (n === 0) problems += 1;
  } catch (e) {
    problems += 1;
    console.log(`FAIL   ${id.padEnd(18)} ${(e as Error).message}`);
  }
}

console.log(
  problems === 0 ? "\nAll queries answered." : `\n${problems} problem(s).`,
);
process.exit(problems === 0 ? 0 : 1);
