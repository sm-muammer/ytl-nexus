import { describe, expect, it } from "vitest";
import { PAGES, ROUTE_PATHS } from "@/lib/navigation/modules";
import {
  CANVAS_KINDS,
  PATTERNS,
  TINTS,
  sceneFor,
} from "@/lib/navigation/scenes";

const publicPaths = new Set([
  "/",
  ...PAGES.filter((p) => p.group === "explore" && p.path !== "/signin").map(
    (p) => p.path,
  ),
]);

describe("page backdrops", () => {
  it("gives every route a scene with a known tint and pattern", () => {
    for (const path of ROUTE_PATHS) {
      const scene = sceneFor(path);
      expect(TINTS, path).toContain(scene.tint);
      if (scene.pattern) expect(PATTERNS, path).toContain(scene.pattern);
      if (scene.canvas) expect(CANVAS_KINDS, path).toContain(scene.canvas);
    }
  });

  it("never draws particles on forms, tables, Control, the inbox or workspace pages (Requirement 3.14)", () => {
    for (const path of ROUTE_PATHS) {
      if (!publicPaths.has(path)) {
        expect(sceneFor(path).canvas, path).toBeUndefined();
      }
    }
  });

  it("gives every public page its own particle scene", () => {
    const kinds = [...publicPaths].map((p) => sceneFor(p).canvas);
    for (const kind of kinds) expect(kind).toBeDefined();
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("makes every page's backdrop look different from every other", () => {
    const seen = new Map<string, string>();
    for (const path of ROUTE_PATHS) {
      const s = sceneFor(path);
      const key = `${s.tint}|${s.pattern ?? ""}|${s.canvas ?? ""}`;
      expect(seen.get(key), `${path} repeats ${seen.get(key)}`).toBeUndefined();
      seen.set(key, path);
    }
  });

  it("fails loudly for a route without a scene", () => {
    expect(() => sceneFor("/nope")).toThrowError(/\/nope/);
  });
});
