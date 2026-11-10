import type { Health } from "./snapshot.ts";

// The particle model for Nexus Command (CMD-05): one cluster per tracked
// service, with colour and motion set by health. Pure maths with no canvas or
// DOM access, so the rules (calm when healthy, agitated when failing, nearly
// still when the data is stale) are unit-tested. The component in
// components/command/particle-field.tsx draws it.

export type ClusterInput = { id: string; name: string; health: Health };

export type Behaviour = {
  /** Orbit speed in radians per second. */
  spin: number;
  /** Random push in pixels per second squared. */
  jitter: number;
  /** Orbit radius as a share of the cluster radius (spread). */
  spread: number;
  /** Particle opacity 0 to 1. */
  alpha: number;
  /** Draw as a ring instead of a dot (so stale never looks healthy by colour alone). */
  hollow: boolean;
};

export const BEHAVIOUR: Record<Health, Behaviour> = {
  ok: { spin: 0.35, jitter: 4, spread: 0.7, alpha: 0.9, hollow: false },
  warn: { spin: 0.9, jitter: 26, spread: 0.85, alpha: 0.95, hollow: false },
  bad: { spin: 1.6, jitter: 90, spread: 1.0, alpha: 1, hollow: false },
  idle: { spin: 0.1, jitter: 1, spread: 0.45, alpha: 0.45, hollow: false },
  stale: { spin: 0.02, jitter: 0, spread: 0.6, alpha: 0.4, hollow: true },
};

export type Pt = { x: number; y: number };

export type Cluster = {
  id: string;
  name: string;
  health: Health;
  centre: Pt;
  radius: number;
};

export type Particle = {
  cluster: number;
  /** Position and velocity. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Orbit: angle, and distance as a share of the spread. */
  angle: number;
  dist: number;
  size: number;
};

/** Seeded generator, so a given seed always draws the same first frame. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Lays clusters out in rows that fit the width, centred in the height. */
export function layoutClusters(
  count: number,
  width: number,
  height: number,
): { centres: Pt[]; radius: number } {
  if (count === 0 || width <= 0 || height <= 0) {
    return { centres: [], radius: 0 };
  }
  // Choose the column count whose cells are closest to square.
  let best = { cols: 1, score: Infinity };
  for (let cols = 1; cols <= count; cols += 1) {
    const rows = Math.ceil(count / cols);
    const cell = Math.min(width / cols, height / rows);
    const score = -cell;
    if (score < best.score) best = { cols, score };
  }
  const cols = best.cols;
  const rows = Math.ceil(count / cols);
  const cw = width / cols;
  const ch = height / rows;
  const radius = Math.max(8, Math.min(cw, ch) * 0.34);
  const centres: Pt[] = [];
  for (let i = 0; i < count; i += 1) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? count - row * cols : cols;
    const offset = ((cols - inRow) * cw) / 2;
    centres.push({
      x: offset + (i % cols) * cw + cw / 2,
      y: row * ch + ch / 2 - radius * 0.15,
    });
  }
  return { centres, radius };
}

/** Particles within this many pixels of the pointer move away (requirement 8.14). */
export const POINTER_RADIUS = 100;

export class ClusterField {
  clusters: Cluster[] = [];
  particles: Particle[] = [];
  private width = 0;
  private height = 0;
  private pointer: Pt | null = null;
  private readonly rand: () => number;

  constructor(
    private readonly perCluster: number,
    seed = 0x4e455855,
  ) {
    this.rand = rng(seed);
  }

  /** Updates which clusters exist and their health. Positions of survivors are kept. */
  setClusters(inputs: readonly ClusterInput[]): void {
    const sameShape =
      inputs.length === this.clusters.length &&
      inputs.every((c, i) => c.id === this.clusters[i]?.id);
    if (sameShape) {
      inputs.forEach((c, i) => {
        const cluster = this.clusters[i];
        if (cluster) cluster.health = c.health;
      });
      return;
    }
    this.clusters = inputs.map((c) => ({
      ...c,
      centre: { x: 0, y: 0 },
      radius: 0,
    }));
    this.particles = [];
    inputs.forEach((_, ci) => {
      for (let k = 0; k < this.perCluster; k += 1) {
        this.particles.push({
          cluster: ci,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          angle: this.rand() * Math.PI * 2,
          dist: 0.25 + this.rand() * 0.75,
          size: 1.2 + this.rand() * 1.6,
        });
      }
    });
    this.relayout();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.relayout();
  }

  setPointer(p: Pt | null): void {
    this.pointer = p;
  }

  get particleCount(): number {
    return this.particles.length;
  }

  private relayout(): void {
    const { centres, radius } = layoutClusters(
      this.clusters.length,
      this.width,
      this.height,
    );
    this.clusters.forEach((c, i) => {
      c.centre = centres[i] ?? c.centre;
      c.radius = radius;
    });
    for (const p of this.particles) {
      const c = this.clusters[p.cluster];
      if (!c) continue;
      const b = BEHAVIOUR[c.health];
      p.x = c.centre.x + Math.cos(p.angle) * p.dist * b.spread * c.radius;
      p.y = c.centre.y + Math.sin(p.angle) * p.dist * b.spread * c.radius;
      p.vx = 0;
      p.vy = 0;
    }
  }

  /** Advances the simulation by `dt` seconds (capped by the caller). */
  step(dt: number): void {
    for (const p of this.particles) {
      const c = this.clusters[p.cluster];
      if (!c) continue;
      const b = BEHAVIOUR[c.health];
      p.angle += b.spin * dt * (0.6 + p.dist * 0.8);
      const tx = c.centre.x + Math.cos(p.angle) * p.dist * b.spread * c.radius;
      const ty = c.centre.y + Math.sin(p.angle) * p.dist * b.spread * c.radius;

      // Spring towards the orbit point, then damping.
      p.vx += (tx - p.x) * 9 * dt;
      p.vy += (ty - p.y) * 9 * dt;
      if (b.jitter > 0) {
        p.vx += (this.rand() - 0.5) * b.jitter * dt * 12;
        p.vy += (this.rand() - 0.5) * b.jitter * dt * 12;
      }
      if (this.pointer) {
        const dx = p.x - this.pointer.x;
        const dy = p.y - this.pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < POINTER_RADIUS * POINTER_RADIUS && d2 > 0.01) {
          const d = Math.sqrt(d2);
          const push = (1 - d / POINTER_RADIUS) * 260;
          p.vx += (dx / d) * push * dt;
          p.vy += (dy / d) * push * dt;
        }
      }
      const damping = Math.exp(-4 * dt);
      p.vx *= damping;
      p.vy *= damping;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
}
