import { describe, expect, it } from "vitest";
import {
  buildGraph,
  edgePath,
  layoutGraph,
  moveFocus,
  reach,
  NODE_H,
  NODE_W,
} from "@/lib/atlas/graph";
import { DEMO_EDGES, DEMO_KINDS } from "@/lib/fixtures/atlas";
import { dependencies, services } from "@/lib/server/db/seed/data";

// ATL-01 and ATL-05: the graph is built from rows, laid out without overlap and
// walked by keyboard.

const demo = () => buildGraph(Object.keys(DEMO_KINDS), DEMO_EDGES);

describe("buildGraph", () => {
  it("drops unknown ends, self-loops and duplicates", () => {
    const g = buildGraph(
      ["a", "b"],
      [
        { from: "a", to: "b" },
        { from: "a", to: "b" },
        { from: "a", to: "a" },
        { from: "a", to: "zzz" },
        { from: "zzz", to: "b" },
      ],
    );
    expect(g.edges).toEqual([{ from: "a", to: "b" }]);
    expect(g.upstream).toEqual({ a: ["b"], b: [] });
    expect(g.downstream).toEqual({ a: [], b: ["a"] });
  });

  it("puts every service strictly left of what it needs", () => {
    const g = demo();
    for (const e of g.edges) {
      expect(g.layer[e.from]!).toBeLessThan(g.layer[e.to]!);
    }
    expect(g.layers.flat().sort()).toEqual([...g.slugs].sort());
  });

  it("ends on a cycle instead of looping", () => {
    const g = buildGraph(
      ["a", "b", "c"],
      [
        { from: "a", to: "b" },
        { from: "b", to: "c" },
        { from: "c", to: "a" },
      ],
    );
    expect(g.layers.flat().sort()).toEqual(["a", "b", "c"]);
  });

  it("handles an empty inventory", () => {
    const g = buildGraph([], []);
    expect(g.layers).toEqual([]);
    expect(layoutGraph(g).nodes).toEqual([]);
  });
});

describe("demo fixtures", () => {
  it("match the seed inventory, so Demo and Live draw the same map", () => {
    const slug = new Map(services.map((s) => [s.id, s.slug]));
    const seedEdges = dependencies.map(
      ([a, b]) => `${slug.get(a)}>${slug.get(b)}`,
    );
    expect(DEMO_EDGES.map((e) => `${e.from}>${e.to}`).sort()).toEqual(
      seedEdges.sort(),
    );
    for (const s of services) expect(DEMO_KINDS[s.slug]).toBe(s.kind);
  });
});

describe("reach", () => {
  it("lists everything a failure of MariaDB affects, once each", () => {
    const g = demo();
    const hit = reach(g, "mariadb", "downstream").sort();
    expect(hit).toEqual(
      [
        "apache",
        "dovecot",
        "nexus-web",
        "php-fpm",
        "postfix",
        "roundcube",
        "sftpgo",
        "wordpress",
      ].sort(),
    );
  });

  it("lists what a service needs, transitively", () => {
    expect(reach(demo(), "apache", "upstream")).toEqual(
      expect.arrayContaining(["nexus-web", "mariadb", "node-exporter"]),
    );
  });

  it("does not include the service itself, even in a cycle", () => {
    const g = buildGraph(
      ["a", "b"],
      [
        { from: "a", to: "b" },
        { from: "b", to: "a" },
      ],
    );
    expect(reach(g, "a", "downstream")).toEqual(["b"]);
  });
});

describe("layoutGraph", () => {
  it("never overlaps two nodes and keeps all inside the canvas", () => {
    const l = layoutGraph(demo());
    for (const a of l.nodes) {
      expect(a.x).toBeGreaterThanOrEqual(0);
      expect(a.y).toBeGreaterThanOrEqual(0);
      expect(a.x + NODE_W).toBeLessThanOrEqual(l.width);
      expect(a.y + NODE_H).toBeLessThanOrEqual(l.height);
      for (const b of l.nodes) {
        if (a === b) continue;
        const apart =
          a.x + NODE_W <= b.x ||
          b.x + NODE_W <= a.x ||
          a.y + NODE_H <= b.y ||
          b.y + NODE_H <= a.y;
        expect(apart).toBe(true);
      }
    }
  });

  it("draws a path for each edge", () => {
    const g = demo();
    const l = layoutGraph(g);
    for (const e of g.edges) expect(edgePath(l, e)).toMatch(/^M/);
    expect(edgePath(l, { from: "x", to: "apache" })).toBeNull();
  });
});

describe("moveFocus", () => {
  const g = demo();
  const l = layoutGraph(g);

  it("reaches every service from the first one using arrow keys", () => {
    const start = g.layers[0]![0]!;
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length > 0) {
      const at = queue.shift()!;
      for (const d of ["left", "right", "up", "down"] as const) {
        const next = moveFocus(g, l, at, d);
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    expect([...seen].sort()).toEqual([...g.slugs].sort());
  });

  it("stays put at the edges", () => {
    const first = g.layers[0]![0]!;
    expect(moveFocus(g, l, first, "left")).toBe(first);
    expect(moveFocus(g, l, first, "up")).toBe(first);
    expect(moveFocus(g, l, "no-such", "right")).toBe("no-such");
  });

  it("moves down a column in order", () => {
    const col = g.layers.find((c) => c.length > 1)!;
    expect(moveFocus(g, l, col[0]!, "down")).toBe(col[1]);
    expect(moveFocus(g, l, col[1]!, "up")).toBe(col[0]);
  });
});
