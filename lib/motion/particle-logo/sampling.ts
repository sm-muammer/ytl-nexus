// Pure pixel-buffer particle sampler for the Yes logomark (spec 24).
// Converts RGBA raster pixels into typed attribute buffers ready for Three.js
// BufferGeometry, with edge double-weighting, 70/30 face-volume depth, and
// ellipsoid scatter targets.

import { brandColours } from "@/lib/design/tokens";

export const MARK_WORLD_HEIGHT = 2.2;
export const MARK_HALF_DEPTH = 0.12;
export const FACE_PARTICLE_SHARE = 0.7;
export const ALPHA_THRESHOLD = 0.5;
export const COLOR_BRIGHTNESS_BOOST = 1;
export const SCATTER_RADIUS = 6;
export const SCATTER_Y_SCALE = 0.55;
export const SCATTER_Z_SCALE = 0.6;

export type PixelBuffer = {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
};

export type SampleOptions = {
  seed?: number;
  targetHeight?: number;
  halfDepth?: number;
  faceShare?: number;
  alphaThreshold?: number;
  colorBoost?: number;
  scatterRadius?: number;
};

export type SampledParticles = {
  count: number;
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  scatter: Float32Array;
  seeds: Float32Array;
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Samples `count` 3D particles from an RGBA pixel buffer using stratified pool
 * sampling (eliminating Monte Carlo clumping) and computes 3D surface/bevel
 * normals via a 3x3 Sobel alpha gradient.
 */
export function sampleParticlesFromPixels(
  image: PixelBuffer,
  count: number,
  options: SampleOptions = {},
): SampledParticles {
  const { width, height, data } = image;
  if (width <= 0 || height <= 0 || data.length < width * height * 4) {
    throw new Error("Invalid pixel buffer dimensions");
  }
  if (count <= 0) {
    return {
      count: 0,
      positions: new Float32Array(0),
      normals: new Float32Array(0),
      colors: new Float32Array(0),
      scatter: new Float32Array(0),
      seeds: new Float32Array(0),
    };
  }

  const targetHeight = options.targetHeight ?? MARK_WORLD_HEIGHT;
  const halfDepth = options.halfDepth ?? MARK_HALF_DEPTH;
  const faceShare = options.faceShare ?? FACE_PARTICLE_SHARE;
  const alphaCutoff = (options.alphaThreshold ?? ALPHA_THRESHOLD) * 255;
  const colorBoost = options.colorBoost ?? COLOR_BRIGHTNESS_BOOST;
  const scatterRx = options.scatterRadius ?? SCATTER_RADIUS;
  const scatterRy = scatterRx * SCATTER_Y_SCALE;
  const scatterRz = scatterRx * SCATTER_Z_SCALE;
  const rand = mulberry32(options.seed ?? 0x59455331);

  const isOpaque = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= width || y >= height) return false;
    return (data[(y * width + x) * 4 + 3] ?? 0) > alphaCutoff;
  };

  const alphaAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= width || y >= height) return 0;
    return (data[(y * width + x) * 4 + 3] ?? 0) / 255;
  };

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  // Weighted candidate pool storing flat pixel indices (y * width + x).
  const pool: number[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isOpaque(x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      const flat = y * width + x;
      pool.push(flat);

      const isEdge =
        !isOpaque(x - 1, y) ||
        !isOpaque(x + 1, y) ||
        !isOpaque(x, y - 1) ||
        !isOpaque(x, y + 1);
      if (isEdge) {
        pool.push(flat);
      }
    }
  }

  if (pool.length === 0) {
    throw new Error("No opaque pixels above alpha threshold found in image");
  }

  const spanX = Math.max(1, maxX - minX + 1);
  const spanY = Math.max(1, maxY - minY + 1);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const scale = targetHeight / spanY;
  const maxHalfW = (spanX * scale) / 2;
  const maxHalfH = targetHeight / 2;
  const jitterStep = spanY > 1 ? 0.28 : 0;

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  const poolLen = pool.length;
  const TAU = Math.PI * 2;

  for (let i = 0; i < count; i++) {
    // Stratified walk across the weighted pool eliminates Monte Carlo clumping and holes.
    const u = (i + rand()) / count;
    const flat = pool[Math.min(poolLen - 1, Math.floor(u * poolLen))]!;
    const px = flat % width;
    const py = Math.floor(flat / width);

    const rawX = (px + (rand() - 0.5) * jitterStep - cx) * scale;
    const rawY = (cy - (py + (rand() - 0.5) * jitterStep)) * scale;
    const x = Math.max(-maxHalfW, Math.min(maxHalfW, rawX));
    const y = Math.max(-maxHalfH, Math.min(maxHalfH, rawY));

    const isFrontOrBack = rand() < faceShare;
    const z = isFrontOrBack
      ? rand() < 0.5
        ? halfDepth
        : -halfDepth
      : ((Math.floor(rand() * 5) - 2) / 2.5) * halfDepth;

    // 3x3 Sobel gradient on alpha gives smooth outward edge normals (+worldX, +worldY).
    const aTL = alphaAt(px - 1, py - 1);
    const aT = alphaAt(px, py - 1);
    const aTR = alphaAt(px + 1, py - 1);
    const aL = alphaAt(px - 1, py);
    const aR = alphaAt(px + 1, py);
    const aBL = alphaAt(px - 1, py + 1);
    const aB = alphaAt(px, py + 1);
    const aBR = alphaAt(px + 1, py + 1);

    const gx = aTL + 2 * aL + aBL - (aTR + 2 * aR + aBR);
    const gy = aBL + 2 * aB + aBR - (aTL + 2 * aT + aTR);
    const gLen = Math.hypot(gx, gy);
    const egx = gLen > 0.01 ? gx / gLen : 0;
    const egy = gLen > 0.01 ? gy / gLen : 0;

    let nx = 0;
    let ny = 0;
    let nz = z >= 0 ? 1 : -1;
    if (isFrontOrBack) {
      nx = egx * 0.35;
      ny = egy * 0.35;
      nz = z >= 0 ? 1 : -1;
    } else if (gLen > 0.01) {
      nx = egx;
      ny = egy;
      nz = (z / Math.max(1e-4, halfDepth)) * 0.4;
    }
    const nLen = Math.hypot(nx, ny, nz) || 1;

    const p3 = i * 3;
    positions[p3] = x;
    positions[p3 + 1] = y;
    positions[p3 + 2] = z;

    normals[p3] = nx / nLen;
    normals[p3 + 1] = ny / nLen;
    normals[p3 + 2] = nz / nLen;

    const rgbaIdx = flat * 4;
    colors[p3] = ((data[rgbaIdx] ?? 0) / 255) * colorBoost;
    colors[p3 + 1] = ((data[rgbaIdx + 1] ?? 0) / 255) * colorBoost;
    colors[p3 + 2] = ((data[rgbaIdx + 2] ?? 0) / 255) * colorBoost;

    // Ellipsoid scatter point, slightly outward-weighted so the field frames the viewport.
    const theta = rand() * TAU;
    const cosPhi = rand() * 2 - 1;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    const r = Math.pow(rand(), 0.45);
    scatter[p3] = Math.cos(theta) * sinPhi * r * scatterRx;
    scatter[p3 + 1] = cosPhi * r * scatterRy;
    scatter[p3 + 2] = Math.sin(theta) * sinPhi * r * scatterRz;

    seeds[i] = rand();
  }

  return { count, positions, normals, colors, scatter, seeds };
}

export type AmbientDust = {
  count: number;
  positions: Float32Array;
  colors: Float32Array;
  seeds: Float32Array;
};

function hexToRgbTuple(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

const DUST_PALETTE: readonly [number, number, number][] = [
  hexToRgbTuple(brandColours.yesPink),
  hexToRgbTuple(brandColours.yesGradientEnd),
  [0.82, 0.84, 0.98],
];

const RING_SPECS = [
  {
    tiltX: (24 * Math.PI) / 180,
    tiltY: (-18 * Math.PI) / 180,
    minR: 2.4,
    spanR: 0.8,
    tube: 0.14,
  },
  {
    tiltX: (-32 * Math.PI) / 180,
    tiltY: (22 * Math.PI) / 180,
    minR: 3.4,
    spanR: 1.0,
    tube: 0.18,
  },
  {
    tiltX: (10 * Math.PI) / 180,
    tiltY: (8 * Math.PI) / 180,
    minR: 4.8,
    spanR: 2.0,
    tube: 0.28,
  },
] as const;

/**
 * Samples 3D orbital torus ring motes (65%) and a wide deep-space parallax
 * starfield (35%) around the hero mark so the scene reads as a layered 3D
 * particle atmosphere.
 */
export function sampleAmbientDust(
  count: number,
  seed = 0x44555354,
): AmbientDust {
  if (count <= 0) {
    return {
      count: 0,
      positions: new Float32Array(0),
      colors: new Float32Array(0),
      seeds: new Float32Array(0),
    };
  }

  const rand = mulberry32(seed);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const TAU = Math.PI * 2;
  const ringCutoff = Math.floor(count * 0.65);

  for (let i = 0; i < count; i++) {
    const p3 = i * 3;
    if (i < ringCutoff) {
      const spec = RING_SPECS[i % RING_SPECS.length]!;
      const angle = rand() * TAU;
      const majorR = spec.minR + rand() * spec.spanR;
      const tubeR = (rand() - 0.5) * 2 * spec.tube;
      const tubeY = (rand() - 0.5) * 2 * spec.tube;

      const lx = Math.cos(angle) * (majorR + tubeR);
      const ly = tubeY;
      const lz = Math.sin(angle) * (majorR + tubeR);

      // Rotate around X then Y so each ring sits on its tilted 3D orbital plane.
      const cx = Math.cos(spec.tiltX);
      const sx = Math.sin(spec.tiltX);
      const y1 = ly * cx - lz * sx;
      const z1 = ly * sx + lz * cx;

      const cy = Math.cos(spec.tiltY);
      const sy = Math.sin(spec.tiltY);
      positions[p3] = lx * cy + z1 * sy;
      positions[p3 + 1] = y1;
      positions[p3 + 2] = -lx * sy + z1 * cy - 0.35;
    } else {
      const theta = rand() * TAU;
      const cosPhi = rand() * 2 - 1;
      const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
      const r = 0.28 + Math.pow(rand(), 0.55) * 0.72;

      positions[p3] = Math.cos(theta) * sinPhi * r * 8.5;
      positions[p3 + 1] = cosPhi * r * 5.0;
      positions[p3 + 2] = Math.sin(theta) * sinPhi * r * 4.5 - 0.8;
    }

    const tint = DUST_PALETTE[Math.floor(rand() * DUST_PALETTE.length)]!;
    const dim = 0.45 + rand() * 0.5;
    colors[p3] = Math.min(1, tint[0] * dim);
    colors[p3 + 1] = Math.min(1, tint[1] * dim);
    colors[p3 + 2] = Math.min(1, tint[2] * dim);

    seeds[i] = rand();
  }

  return { count, positions, colors, seeds };
}
