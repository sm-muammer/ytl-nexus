// Atlas graph model (ATL-01, ATL-05). Pure functions with no I/O, safe for the
// server, the browser and tests. An edge `{ from, to }` means "from depends on
// to": if `to` fails, `from` is affected.

export type AtlasEdge = { from: string; to: string };

export type AtlasGraph = {
  slugs: string[];
  /** Edges with unknown ends, self-loops and duplicates removed. */
  edges: AtlasEdge[];
  /** What a service needs (its dependencies). */
  upstream: Record<string, string[]>;
  /** What needs a service (its dependents). */
  downstream: Record<string, string[]>;
  /** Column per service: 0 for entry points, then one more per dependency step. */
  layer: Record<string, number>;
  /** Services per column, ordered to keep edges short. */
  layers: string[][];
};

export function buildGraph(
  slugs: readonly string[],
  edges: readonly AtlasEdge[],
): AtlasGraph {
  const known = new Set(slugs);
  const seen = new Set<string>();
  const clean: AtlasEdge[] = [];
  for (const e of edges) {
    if (!known.has(e.from) || !known.has(e.to) || e.from === e.to) continue;
    const key = `${e.from}\u0000${e.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({ from: e.from, to: e.to });
  }

  const upstream: Record<string, string[]> = {};
  const downstream: Record<string, string[]> = {};
  for (const s of slugs) {
    upstream[s] = [];
    downstream[s] = [];
  }
  for (const e of clean) {
    upstream[e.from]!.push(e.to);
    downstream[e.to]!.push(e.from);
  }

  // Longest path from an entry point. The pass count is capped, so a cycle in
  // bad data ends the loop instead of running forever.
  const layer: Record<string, number> = {};
  for (const s of slugs) layer[s] = 0;
  for (let pass = 0; pass < slugs.length; pass++) {
    let changed = false;
    for (const e of clean) {
      const wanted = layer[e.from]! + 1;
      if (layer[e.to]! < wanted && wanted < slugs.length) {
        layer[e.to] = wanted;
        changed = true;
      }
    }
    if (!changed) break;
  }

  const count = slugs.reduce((m, s) => Math.max(m, layer[s]!), 0) + 1;
  const layers: string[][] = Array.from(
    { length: slugs.length ? count : 0 },
    () => [],
  );
  for (const s of slugs) layers[layer[s]!]!.push(s);

  // Two sweeps that order each column by the average position of its neighbours.
  const order = new Map<string, number>();
  const index = () => {
    for (const col of layers) col.forEach((s, i) => order.set(s, i));
  };
  index();
  const bary = (s: string, neighbours: string[]) => {
    const placed = neighbours.filter((n) => order.has(n));
    if (placed.length === 0) return order.get(s)!;
    return placed.reduce((sum, n) => sum + order.get(n)!, 0) / placed.length;
  };
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let c = 1; c < layers.length; c++) {
      layers[c] = stableSort(layers[c]!, (s) => bary(s, downstream[s]!));
      index();
    }
    for (let c = layers.length - 2; c >= 0; c--) {
      layers[c] = stableSort(layers[c]!, (s) => bary(s, upstream[s]!));
      index();
    }
  }

  return {
    slugs: [...slugs],
    edges: clean,
    upstream,
    downstream,
    layer,
    layers,
  };
}

function stableSort(items: string[], key: (s: string) => number): string[] {
  return items
    .map((s, i) => ({ s, i, k: key(s) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.s);
}

/** Every service reached by following `direction` from `slug`, not including it. */
export function reach(
  graph: AtlasGraph,
  slug: string,
  direction: "upstream" | "downstream",
): string[] {
  const map = graph[direction];
  const out: string[] = [];
  const seen = new Set([slug]);
  const queue = [...(map[slug] ?? [])];
  while (queue.length > 0) {
    const next = queue.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    out.push(next);
    queue.push(...(map[next] ?? []));
  }
  return out;
}

// ---- Layout ----------------------------------------------------------------

export const NODE_W = 220;
export const NODE_H = 56;
const GAP_X = 96;
const GAP_Y = 24;
const PAD = 16;

export type Placed = { slug: string; x: number; y: number };

export type Layout = {
  width: number;
  height: number;
  nodes: Placed[];
  byslug: Record<string, Placed>;
};

export function layoutGraph(graph: AtlasGraph): Layout {
  const rows = graph.layers.reduce((m, c) => Math.max(m, c.length), 0);
  const colHeight = rows * NODE_H + Math.max(0, rows - 1) * GAP_Y;
  const nodes: Placed[] = [];
  const byslug: Record<string, Placed> = {};
  graph.layers.forEach((col, c) => {
    const height = col.length * NODE_H + Math.max(0, col.length - 1) * GAP_Y;
    const top = PAD + (colHeight - height) / 2;
    col.forEach((slug, r) => {
      const p = {
        slug,
        x: PAD + c * (NODE_W + GAP_X),
        y: top + r * (NODE_H + GAP_Y),
      };
      nodes.push(p);
      byslug[slug] = p;
    });
  });
  const cols = graph.layers.length;
  return {
    width: PAD * 2 + cols * NODE_W + Math.max(0, cols - 1) * GAP_X,
    height: PAD * 2 + colHeight,
    nodes,
    byslug,
  };
}

/** A smooth curve from the left edge of `from` to the right edge of `to`'s column. */
export function edgePath(layout: Layout, edge: AtlasEdge): string | null {
  const a = layout.byslug[edge.from];
  const b = layout.byslug[edge.to];
  if (!a || !b) return null;
  const x1 = a.x + NODE_W;
  const y1 = a.y + NODE_H / 2;
  const x2 = b.x;
  const y2 = b.y + NODE_H / 2;
  const mid = (x1 + x2) / 2;
  return `M${x1} ${y1} C${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
}

// ---- Keyboard --------------------------------------------------------------

export type Direction = "left" | "right" | "up" | "down";

/**
 * The next node for an arrow key. Up and down stay in the column; left and
 * right go to the nearest node (by height) in the neighbouring column,
 * skipping empty columns. Returns `from` when there is nowhere to go.
 */
export function moveFocus(
  graph: AtlasGraph,
  layout: Layout,
  from: string,
  direction: Direction,
): string {
  const here = layout.byslug[from];
  if (!here) return from;
  const c = graph.layer[from]!;
  const col = graph.layers[c]!;
  const r = col.indexOf(from);
  if (direction === "up") return col[Math.max(0, r - 1)] ?? from;
  if (direction === "down") return col[Math.min(col.length - 1, r + 1)] ?? from;
  const step = direction === "right" ? 1 : -1;
  for (let n = c + step; n >= 0 && n < graph.layers.length; n += step) {
    const candidates = graph.layers[n]!;
    if (candidates.length === 0) continue;
    return candidates.reduce((best, s) =>
      Math.abs(layout.byslug[s]!.y - here.y) <
      Math.abs(layout.byslug[best]!.y - here.y)
        ? s
        : best,
    );
  }
  return from;
}
