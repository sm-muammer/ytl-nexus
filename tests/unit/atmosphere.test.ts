import { describe, expect, it } from "vitest";
import {
  ATMOSPHERE_META,
  ATMOSPHERE_MODES,
  ATMOSPHERE_STORAGE_KEY,
  DEFAULT_ATMOSPHERE,
  atmosphereAttributes,
  nextAtmosphereMode,
  parseAtmosphereMode,
} from "@/lib/design/atmosphere";

describe("atmosphere modes", () => {
  it("defines obsidian, blueprint and daylight modes with metadata", () => {
    expect(ATMOSPHERE_MODES).toEqual(["obsidian", "blueprint", "daylight"]);
    expect(DEFAULT_ATMOSPHERE).toBe("obsidian");
    expect(ATMOSPHERE_STORAGE_KEY).toBe("nexus-atmosphere");
    for (const mode of ATMOSPHERE_MODES) {
      expect(ATMOSPHERE_META[mode].id).toBe(mode);
      expect(ATMOSPHERE_META[mode].label.length).toBeGreaterThan(0);
      expect(ATMOSPHERE_META[mode].description.length).toBeGreaterThan(0);
    }
  });

  it("parses valid modes and defaults missing or unknown values to obsidian", () => {
    expect(parseAtmosphereMode("obsidian")).toBe("obsidian");
    expect(parseAtmosphereMode("blueprint")).toBe("blueprint");
    expect(parseAtmosphereMode("daylight")).toBe("daylight");
    expect(parseAtmosphereMode(null)).toBe("obsidian");
    expect(parseAtmosphereMode(undefined)).toBe("obsidian");
    expect(parseAtmosphereMode("")).toBe("obsidian");
    expect(parseAtmosphereMode("neon")).toBe("obsidian");
  });

  it("cycles obsidian -> blueprint -> daylight -> obsidian", () => {
    expect(nextAtmosphereMode("obsidian")).toBe("blueprint");
    expect(nextAtmosphereMode("blueprint")).toBe("daylight");
    expect(nextAtmosphereMode("daylight")).toBe("obsidian");
  });

  it("maps each atmosphere mode to its DOM theme and atmosphere attributes", () => {
    expect(atmosphereAttributes("obsidian")).toEqual({
      theme: "dark",
      atmosphere: "obsidian",
    });
    expect(atmosphereAttributes("blueprint")).toEqual({
      theme: "dark",
      atmosphere: "blueprint",
    });
    expect(atmosphereAttributes("daylight")).toEqual({
      theme: "light",
      atmosphere: "daylight",
    });
  });
});
