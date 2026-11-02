import "server-only";

export type CheckState = "ok" | "unavailable" | "not-configured";

export type ReadinessChecks = Record<string, CheckState>;

export interface ReadinessResult {
  ready: boolean;
  checks: ReadinessChecks;
}

export type Probe = () => Promise<CheckState>;

/**
 * The checks behind `/api/health/ready`. The database probe is added in
 * Task 5 (requirements 5.11 and 5.12); until then it reports "not-configured"
 * rather than pretending to be healthy.
 */
export const defaultProbes: Record<string, Probe> = {
  database: async () => "not-configured",
};

const DEFAULT_TIMEOUT_MS = 2000;

async function runProbe(probe: Probe, timeoutMs: number): Promise<CheckState> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const timeout = new Promise<CheckState>((resolve) => {
      timer = setTimeout(() => resolve("unavailable"), timeoutMs);
    });
    return await Promise.race([probe(), timeout]);
  } catch {
    // The error text can contain hosts, paths or credentials; report only the state.
    return "unavailable";
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs every probe in parallel, each bounded by `timeoutMs` (2 s by default).
 * A probe that fails, throws or times out is "unavailable". The process is
 * ready only when no check is unavailable.
 */
export async function checkReadiness(
  probes: Record<string, Probe> = defaultProbes,
  options: { timeoutMs?: number } = {},
): Promise<ReadinessResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const names = Object.keys(probes);
  const states = await Promise.all(
    names.map((name) => runProbe(probes[name] as Probe, timeoutMs)),
  );
  const checks: ReadinessChecks = { app: "ok" };
  names.forEach((name, index) => {
    checks[name] = states[index] as CheckState;
  });
  const ready = Object.values(checks).every((state) => state !== "unavailable");
  return { ready, checks };
}
