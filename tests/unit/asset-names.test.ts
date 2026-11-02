import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  findBadAssetNames,
  isKebabCaseAssetName,
} from "../../scripts/assets/naming.ts";
import { brandAssetFilenames, brandMasters } from "../../lib/brand/catalog.ts";

const root = path.resolve(import.meta.dirname, "../..");

describe("isKebabCaseAssetName", () => {
  it.each([
    "ytl-communications-left-main-colour.svg",
    "yes-logomark-gradient-w96.png",
    "asset-manifest.md",
  ])("accepts %s", (name) => {
    expect(isKebabCaseAssetName(name)).toBe(true);
  });

  it.each([
    "YTL Communications_Left Logo_Final.png",
    "Yes_Logomark_Pink.pdf",
    "logo--double.svg",
    "-leading.svg",
    "trailing-.svg",
    "no-extension",
    "under_score.svg",
  ])("rejects %s", (name) => {
    expect(isKebabCaseAssetName(name)).toBe(false);
  });
});

describe("findBadAssetNames", () => {
  it("reports non-kebab-case names with a reason", () => {
    const bad = findBadAssetNames(["public/brand/Logo Final.png"]);
    expect(bad).toHaveLength(1);
    expect(bad[0]?.path).toBe("public/brand/Logo Final.png");
    expect(bad[0]?.reason).toMatch(/kebab-case/);
  });

  it.each(["final", "copy", "untitled", "screenshot", "temp"])(
    "reports the banned word %s even when the name is kebab-case",
    (word) => {
      const bad = findBadAssetNames([`public/brand/logo-${word}.svg`]);
      expect(bad).toHaveLength(1);
      expect(bad[0]?.reason).toMatch(/banned/);
    },
  );

  it("checks directory segments as well as the filename", () => {
    expect(findBadAssetNames(["public/Brand Files/logo.svg"])).toHaveLength(1);
  });

  it("ignores dotfiles", () => {
    expect(findBadAssetNames(["public/brand/.DS_Store"])).toEqual([]);
  });

  it("accepts a clean list", () => {
    expect(
      findBadAssetNames([
        "public/brand/yes-logomark-pink.svg",
        "public/brand/yes-logomark-pink-w96.png",
      ]),
    ).toEqual([]);
  });
});

describe("brand catalog", () => {
  it("covers 15 YTL Communications logos and 4 Yes logomarks", () => {
    expect(
      brandMasters.filter((m) => m.brand === "ytl-communications"),
    ).toHaveLength(15);
    expect(brandMasters.filter((m) => m.brand === "yes")).toHaveLength(4);
  });

  it("uses only kebab-case, non-banned output names", () => {
    expect(findBadAssetNames(brandAssetFilenames())).toEqual([]);
  });

  it("names PNG fallbacks with a -w{width} suffix at 1x and 2x", () => {
    const left = brandMasters.find(
      (m) => m.slug === "ytl-communications-left-main-colour",
    );
    expect(left).toBeDefined();
    const pngs = brandAssetFilenames().filter((n) =>
      n.startsWith("ytl-communications-left-main-colour-w"),
    );
    expect(pngs).toHaveLength(2);
    const widths = pngs.map((n) => Number(/-w(\d+)\.png$/.exec(n)?.[1]));
    expect(widths[1]).toBe((widths[0] ?? 0) * 2);
  });
});

describe("generated brand assets in public/brand", () => {
  const dir = path.join(root, "public/brand");
  const present = new Set(readdirSync(dir));

  it("contains every file the catalog promises", () => {
    const missing = brandAssetFilenames().filter((n) => !present.has(n));
    expect(missing).toEqual([]);
  });

  it("passes the filename check", () => {
    const names = [...present].map((n) => `public/brand/${n}`);
    expect(findBadAssetNames(names)).toEqual([]);
  });

  it("has a tight viewBox, pixel units and no leftover metadata in every SVG", () => {
    for (const master of brandMasters) {
      const svg = readFileSync(path.join(dir, `${master.slug}.svg`), "utf8");
      const viewBox = /viewBox="([\d.\s-]+)"/
        .exec(svg)?.[1]
        ?.split(/\s+/)
        .map(Number);
      expect(viewBox, master.slug).toHaveLength(4);
      expect(svg, master.slug).not.toMatch(/width="[\d.]+pt"/);
      expect(svg, master.slug).not.toMatch(/<!--/);
      expect(svg, master.slug).not.toMatch(/<metadata/);
      const [, , w, h] = viewBox as number[];
      // The master PNGs are cropped to the logo; the SVG must match their shape.
      const ratio = (w as number) / (h as number);
      expect(ratio, master.slug).toBeGreaterThan(master.aspectRatio * 0.97);
      expect(ratio, master.slug).toBeLessThan(master.aspectRatio * 1.03);
    }
  });

  it("keeps the Yes gradient as real gradient stops", () => {
    const svg = readFileSync(
      path.join(dir, "yes-logomark-gradient.svg"),
      "utf8",
    );
    expect(svg).toMatch(/<linearGradient/);
    expect(svg).toMatch(/<stop /);
  });
});
