import { describe, expect, it } from "vitest";
import {
  BUDGET_GZIP_BYTES,
  inspectThreeIsolation,
  measureAllRoutes,
  type RouteBundleSize,
} from "../../scripts/quality/measure-bundles";

describe("bundle budgets (Requirement 18.1)", () => {
  const routes = measureAllRoutes();

  it("measures all application routes", () => {
    expect(routes.length).toBeGreaterThanOrEqual(16);
  });

  it.each(routes)(
    "$route is within 170 KB gzip ($totalGzipKb KB)",
    (item: RouteBundleSize) => {
      expect(item.totalGzipBytes).toBeLessThanOrEqual(BUDGET_GZIP_BYTES);
      expect(item.passed).toBe(true);
    },
  );

  it("isolates Three.js exclusively to the home route chunk (spec 24 D-242)", () => {
    const report = inspectThreeIsolation();
    expect(report.threeChunks.length).toBeGreaterThan(0);
    expect(report.hasHomeThreeChunk).toBe(true);
    expect(report.leakingManifests).toEqual([]);
  });
});
