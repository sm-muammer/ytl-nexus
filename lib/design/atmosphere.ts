import type { ThemeName } from "./tokens";

export const ATMOSPHERE_MODES = ["obsidian", "blueprint", "daylight"] as const;

export type AtmosphereMode = (typeof ATMOSPHERE_MODES)[number];

export const DEFAULT_ATMOSPHERE: AtmosphereMode = "obsidian";
export const ATMOSPHERE_STORAGE_KEY = "nexus-atmosphere";
export const ATMOSPHERE_EVENT = "nexus:atmosphere";

export const ATMOSPHERE_META: Record<
  AtmosphereMode,
  { id: AtmosphereMode; label: string; description: string }
> = {
  obsidian: {
    id: "obsidian",
    label: "Obsidian",
    description: "Deep obsidian canvas with subtle atmospheric glow.",
  },
  blueprint: {
    id: "blueprint",
    label: "Blueprint",
    description: "Dark schematic matrix with heightened cyan/indigo lines.",
  },
  daylight: {
    id: "daylight",
    label: "Daylight",
    description: "Warm editorial paper canvas with crisp dark ink.",
  },
};

/** Parses a persisted atmosphere value, defaulting missing or unknown values to obsidian. */
export function parseAtmosphereMode(
  value: string | null | undefined,
): AtmosphereMode {
  if (value === "obsidian" || value === "blueprint" || value === "daylight") {
    return value;
  }
  return DEFAULT_ATMOSPHERE;
}

/** Cycles atmosphere modes in order: obsidian -> blueprint -> daylight -> obsidian. */
export function nextAtmosphereMode(mode: AtmosphereMode): AtmosphereMode {
  const index = ATMOSPHERE_MODES.indexOf(mode);
  return ATMOSPHERE_MODES[(index + 1) % ATMOSPHERE_MODES.length]!;
}

/** Maps an atmosphere mode to the root `data-theme` and `data-atmosphere` DOM attributes. */
export function atmosphereAttributes(mode: AtmosphereMode): {
  theme: ThemeName;
  atmosphere: AtmosphereMode;
} {
  return {
    theme: mode === "daylight" ? "light" : "dark",
    atmosphere: mode,
  };
}
