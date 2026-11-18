// Source of truth for the colour values that must also exist in TypeScript:
// the viewport theme colour, contrast checks and the /design swatches.
// app/globals.css holds the same values for CSS; tests/unit/design-tokens.test.ts
// fails if the two drift. This is the only place raw hex values may appear in
// application source.

export const brandColours = {
  // YTL Communications logo guideline.
  ytlBlue: "#00b4f0",
  ytlBlack: "#3c3c3c",
  ytlGrey: "#bcbcbc",
  // Extracted from the official Yes logomark SVGs (see assets/asset-manifest.md).
  yesPink: "#ff0084",
  yesGradientEnd: "#3333ff",
} as const;

export type ThemeName = "dark" | "light";

const dark = {
  canvas: "#070c19",
  surface: "#0d1526",
  "surface-raised": "#16213a",
  ink: "#f2f4f7",
  muted: "#a3aab5",
  line: "#1d2a47",
  "border-strong": "#6d7a92",
  "accent-ink": "#00b4f0",
  "pink-ink": "#ff4fa3",
  "violet-ink": "#b58cff",
  "ok-ink": "#34d399",
  "warn-ink": "#fbbf24",
  "bad-ink": "#ff6b6b",
} as const;

const light = {
  canvas: "#faf7f2",
  surface: "#ffffff",
  "surface-raised": "#f3efe8",
  ink: "#16181d",
  muted: "#596070",
  line: "#e4ded3",
  "border-strong": "#7a8190",
  "accent-ink": "#006e99",
  "pink-ink": "#b8005f",
  "violet-ink": "#6a2bc2",
  "ok-ink": "#0f7a4a",
  "warn-ink": "#8a5a00",
  "bad-ink": "#b42318",
} as const;

export const themes: Record<ThemeName, Record<keyof typeof dark, string>> = {
  dark,
  light,
};

/**
 * Translucent glass surfaces and hairline borders derived from theme roles.
 * Mirrored in app/globals.css so components use bg-glass / border-glass-border.
 */
export const glassSurfaces: Record<
  ThemeName,
  { glass: string; "glass-raised": string; "glass-border": string }
> = {
  dark: {
    glass: "color-mix(in oklab, var(--nx-surface) 68%, transparent)",
    "glass-raised":
      "color-mix(in oklab, var(--nx-surface-raised) 78%, transparent)",
    "glass-border": "color-mix(in oklab, var(--nx-ink) 12%, transparent)",
  },
  light: {
    glass: "color-mix(in oklab, var(--nx-surface) 80%, transparent)",
    "glass-raised":
      "color-mix(in oklab, var(--nx-surface-raised) 88%, transparent)",
    "glass-border": "color-mix(in oklab, var(--nx-ink) 12%, transparent)",
  },
};

export type ThemeRole = keyof typeof dark;

/** Browser chrome colour for the default (dark) workspace theme. */
export const themeColor = dark.canvas;

function channel(value: number): number {
  const s = value / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

/** WCAG 2.x contrast ratio between two #rrggbb colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}
