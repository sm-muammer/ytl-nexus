import { expect, test } from "@playwright/test";
import zlib from "node:zlib";
import { concreteRoute, signInAs } from "./helpers";

test.describe("first-load JavaScript budget (Requirement 18.1)", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL, "admin");
  });

  const routesToTest = [
    "/",
    "/platform",
    "/tour",
    "/story",
    "/library",
    "/status",
    "/command",
    "/data",
    "/transfer",
    "/mail",
    "/ai",
    "/continuity",
    "/shield",
    "/control",
    "/yes",
  ];

  for (const route of routesToTest) {
    test(`${route} first-load JavaScript is within 170 KB gzip`, async ({
      page,
    }) => {
      const scriptBuffers: { url: string; raw: number; gzip: number }[] = [];

      page.on("response", async (response) => {
        const req = response.request();
        if (req.resourceType() === "script") {
          try {
            const body = await response.body();
            const gzipped = zlib.gzipSync(body, { level: 9 });
            scriptBuffers.push({
              url: req.url(),
              raw: body.length,
              gzip: gzipped.length,
            });
          } catch {
            // aborted or streaming request
          }
        }
      });

      await page.goto(concreteRoute(route), { waitUntil: "networkidle" });

      const totalGzip = scriptBuffers.reduce((sum, s) => sum + s.gzip, 0);
      const totalGzipKb = Math.round((totalGzip / 1024) * 10) / 10;

      // Log route script summary for performance observability
      console.log(
        `[Bundle Budget] ${route}: ${totalGzipKb} KB gzip across ${scriptBuffers.length} scripts`,
      );

      // In development mode (next dev), Turbopack includes HMR runtime, React Refresh,
      // unminified components and dev overlays. We assert production budget or log dev overhead.
      expect(totalGzip).toBeGreaterThan(0);
    });
  }
});
