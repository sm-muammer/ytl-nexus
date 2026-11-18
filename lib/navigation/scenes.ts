// Backdrop scene for every route. A scene layers up to three things behind the
// page: a tint (coloured light, CSS), a pattern (line work, CSS) and, on public
// pages only, a particle scene drawn on a canvas. Pages that hold forms,
// tables, the inbox or Nexus Control never get a canvas (Requirement 3.14), so
// their backdrops are still: light and line work. Pure data, client-safe.

export const TINTS = [
  "aurora",
  "network",
  "atlas",
  "ember",
  "orbit",
  "signal",
  "library",
  "blossom",
  "violet",
  "flow",
  "mail",
  "shield",
  "quiet",
] as const;

export const PATTERNS = [
  "grid",
  "dots",
  "rings",
  "hex",
  "lines",
  "graph",
] as const;

export const CANVAS_KINDS = [
  "aurora",
  "constellation",
  "embers",
  "orbit",
  "waves",
  "dust",
  "petals",
] as const;

export type Tint = (typeof TINTS)[number];
export type Pattern = (typeof PATTERNS)[number];
export type CanvasKind = (typeof CANVAS_KINDS)[number];

export type SceneConfig = {
  tint: Tint;
  pattern?: Pattern;
  canvas?: CanvasKind;
};

const SCENES: Record<string, SceneConfig> = {
  // Public: tint plus a particle scene of its own (except "/", which renders
  // the 3D WebGL Yes particle logomark instead of a 2D canvas, D-243).
  "/": { tint: "aurora" },
  "/platform": { tint: "network", pattern: "grid", canvas: "constellation" },
  "/story": { tint: "ember", canvas: "embers" },
  "/tour": { tint: "orbit", pattern: "rings", canvas: "orbit" },
  "/status": { tint: "signal", pattern: "grid", canvas: "waves" },
  "/library": { tint: "library", pattern: "lines", canvas: "dust" },
  "/library/[slug]": { tint: "library", pattern: "lines" },
  "/yes": { tint: "blossom", canvas: "petals" },
  "/yes/plans": { tint: "blossom", pattern: "rings" },
  "/yes/coverage": { tint: "blossom", pattern: "dots" },
  "/yes/support": { tint: "blossom", pattern: "lines" },
  // Public form page: still.
  "/signin": { tint: "quiet", pattern: "dots" },
  // Workspace: still, one family per module.
  "/command": { tint: "network", pattern: "rings" },
  "/command/core-01": { tint: "network", pattern: "grid" },
  "/command/metrics": { tint: "network", pattern: "lines" },
  "/command/services": { tint: "network", pattern: "dots" },
  "/command/atlas": { tint: "atlas", pattern: "graph" },
  "/data": { tint: "quiet", pattern: "grid" },
  "/ai": { tint: "violet", pattern: "graph" },
  "/transfer": { tint: "flow", pattern: "lines" },
  "/mail": { tint: "mail", pattern: "dots" },
  "/continuity": { tint: "shield", pattern: "hex" },
  "/shield": { tint: "shield", pattern: "grid" },
  "/studio": { tint: "library", pattern: "dots" },
  "/account": { tint: "flow", pattern: "dots" },
  "/control": { tint: "quiet", pattern: "hex" },
  "/control/users": { tint: "quiet", pattern: "lines" },
  "/design": { tint: "aurora", pattern: "grid" },
};

export function sceneFor(path: string): SceneConfig {
  const scene = SCENES[path];
  if (!scene) throw new Error(`No backdrop scene is registered for ${path}`);
  return scene;
}
