import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Unit tests only. Integration tests (database, services) get their own config
// in Task 5; end-to-end tests run through Playwright (playwright.config.ts).
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Resolves the "@/*" alias from tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    include: ["tests/unit/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup/vitest.setup.ts"],
    restoreMocks: true,
  },
});
