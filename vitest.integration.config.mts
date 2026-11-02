import path from "node:path";
import { defineConfig } from "vitest/config";

// Integration tests talk to a real MariaDB 10.5 (`npm run db:test:up`, or the
// service container in CI). They are separate from `npm run test` so the fast
// check never needs Docker. Each test file creates its own scratch database.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // The real package throws outside the Next.js server bundle.
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/setup/server-only-stub.ts",
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    restoreMocks: true,
  },
});
