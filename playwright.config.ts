import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;
const isCI = Boolean(process.env.CI);

// In CI the workflow runs `npm run build` first, then Playwright starts the
// production server. Locally Playwright reuses a running `npm run dev`.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium-desktop",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: isCI
          ? `npm run start -- -p ${port}`
          : `npm run dev -- -p ${port}`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
        // Browser tests run on fixtures, so they need no server and no network.
        env: { NEXUS_MODE: "demo" },
      },
});
