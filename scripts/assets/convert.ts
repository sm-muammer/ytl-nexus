// Converts the official PDF masters in assets/source/ into cropped SVG files
// and sRGB PNG fallbacks in public/brand/, then writes assets/asset-manifest.md.
//
// Run with: npm run assets:convert
// Needs `pdftocairo` (Homebrew poppler). Output is committed, so CI and the
// server build never need poppler.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import {
  brandMasters,
  pngFilename,
  type BrandMaster,
} from "../../lib/brand/catalog.ts";
import { findBadAssetNames } from "./naming.ts";

const root = path.resolve(import.meta.dirname, "../..");
const outDir = path.join(root, "public/brand");
const manifestPath = path.join(root, "assets/asset-manifest.md");

// Raster scale used only to find the logo bounds: 4 pixels per PDF point.
const BOUNDS_DPI = 288;
const BOUNDS_SCALE = BOUNDS_DPI / 72;
// Padding (PDF points) so anti-aliased edges are never clipped.
const PAD = 0.75;

const sha256 = (file: string) =>
  createHash("sha256").update(readFileSync(file)).digest("hex");

const round = (n: number) => Math.round(n * 100) / 100;

async function opaqueBounds(png: Buffer) {
  const { data, info } = await sharp(png, { limitInputPixels: false })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let minX = info.width;
  let minY = info.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < info.height; y++) {
    for (let x = 0; x < info.width; x++) {
      if ((data[(y * info.width + x) * 4 + 3] ?? 0) > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`No visible pixels`);
  return {
    x: minX / BOUNDS_SCALE,
    y: minY / BOUNDS_SCALE,
    width: (maxX - minX + 1) / BOUNDS_SCALE,
    height: (maxY - minY + 1) / BOUNDS_SCALE,
  };
}

function cleanSvg(
  raw: string,
  b: { x: number; y: number; width: number; height: number },
) {
  const x = round(b.x - PAD);
  const y = round(b.y - PAD);
  const w = round(b.width + PAD * 2);
  const h = round(b.height + PAD * 2);
  const open = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">`;
  return (
    raw
      .replace(/<\?xml[^>]*\?>\s*/, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<metadata[\s\S]*?<\/metadata>/g, "")
      .replace(/<svg[^>]*>/, open)
      .replace(/>\s+</g, "><")
      .trim() + "\n"
  );
}

async function convert(master: BrandMaster, tmp: string) {
  const svgTmp = path.join(tmp, `${master.slug}.svg`);
  execFileSync("pdftocairo", ["-svg", path.join(root, master.pdf), svgTmp]);
  // The reverse-white masters carry a dark full-page backing rectangle for
  // preview. Remove it so the logo is transparent and the bounds are correct.
  // Units become unitless so the render scale below is exactly BOUNDS_SCALE.
  const raw = readFileSync(svgTmp, "utf8")
    .replace(/<rect [^>]*\/>\s*/g, "")
    .replace(
      /(<svg[^>]*?) width="([\d.]+)pt" height="([\d.]+)pt"/,
      '$1 width="$2" height="$3"',
    );
  const bounds = await opaqueBounds(
    await sharp(Buffer.from(raw), {
      density: BOUNDS_DPI,
      limitInputPixels: false,
    })
      .png()
      .toBuffer(),
  );
  const svg = cleanSvg(raw, bounds);
  const svgOut = path.join(outDir, `${master.slug}.svg`);
  writeFileSync(svgOut, svg);

  const sizes: Record<string, [number, number]> = {};
  for (const scale of [1, 2] as const) {
    const width = master.displayWidth * scale;
    const file = path.join(outDir, pngFilename(master, scale));
    // density keeps the vector rasterisation sharp at the target width.
    const info = await sharp(Buffer.from(svg), { density: 72 * 8 })
      .resize({ width })
      .toColourspace("srgb")
      .png({ compressionLevel: 9 })
      .toFile(file);
    sizes[path.basename(file)] = [info.width, info.height];
  }
  const viewBox = /viewBox="([^"]+)"/.exec(svg)![1]!.split(" ").map(Number);
  return { svgOut, viewBox, sizes };
}

function pctRgbToHex(value: string): string {
  const parts = [...value.matchAll(/([\d.]+)%/g)].map((m) =>
    Math.round((Number(m[1]) / 100) * 255),
  );
  return `#${parts.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function yesGradientStops(): string[] {
  const svg = readFileSync(
    path.join(outDir, "yes-logomark-gradient.svg"),
    "utf8",
  );
  // The first gradient is the full pink-to-blue ramp; the others are clipped
  // segments of it.
  const main =
    /<linearGradient[^>]*id="linear-pattern-0"[^>]*>([\s\S]*?)<\/linearGradient>/.exec(
      svg,
    )?.[1] ?? "";
  const stops = [
    ...main.matchAll(/<stop offset="([\d.]+)" stop-color="(rgb\([^"]+\))"/g),
  ].map((m) => ({ offset: Number(m[1]), hex: pctRgbToHex(m[2]!) }));
  // The PDF export writes one stop per few percent; report the key ones.
  return [0, 0.125, 0.5, 1].map((target) => {
    const nearest = stops.reduce((best, s) =>
      Math.abs(s.offset - target) < Math.abs(best.offset - target) ? s : best,
    );
    return `offset ${nearest.offset}: ${nearest.hex}`;
  });
}

function yesPink(): string {
  const svg = readFileSync(path.join(outDir, "yes-logomark-pink.svg"), "utf8");
  const fills = [...svg.matchAll(/fill="(rgb\([^"]+\))"/g)].map((m) =>
    pctRgbToHex(m[1]!),
  );
  return [...new Set(fills)].join(", ");
}

const placement: Record<string, string> = {
  primary:
    "Public pages and documents where the stacked brand lock-up is wanted",
  left: "Website header and footer, left-aligned layouts (preferred for web)",
  centered: "Centred layouts such as the presentation title and sign-in card",
  logomark: "Yes Experience header, favicon source and chatbot avatar",
};

function manifest(
  rows: Array<{
    master: BrandMaster;
    viewBox: number[];
    sizes: Record<string, [number, number]>;
  }>,
  generatedOn: string,
) {
  const header =
    "| Original file | SHA-256 (PDF master) | New SVG | PNG fallbacks (1x, 2x) | Brand | Module | Purpose and placement | Variant | SVG viewBox size | Alt text |\n" +
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |";
  const lines = rows.map(({ master, viewBox, sizes }) => {
    const pngs = Object.entries(sizes)
      .map(([name, [w, h]]) => `\`${name}\` (${w}×${h})`)
      .join("<br>");
    const moduleName =
      master.brand === "yes" ? "Yes Experience" : "Platform shell, Design";
    return `| \`${master.pdf}\` | \`${sha256(path.join(root, master.pdf))}\` | \`${master.slug}.svg\` | ${pngs} | ${master.brand} | ${moduleName} | ${placement[master.arrangement]} | ${master.arrangement} / ${master.variant} | ${round(viewBox[2]!)}×${round(viewBox[3]!)} | ${master.alt} |`;
  });
  return `# Asset manifest

> **Purpose:** the record of every converted brand asset: where it came from, what it is called now, where it is used and how to replace it.
> **Audience:** anyone adding, replacing or auditing logos.
> **Generated:** by \`npm run assets:convert\` on ${generatedOn}. Do not edit the table by hand; edit \`lib/brand/catalog.ts\` and re-run the script.

## Approval

All files are converted, without any change to shape or colour, from the official YTL Communications and Yes logo masters in \`assets/source/\`. The owner confirmed on 2026-10-30 that these masters are approved for public use (decision D-004). The YTL Communications logo guideline governs their use ([design language, brand rules](../docs/design-language.md#6-brand-rules-ytl-communications-logo-guideline)). No separate Yes guideline was supplied; the Yes logomarks are never recoloured.

## How the files are made

1. \`pdftocairo -svg\` converts each vector PDF master to SVG.
2. A raster of the same PDF at 288 dpi gives the visible bounds. The SVG gets a \`viewBox\` that crops to those bounds plus 0.75 pt padding, pixel units, and no comments or metadata.
3. \`sharp\` renders sRGB PNG fallbacks from the cropped SVG at 1x and 2x of the documented display width (named \`-w{width}.png\`).
4. The master PNG sizes in \`lib/brand/catalog.ts\` are checked against the SVG aspect ratio in \`tests/unit/asset-names.test.ts\`.

## Replacement steps

1. Put the new official PDF and PNG in \`assets/source/\` with the original filename and add them to \`assets/source/SHA256SUMS\`.
2. Edit the entry in \`lib/brand/catalog.ts\` (paths, aspect ratio, display width).
3. Run \`npm run assets:convert\`, then \`npm run test\` and \`npm run test:e2e\`.
4. Commit the regenerated \`public/brand/\` files, this manifest and a note in \`docs/PROGRESS.md\`.

## Yes colour extraction

- Pink logomark fill: ${yesPink()}
- Gradient stops (from \`yes-logomark-gradient.svg\`):
${yesGradientStops()
  .map((s) => `  - ${s}`)
  .join("\n")}

## Assets

${header}
${lines.join("\n")}
`;
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const tmp = mkdtempSync(path.join(tmpdir(), "nexus-assets-"));
  try {
    const rows = [];
    for (const master of brandMasters) {
      const { viewBox, sizes } = await convert(master, tmp);
      rows.push({ master, viewBox, sizes });
      console.log(`converted ${master.slug}`);
    }
    writeFileSync(
      manifestPath,
      manifest(rows, new Date().toISOString().slice(0, 10)),
    );
    const bad = findBadAssetNames(
      rows.flatMap((r) => [
        `public/brand/${r.master.slug}.svg`,
        ...Object.keys(r.sizes).map((n) => `public/brand/${n}`),
      ]),
    );
    if (bad.length > 0) throw new Error(`Bad names: ${JSON.stringify(bad)}`);
    console.log(`Wrote ${manifestPath}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

await main();
