// Pure pixel-buffer particle sampler for the Yes logomark (spec 24).
// Converts RGBA raster pixels into typed attribute buffers ready for Three.js
// BufferGeometry, with edge double-weighting, 70/30 face-volume depth, and
// ellipsoid scatter targets.

import { brandColours } from "@/lib/design/tokens";

export const MARK_WORLD_HEIGHT = 2.2;
export const MARK_HALF_DEPTH = 0.12;
export const FACE_PARTICLE_SHARE = 0.7;
export const ALPHA_THRESHOLD = 0.5;
export const COLOR_BRIGHTNESS_BOOST = 1.15;
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
 * Samples `count` 3D particles from an RGBA pixel buffer.
 * - Keeps pixels whose normalized alpha exceeds `alphaThreshold` (0.5).
 * - Counts edge pixels (any transparent orthogonal neighbour or image edge) double.
 * - Normalises xy so the opaque mark is centred and `targetHeight` (2.2) units tall.
 * - Places 70% of particles on front/back faces (±0.12) and 30% inside the volume.
 * - Boosts sampled RGB by 1.15 for additive blending.
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
  const jitterStep = spanY > 1 ? 1 : 0;

  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scatter = new Float32Array(count * 3);
  const seeds = new Float32Array(count);

  const poolLen = pool.length;
  const TAU = Math.PI * 2;

  for (let i = 0; i < count; i++) {
    const flat = pool[Math.floor(rand() * poolLen)]!;
    const px = flat % width;
    const py = Math.floor(flat / width);

    const rawX = (px + (rand() - 0.5) * jitterStep - cx) * scale;
    const rawY = (cy - (py + (rand() - 0.5) * jitterStep)) * scale;
    const x = Math.max(-maxHalfW, Math.min(maxHalfW, rawX));
    const y = Math.max(-maxHalfH, Math.min(maxHalfH, rawY));

    const z =
      rand() < faceShare
        ? rand() < 0.5
          ? halfDepth
          : -halfDepth
        : (rand() * 2 - 1) * halfDepth;

    const p3 = i * 3;
    positions[p3] = x;
    positions[p3 + 1] = y;
    positions[p3 + 2] = z;

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

  return { count, positions, colors, scatter, seeds };
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
  hexToRgbTuple(brandColours.ytlBlue),
  [0.85, 0.88, 0.96],
];

/**
 * Samples sparse dim dust motes distributed in a wide ellipsoid around the
 * hero mark so the scene reads as a continuous particle atmosphere.
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

  for (let i = 0; i < count; i++) {
    const theta = rand() * TAU;
    const cosPhi = rand() * 2 - 1;
    const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
    const r = 0.28 + Math.pow(rand(), 0.55) * 0.72;

    const p3 = i * 3;
    positions[p3] = Math.cos(theta) * sinPhi * r * 7.8;
    positions[p3 + 1] = cosPhi * r * 4.4;
    positions[p3 + 2] = Math.sin(theta) * sinPhi * r * 3.8 - 0.6;

    const tint = DUST_PALETTE[Math.floor(rand() * DUST_PALETTE.length)]!;
    const dim = 0.45 + rand() * 0.4;
    colors[p3] = tint[0] * dim;
    colors[p3 + 1] = tint[1] * dim;
    colors[p3 + 2] = tint[2] * dim;

    seeds[i] = rand();
  }

  return { count, positions, colors, seeds };
}
