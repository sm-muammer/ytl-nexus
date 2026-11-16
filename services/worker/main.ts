import { createDb, readDbConfig } from "../../lib/server/db/connection.ts";
import { CHECK_INTERVAL_MS } from "../../lib/status/checks.ts";
import { pruneChecks, runCheckRound } from "./run-checks.ts";
import { indexRunbooks } from "../../lib/server/ai/indexer.ts";

// nexus-worker: runs the predefined service checks every 60 seconds. Later
// tasks add AI indexing and report ingestion to this process. Runs as the
// `nexus` user with the application's database settings (web.env).

const db = createDb(readDbConfig(), { connectionLimit: 2 });
let stopping = false;
let lastPrune = 0;
let lastAiIndex = 0;

async function tick(): Promise<void> {
  const now = new Date();
  try {
    const { stored } = await runCheckRound(db, now);
    console.log(JSON.stringify({ round: "ok", stored }));
    if (now.getTime() - lastPrune > 6 * 3_600_000) {
      lastPrune = now.getTime();
      const removed = await pruneChecks(db, now);
      console.log(JSON.stringify({ prune: "ok", removed }));
    }

    // Periodic AI runbooks indexing (every 12 hours)
    if (now.getTime() - lastAiIndex > 12 * 3_600_000) {
      lastAiIndex = now.getTime();
      try {
        const { indexed, files } = await indexRunbooks(db);
        console.log(JSON.stringify({ aiIndex: "ok", indexed, files }));
      } catch (err: unknown) {
        const error = err instanceof Error ? err.message : "error";
        console.error(JSON.stringify({ aiIndex: "failed", error }));
      }
    }
  } catch (error) {
    // The error class only: a driver message can carry a host or a user name.
    console.error(
      JSON.stringify({
        round: "failed",
        error: error instanceof Error ? error.name : "unknown",
      }),
    );
  }
}

async function main(): Promise<void> {
  console.log(JSON.stringify({ started: true, intervalMs: CHECK_INTERVAL_MS }));
  while (!stopping) {
    const started = Date.now();
    await tick();
    const wait = Math.max(1_000, CHECK_INTERVAL_MS - (Date.now() - started));
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  await db.destroy();
}

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    stopping = true;
    // Do not wait out the sleep: the unit's stop timeout is short.
    setTimeout(() => process.exit(0), 500).unref();
  });
}

void main();
