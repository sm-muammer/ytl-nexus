// CI gate: fail and list any banned or non-kebab-case asset filename.
// Scans public/ and assets/ (except assets/source/, which keeps the original
// official filenames on purpose). Run with: npm run assets:check

import { readdirSync } from "node:fs";
import path from "node:path";
import { findBadAssetNames } from "./naming.ts";

const root = path.resolve(import.meta.dirname, "../..");
const scanned = ["public", "assets"];
const skipped = new Set(["assets/source"]);

function walk(relative: string): string[] {
  if (skipped.has(relative)) return [];
  const entries = readdirSync(path.join(root, relative), {
    withFileTypes: true,
  });
  return entries.flatMap((entry) => {
    const child = `${relative}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : [child];
  });
}

const files = scanned.flatMap((dir) => {
  try {
    return walk(dir);
  } catch {
    return [];
  }
});
const bad = findBadAssetNames(files);

if (bad.length > 0) {
  console.error(`Asset filename check failed: ${bad.length} problem(s)`);
  for (const { path: p, reason } of bad) console.error(`  ${p}: ${reason}`);
  process.exit(1);
}
console.log(`Asset filename check passed (${files.length} files).`);
