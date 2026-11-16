import { readFileSync, existsSync, globSync } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Measures the first-load JS gzip size for all Next.js App Router routes.
// Enforces the 170 KB gzip budget defined in Requirement 18.

const cwd = process.cwd();
const dotNext = path.join(cwd, ".next");
const buildManifestPath = path.join(dotNext, "build-manifest.json");

if (!existsSync(buildManifestPath)) {
  console.error(
    ".next/build-manifest.json not found. Run `npm run build` first.",
  );
  process.exit(1);
}

const buildManifest = JSON.parse(readFileSync(buildManifestPath, "utf-8"));
const rootMainFiles: string[] = [
  ...(buildManifest.polyfillFiles || []),
  ...(buildManifest.rootMainFiles || []),
];

// Helper to calculate gzip size
const cache = new Map<string, number>();
function getGzipSize(relativePath: string): number {
  if (cache.has(relativePath)) return cache.get(relativePath)!;
  const fullPath = path.join(dotNext, relativePath.replace(/^\/_next\//, ""));
  if (!existsSync(fullPath)) {
    return 0;
  }
  const content = readFileSync(fullPath);
  const compressed = zlib.gzipSync(content, { level: 9 });
  const size = compressed.length;
  cache.set(relativePath, size);
  return size;
}

// Find all client-reference-manifest.js files
const clientManifests = globSync(
  ".next/server/app/**/*_client-reference-manifest.js",
  { cwd },
);

export type RouteBundleSize = {
  route: string;
  totalGzipBytes: number;
  totalGzipKb: number;
  chunkCount: number;
  passed: boolean;
};

export const BUDGET_GZIP_BYTES = 170 * 1024; // 170 KB gzip budget

export function measureAllRoutes(): RouteBundleSize[] {
  const results: RouteBundleSize[] = [];

  for (const manifestFile of clientManifests) {
    const filePath =
      typeof manifestFile === "string" ? manifestFile : String(manifestFile);
    const content = readFileSync(path.join(cwd, filePath), "utf-8");
    // Parse globalThis.__RSC_MANIFEST
    const match = content.match(
      /globalThis\.__RSC_MANIFEST\["([^"]+)"\]\s*=\s*(\{.*?\});\s*$/m,
    );
    if (!match || !match[1] || !match[2]) continue;
    const routeKey = match[1];
    let manifestData: { entryJSFiles?: Record<string, string[]> };
    try {
      manifestData = JSON.parse(match[2]) as {
        entryJSFiles?: Record<string, string[]>;
      };
    } catch {
      continue;
    }

    const entryJSFiles: Record<string, string[]> =
      manifestData.entryJSFiles || {};
    const pageKey = `[project]${routeKey}`;
    const pageChunks: string[] = entryJSFiles[pageKey] || [];

    // All chunks loaded on initial page load: root framework chunks + page/layout chunks
    const allChunks = new Set<string>([...rootMainFiles, ...pageChunks]);

    let totalGzipBytes = 0;
    for (const chunk of allChunks) {
      totalGzipBytes += getGzipSize(chunk);
    }

    const totalGzipKb = Math.round((totalGzipBytes / 1024) * 10) / 10;
    results.push({
      route: routeKey,
      totalGzipBytes,
      totalGzipKb,
      chunkCount: allChunks.size,
      passed: totalGzipBytes <= BUDGET_GZIP_BYTES,
    });
  }

  results.sort((a, b) => b.totalGzipBytes - a.totalGzipBytes);
  return results;
}

if (process.argv[1]?.endsWith("measure-bundles.ts")) {
  const results = measureAllRoutes();
  console.log(`Measured ${results.length} routes against 170 KB gzip budget:`);
  let hasFailure = false;
  for (const res of results) {
    const status = res.passed ? "✓ PASS" : "✗ FAIL";
    console.log(
      `  ${status} [${res.totalGzipKb} KB] (${res.chunkCount} chunks) ${res.route}`,
    );
    if (!res.passed) hasFailure = true;
  }
  if (hasFailure) {
    console.error(`\nOne or more routes exceeded the 170 KB gzip budget!`);
    process.exit(1);
  } else {
    console.log(`\nAll routes passed the bundle budget!`);
  }
}
