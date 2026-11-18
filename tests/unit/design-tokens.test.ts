import { readFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";
import {
  brandColours,
  contrastRatio,
  glassSurfaces,
  themes,
  type ThemeName,
} from "../../lib/design/tokens.ts";

const root = path.resolve(import.meta.dirname, "../..");
const css = readFileSync(path.join(root, "app/globals.css"), "utf8");

function themeBlock(name: ThemeName): string {
  const selector = `[data-theme="${name}"] {`;
  const start = css.indexOf(selector);
  expect(start, `${name} theme block in globals.css`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("}", start));
}

describe("contrastRatio", () => {
  it("is 21 for black on white and 1 for identical colours", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#3c3c3c", "#3c3c3c")).toBeCloseTo(1, 5);
  });
});

describe("globals.css matches lib/design/tokens.ts", () => {
  it.each(["dark", "light"] as const)("%s theme roles", (name) => {
    const block = themeBlock(name);
    for (const [role, value] of Object.entries(themes[name])) {
      expect(block, `${name}.${role}`).toContain(`--nx-${role}: ${value};`);
    }
  });

  it.each(["dark", "light"] as const)("%s glass surface roles", (name) => {
    const block = themeBlock(name).replace(/\s+/g, "");
    for (const [role, value] of Object.entries(glassSurfaces[name])) {
      expect(block, `${name}.${role}`).toContain(
        `--nx-${role}:${value.replace(/\s+/g, "")};`,
      );
      expect(css, role).toContain(`--color-${role}: var(--nx-${role});`);
    }
  });

  it("brand colours", () => {
    expect(css).toContain(`--color-ytl-blue: ${brandColours.ytlBlue};`);
    expect(css).toContain(`--color-ytl-black: ${brandColours.ytlBlack};`);
    expect(css).toContain(`--color-ytl-grey: ${brandColours.ytlGrey};`);
    expect(css).toContain(`--color-yes-pink: ${brandColours.yesPink};`);
    expect(css).toContain(
      `--color-yes-gradient-end: ${brandColours.yesGradientEnd};`,
    );
  });

  it("official YTL values from the logo guideline", () => {
    expect(brandColours.ytlBlue).toBe("#00b4f0");
    expect(brandColours.ytlBlack).toBe("#3c3c3c");
    expect(brandColours.ytlGrey).toBe("#bcbcbc");
  });

  it("defines the token groups the plan requires", () => {
    for (const group of [
      "--text-body",
      "--spacing-gutter",
      "--radius-md",
      "--shadow-raised",
      "--duration-base",
      "--ease-out-quint",
      "--z-modal",
    ]) {
      expect(css, group).toContain(`${group}:`);
    }
  });
});

describe.each(["dark", "light"] as const)("%s theme accessibility", (name) => {
  const t = themes[name];
  const textRoles = [
    "ink",
    "muted",
    "accent-ink",
    "pink-ink",
    "violet-ink",
    "ok-ink",
    "warn-ink",
    "bad-ink",
  ] as const;
  const backgrounds = ["canvas", "surface", "surface-raised"] as const;

  it.each(textRoles)("%s text reaches 4.5:1 on every surface", (role) => {
    for (const bg of backgrounds) {
      expect(
        contrastRatio(t[role], t[bg]),
        `${role} on ${bg}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("strong borders reach 3:1 on every surface", () => {
    for (const bg of backgrounds) {
      expect(
        contrastRatio(t["border-strong"], t[bg]),
        bg,
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe("raw hex lint rule (Requirement 2.12)", () => {
  const eslint = new ESLint({ cwd: root });

  async function messages(code: string, filePath: string) {
    const [result] = await eslint.lintText(code, { filePath });
    return result?.messages ?? [];
  }

  it("rejects a raw hex string in component source", async () => {
    const found = await messages(
      'export const c = { color: "#ff0084" };\n',
      path.join(root, "components/ui/example.tsx"),
    );
    expect(found.some((m) => m.ruleId === "no-restricted-syntax")).toBe(true);
  });

  it("rejects a raw hex value inside a Tailwind class string", async () => {
    const found = await messages(
      'export const c = "bg-[#00b4f0] p-4";\n',
      path.join(root, "app/example.tsx"),
    );
    expect(found.some((m) => m.ruleId === "no-restricted-syntax")).toBe(true);
  });

  it("allows semantic tokens", async () => {
    const found = await messages(
      'export const c = "bg-canvas text-ink";\n',
      path.join(root, "components/ui/example.tsx"),
    );
    expect(found.filter((m) => m.ruleId === "no-restricted-syntax")).toEqual(
      [],
    );
  });

  it("allows hex values in lib/design/tokens.ts", async () => {
    const found = await messages(
      'export const c = "#ff0084";\n',
      path.join(root, "lib/design/tokens.ts"),
    );
    expect(found.filter((m) => m.ruleId === "no-restricted-syntax")).toEqual(
      [],
    );
  });
});
