// Canvas scenes for the public pages. Each scene is a small deterministic
// simulation: createScene() builds it from a seed, step(dt) advances it, and
// draw() paints the current frame. Colours arrive as a palette read from the
// design tokens, so no colour literal lives here. Soft glows are pre-rendered
// sprites, which keeps a frame to a few hundred drawImage calls.

import type { CanvasKind } from "@/lib/navigation/scenes";

export type Palette = {
  blue: string;
  pink: string;
  indigo: string;
  violet: string;
  ink: string;
};

export interface Scene {
  resize(width: number, height: number): void;
  step(dtSeconds: number): void;
  draw(): void;
}

type Rand = () => number;
const TAU = Math.PI * 2;

/** Small deterministic generator so a given seed always draws the same frame. */
export function mulberry32(seed: number): Rand {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Soft round glow in one colour: bright core, long falloff. */
function glow(colour: string, size: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) return c;
  g.fillStyle = colour;
  g.fillRect(0, 0, size, size);
  const fade = g.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  fade.addColorStop(0, "rgba(0,0,0,1)");
  fade.addColorStop(0.3, "rgba(0,0,0,0.6)");
  fade.addColorStop(1, "rgba(0,0,0,0)");
  g.globalCompositeOperation = "destination-in";
  g.fillStyle = fade;
  g.fillRect(0, 0, size, size);
  return c;
}

const wrap = (v: number) => (v < 0 ? v + 1 : v > 1 ? v - 1 : v);
const range = (rand: Rand, min: number, max: number) =>
  min + rand() * (max - min);

type Ctx = CanvasRenderingContext2D;
type Dims = { w: number; h: number };

/** Aurora: slow colour clouds, soft bokeh and twinkling stars. */
function aurora(ctx: Ctx, p: Palette, count: number, rand: Rand): Scene {
  const d: Dims = { w: 1, h: 1 };
  const clouds = [
    glow(p.blue, 256),
    glow(p.pink, 256),
    glow(p.indigo, 256),
    glow(p.violet, 256),
  ];
  const star = glow(p.ink, 48);
  const blobs = [
    { x: 0.82, y: 0.14, r: 0.62, s: 0, vx: -0.006, vy: 0.003, a: 0.55 },
    { x: 0.1, y: 0.86, r: 0.56, s: 1, vx: 0.005, vy: -0.004, a: 0.48 },
    { x: 0.5, y: 0.5, r: 0.46, s: 2, vx: 0.004, vy: -0.005, a: 0.4 },
    { x: 0.96, y: 0.82, r: 0.38, s: 3, vx: -0.005, vy: -0.003, a: 0.3 },
  ];
  const bokeh = Array.from({ length: Math.round(count * 0.5) }, () => ({
    x: rand(),
    y: rand(),
    r: range(rand, 8, 38),
    s: Math.floor(rand() * 3),
    a: range(rand, 0.12, 0.38),
    vx: (rand() - 0.5) * 0.008,
    vy: -0.002 - rand() * 0.007,
  }));
  const stars = Array.from({ length: count }, () => ({
    x: rand(),
    y: rand(),
    r: range(rand, 4, 11),
    a: range(rand, 0.5, 1),
    ph: rand() * TAU,
    sp: range(rand, 0.6, 2.4),
    vy: -rand() * 0.003,
  }));
  let t = 0;
  return {
    resize(w, h) {
      d.w = w;
      d.h = h;
    },
    step(dt) {
      t += dt;
      for (const b of blobs) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < 0 || b.x > 1) b.vx = -b.vx;
        if (b.y < 0 || b.y > 1) b.vy = -b.vy;
      }
      for (const b of bokeh) {
        b.x = wrap(b.x + b.vx * dt);
        b.y = wrap(b.y + b.vy * dt);
      }
      for (const s of stars) s.y = wrap(s.y + s.vy * dt);
    },
    draw() {
      ctx.clearRect(0, 0, d.w, d.h);
      ctx.globalCompositeOperation = "lighter";
      const big = Math.max(d.w, d.h);
      for (const b of blobs) {
        ctx.globalAlpha = b.a;
        const r = b.r * big;
        ctx.drawImage(clouds[b.s]!, b.x * d.w - r, b.y * d.h - r, r * 2, r * 2);
      }
      for (const b of bokeh) {
        ctx.globalAlpha = b.a;
        ctx.drawImage(
          clouds[b.s]!,
          b.x * d.w - b.r,
          b.y * d.h - b.r,
          b.r * 2,
          b.r * 2,
        );
      }
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.55 + 0.45 * Math.sin(t * s.sp + s.ph));
        ctx.drawImage(star, s.x * d.w - s.r, s.y * d.h - s.r, s.r * 2, s.r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

/** Constellation: drifting nodes joined by lines when they come close. */
function constellation(ctx: Ctx, p: Palette, count: number, rand: Rand): Scene {
  const d: Dims = { w: 1, h: 1 };
  const nodeBlue = glow(p.blue, 64);
  const nodePink = glow(p.pink, 64);
  const n = Math.min(150, Math.round(count * 0.85));
  const nodes = Array.from({ length: n }, () => ({
    x: rand(),
    y: rand(),
    vx: (rand() - 0.5) * 0.012,
    vy: (rand() - 0.5) * 0.012,
    pink: rand() < 0.16,
    r: range(rand, 5, 11),
    ph: rand() * TAU,
  }));
  let t = 0;
  return {
    resize(w, h) {
      d.w = w;
      d.h = h;
    },
    step(dt) {
      t += dt;
      for (const q of nodes) {
        q.x = wrap(q.x + q.vx * dt);
        q.y = wrap(q.y + q.vy * dt);
      }
    },
    draw() {
      ctx.clearRect(0, 0, d.w, d.h);
      const reach = Math.min(d.w, d.h) * 0.2;
      const reach2 = reach * reach;
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i]!;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j]!;
          const dx = (a.x - b.x) * d.w;
          const dy = (a.y - b.y) * d.h;
          const dist2 = dx * dx + dy * dy;
          if (dist2 > reach2) continue;
          ctx.globalAlpha = (1 - Math.sqrt(dist2) / reach) * 0.55;
          ctx.strokeStyle = a.pink || b.pink ? p.pink : p.blue;
          ctx.beginPath();
          ctx.moveTo(a.x * d.w, a.y * d.h);
          ctx.lineTo(b.x * d.w, b.y * d.h);
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "lighter";
      for (const q of nodes) {
        const pulse = q.pink ? 1 + 0.25 * Math.sin(t * 1.6 + q.ph) : 1;
        const r = q.r * pulse * (q.pink ? 1.5 : 1);
        ctx.globalAlpha = q.pink ? 0.95 : 0.85;
        ctx.drawImage(
          q.pink ? nodePink : nodeBlue,
          q.x * d.w - r,
          q.y * d.h - r,
          r * 2,
          r * 2,
        );
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

/** Embers: sparks rising from the bottom with sway and a short trail. */
function embers(ctx: Ctx, p: Palette, count: number, rand: Rand): Scene {
  const d: Dims = { w: 1, h: 1 };
  const sprites = [glow(p.pink, 64), glow(p.ink, 64), glow(p.indigo, 64)];
  const sparks = Array.from({ length: Math.round(count * 0.8) }, () => ({
    x: rand(),
    y: rand(),
    vy: range(rand, 0.035, 0.13),
    sway: range(rand, 0.004, 0.02),
    ph: rand() * TAU,
    r: range(rand, 4, 12),
    s: rand() < 0.62 ? 0 : rand() < 0.7 ? 1 : 2,
    a: range(rand, 0.55, 1),
  }));
  let t = 0;
  return {
    resize(w, h) {
      d.w = w;
      d.h = h;
    },
    step(dt) {
      t += dt;
      for (const s of sparks) {
        s.y -= s.vy * dt;
        if (s.y < -0.05) {
          s.y = 1.05;
          s.x = rand();
        }
      }
    },
    draw() {
      ctx.clearRect(0, 0, d.w, d.h);
      ctx.globalCompositeOperation = "lighter";
      for (const s of sparks) {
        const x = (s.x + Math.sin(t * 0.7 + s.ph) * s.sway) * d.w;
        const y = s.y * d.h;
        const fade = Math.min(1, s.y * 3.2) * Math.min(1, (1.08 - s.y) * 4);
        ctx.globalAlpha = s.a * Math.max(0, fade);
        ctx.drawImage(sprites[s.s]!, x - s.r, y - s.r, s.r * 2, s.r * 2);
        const base = ctx.globalAlpha;
        for (let k = 1; k <= 3; k++) {
          ctx.globalAlpha = base * (0.4 / k);
          const rr = s.r * (1 - k * 0.2);
          ctx.drawImage(
            sprites[s.s]!,
            x - rr,
            y + k * s.r * 1.5 - rr,
            rr * 2,
            rr * 2,
          );
        }
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

/** Orbit: concentric rings with bodies circling a glowing centre. */
function orbit(ctx: Ctx, p: Palette, count: number, rand: Rand): Scene {
  const d: Dims = { w: 1, h: 1 };
  const core = [
    glow(p.indigo, 256),
    glow(p.pink, 256),
    glow(p.blue, 64),
    glow(p.ink, 64),
  ];
  const rings = 8;
  const bodies = Array.from({ length: Math.round(count * 0.8) }, () => ({
    ring: 1 + Math.floor(rand() * rings),
    ang: rand() * TAU,
    sp: (rand() < 0.5 ? -1 : 1) * range(rand, 0.04, 0.22),
    r: range(rand, 3, 9),
    s: rand() < 0.5 ? 2 : rand() < 0.5 ? 3 : 1,
  }));
  const centre = () =>
    d.w > 900
      ? { x: d.w * 0.72, y: d.h * 0.5 }
      : { x: d.w * 0.5, y: d.h * 0.4 };
  const radius = () =>
    Math.max(Math.min(d.w, d.h) * 0.62, Math.min(d.w, d.h) * 0.45 + d.w * 0.04);
  return {
    resize(w, h) {
      d.w = w;
      d.h = h;
    },
    step(dt) {
      for (const b of bodies) b.ang += b.sp * dt;
    },
    draw() {
      ctx.clearRect(0, 0, d.w, d.h);
      const c = centre();
      const R = radius();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.6;
      ctx.drawImage(core[0]!, c.x - R * 1.1, c.y - R * 1.1, R * 2.2, R * 2.2);
      ctx.globalAlpha = 0.4;
      ctx.drawImage(core[1]!, c.x - R * 0.5 + R * 0.25, c.y - R * 0.5, R, R);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1;
      for (let k = 1; k <= rings; k++) {
        ctx.globalAlpha = 0.14 + (k % 3 === 0 ? 0.1 : 0);
        ctx.strokeStyle = k % 3 === 0 ? p.pink : p.blue;
        ctx.setLineDash(k % 2 === 0 ? [2, 7] : []);
        ctx.beginPath();
        ctx.arc(c.x, c.y, (R * k) / rings, 0, TAU);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.globalCompositeOperation = "lighter";
      for (const b of bodies) {
        const rr = (R * b.ring) / rings;
        const x = c.x + Math.cos(b.ang) * rr;
        const y = c.y + Math.sin(b.ang) * rr;
        ctx.globalAlpha = 0.95;
        ctx.drawImage(core[b.s]!, x - b.r * 2, y - b.r * 2, b.r * 4, b.r * 4);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

/** Waves: layered signal lines with a soft glow, over drifting dots. */
function waves(ctx: Ctx, p: Palette, count: number, rand: Rand): Scene {
  const d: Dims = { w: 1, h: 1 };
  const star = glow(p.blue, 48);
  const lines = Array.from({ length: 6 }, (_, i) => ({
    base: 0.58 + i * 0.07,
    amp: range(rand, 16, 48),
    k: range(rand, 1.1, 2.6),
    sp: range(rand, 0.25, 0.7) * (i % 2 ? -1 : 1),
    ph: rand() * TAU,
  }));
  const dots = Array.from({ length: Math.round(count * 0.7) }, () => ({
    x: rand(),
    y: rand(),
    r: range(rand, 3, 8),
    a: range(rand, 0.3, 0.8),
    vx: -0.004 - rand() * 0.01,
  }));
  let t = 0;
  return {
    resize(w, h) {
      d.w = w;
      d.h = h;
    },
    step(dt) {
      t += dt;
      for (const q of dots) q.x = wrap(q.x + q.vx * dt);
    },
    draw() {
      ctx.clearRect(0, 0, d.w, d.h);
      const grad = ctx.createLinearGradient(0, 0, d.w, 0);
      grad.addColorStop(0, p.blue);
      grad.addColorStop(0.55, p.pink);
      grad.addColorStop(1, p.indigo);
      ctx.strokeStyle = grad;
      ctx.lineJoin = "round";
      for (const pass of [
        { w: 9, a: 0.09 },
        { w: 2.2, a: 0.7 },
      ]) {
        ctx.lineWidth = pass.w;
        ctx.globalAlpha = pass.a;
        for (const l of lines) {
          ctx.beginPath();
          for (let x = 0; x <= d.w + 8; x += 8) {
            const u = x / d.w;
            const y =
              d.h * l.base +
              Math.sin(u * TAU * l.k + t * l.sp * 2 + l.ph) * l.amp +
              Math.sin(u * TAU * l.k * 2.3 - t * l.sp + l.ph) * l.amp * 0.35;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = "lighter";
      for (const q of dots) {
        ctx.globalAlpha = q.a;
        ctx.drawImage(star, q.x * d.w - q.r, q.y * d.h - q.r, q.r * 2, q.r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

/** Dust: motes drifting through the light, plus a few large soft bokeh. */
function dust(ctx: Ctx, p: Palette, count: number, rand: Rand): Scene {
  const d: Dims = { w: 1, h: 1 };
  const sprites = [glow(p.ink, 48), glow(p.blue, 48), glow(p.indigo, 128)];
  const motes = Array.from({ length: Math.round(count * 1.3) }, () => ({
    x: rand(),
    y: rand(),
    r: range(rand, 2.5, 8),
    a: range(rand, 0.35, 0.95),
    vx: range(rand, 0.002, 0.012),
    vy: range(rand, 0.003, 0.012),
    ph: rand() * TAU,
    s: rand() < 0.65 ? 0 : 1,
  }));
  const bokeh = Array.from({ length: 7 }, () => ({
    x: rand(),
    y: rand(),
    r: range(rand, 40, 110),
    a: range(rand, 0.12, 0.26),
    vx: range(rand, 0.001, 0.004),
    vy: range(rand, 0.001, 0.004),
  }));
  let t = 0;
  return {
    resize(w, h) {
      d.w = w;
      d.h = h;
    },
    step(dt) {
      t += dt;
      for (const m of motes) {
        m.x = wrap(m.x + m.vx * dt);
        m.y = wrap(m.y + m.vy * dt);
      }
      for (const b of bokeh) {
        b.x = wrap(b.x + b.vx * dt);
        b.y = wrap(b.y + b.vy * dt);
      }
    },
    draw() {
      ctx.clearRect(0, 0, d.w, d.h);
      ctx.globalCompositeOperation = "lighter";
      for (const b of bokeh) {
        ctx.globalAlpha = b.a;
        ctx.drawImage(
          sprites[2]!,
          b.x * d.w - b.r,
          b.y * d.h - b.r,
          b.r * 2,
          b.r * 2,
        );
      }
      for (const m of motes) {
        ctx.globalAlpha = m.a * (0.5 + 0.5 * Math.sin(t * 0.9 + m.ph));
        ctx.drawImage(
          sprites[m.s]!,
          m.x * d.w - m.r,
          m.y * d.h - m.r,
          m.r * 2,
          m.r * 2,
        );
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
  };
}

/** Petals: cherry-blossom petals falling and turning (Yes Experience). */
function petals(ctx: Ctx, p: Palette, count: number, rand: Rand): Scene {
  const d: Dims = { w: 1, h: 1 };
  const flakes = Array.from({ length: Math.round(count * 0.28) }, () => ({
    x: rand(),
    y: rand(),
    size: range(rand, 7, 16),
    rot: rand() * TAU,
    vr: (rand() - 0.5) * 1.2,
    vy: range(rand, 0.03, 0.09),
    sway: range(rand, 0.01, 0.05),
    ph: rand() * TAU,
    flip: rand() * TAU,
    a: range(rand, 0.4, 0.8),
    light: rand() < 0.35,
  }));
  let t = 0;
  return {
    resize(w, h) {
      d.w = w;
      d.h = h;
    },
    step(dt) {
      t += dt;
      for (const f of flakes) {
        f.y += f.vy * dt;
        f.rot += f.vr * dt;
        f.flip += dt * 1.4;
        if (f.y > 1.06) {
          f.y = -0.06;
          f.x = rand();
        }
      }
    },
    draw() {
      ctx.clearRect(0, 0, d.w, d.h);
      for (const f of flakes) {
        const x = (f.x + Math.sin(t * 0.5 + f.ph) * f.sway) * d.w;
        const y = f.y * d.h;
        const s = f.size;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.rot);
        ctx.scale(1, 0.45 + 0.55 * Math.abs(Math.cos(f.flip)));
        ctx.globalAlpha = f.a;
        ctx.fillStyle = f.light ? p.ink : p.pink;
        ctx.beginPath();
        ctx.moveTo(0, -s);
        ctx.bezierCurveTo(s * 0.95, -s * 0.55, s * 0.7, s * 0.75, 0, s);
        ctx.bezierCurveTo(-s * 0.7, s * 0.75, -s * 0.95, -s * 0.55, 0, -s);
        ctx.fill();
        ctx.globalAlpha = f.a * 0.35;
        ctx.fillStyle = f.light ? p.pink : p.ink;
        ctx.beginPath();
        ctx.ellipse(0, -s * 0.2, s * 0.22, s * 0.5, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },
  };
}

const builders: Record<
  CanvasKind,
  (ctx: Ctx, p: Palette, count: number, rand: Rand) => Scene
> = {
  aurora,
  constellation,
  embers,
  orbit,
  waves,
  dust,
  petals,
};

export function createScene(
  kind: CanvasKind,
  ctx: CanvasRenderingContext2D,
  palette: Palette,
  count: number,
  seed: number,
): Scene {
  return builders[kind](ctx, palette, count, mulberry32(seed));
}
