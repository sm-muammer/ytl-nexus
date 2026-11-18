import { describe, expect, it } from "vitest";
import {
  MARK_HALF_DEPTH,
  MARK_WORLD_HEIGHT,
  SCATTER_RADIUS,
  sampleAmbientDust,
  sampleParticlesFromPixels,
  type PixelBuffer,
} from "@/lib/motion/particle-logo/sampling";

function makeSolidWithBorderImage(
  width: number,
  height: number,
  margin: number,
  opaqueRgba: [number, number, number, number],
  transparentRgba: [number, number, number, number] = [0, 255, 0, 0],
): PixelBuffer {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const inside =
        x >= margin && x < width - margin && y >= margin && y < height - margin;
      const rgba = inside ? opaqueRgba : transparentRgba;
      data[idx] = rgba[0];
      data[idx + 1] = rgba[1];
      data[idx + 2] = rgba[2];
      data[idx + 3] = rgba[3];
    }
  }
  return { width, height, data };
}

describe("particle logo sampling", () => {
  it("produces the exact requested particle count and normalised bounds", () => {
    // 20x10 opaque rectangle inside a 24x14 canvas (aspect 2:1).
    const img = makeSolidWithBorderImage(24, 14, 2, [255, 0, 132, 255]);
    const sampled = sampleParticlesFromPixels(img, 5000, { seed: 42 });

    expect(MARK_WORLD_HEIGHT).toBeCloseTo(2.2, 6);
    expect(MARK_HALF_DEPTH).toBeCloseTo(0.12, 6);
    expect(sampled.count).toBe(5000);
    expect(sampled.positions).toHaveLength(5000 * 3);
    expect(sampled.colors).toHaveLength(5000 * 3);
    expect(sampled.scatter).toHaveLength(5000 * 3);
    expect(sampled.seeds).toHaveLength(5000);

    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let faceCount = 0;

    for (let i = 0; i < sampled.count; i++) {
      const x = sampled.positions[i * 3]!;
      const y = sampled.positions[i * 3 + 1]!;
      const z = sampled.positions[i * 3 + 2]!;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;

      expect(Math.abs(y)).toBeLessThanOrEqual(MARK_WORLD_HEIGHT / 2 + 1e-4);
      expect(Math.abs(z)).toBeLessThanOrEqual(MARK_HALF_DEPTH + 1e-6);
      if (Math.abs(Math.abs(z) - MARK_HALF_DEPTH) < 1e-5) {
        faceCount += 1;
      }

      const sx = sampled.scatter[i * 3]!;
      const sy = sampled.scatter[i * 3 + 1]!;
      const sz = sampled.scatter[i * 3 + 2]!;
      expect(Math.abs(sx)).toBeLessThanOrEqual(SCATTER_RADIUS + 1e-5);
      expect(Math.abs(sy)).toBeLessThanOrEqual(SCATTER_RADIUS * 0.6 + 1e-5);
      expect(Math.abs(sz)).toBeLessThanOrEqual(SCATTER_RADIUS + 1e-5);

      const seed = sampled.seeds[i]!;
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(1);
    }

    // Centred vertically and ~2.2 world units tall.
    expect(maxY - minY).toBeGreaterThan(2.0);
    expect(maxY - minY).toBeLessThanOrEqual(2.21);
    expect(Math.abs((minX + maxX) / 2)).toBeLessThan(0.1);
    expect(Math.abs((minY + maxY) / 2)).toBeLessThan(0.1);

    // 70% sit on front/back faces (±0.12), 30% fill the volume.
    const faceShare = faceCount / sampled.count;
    expect(faceShare).toBeGreaterThan(0.65);
    expect(faceShare).toBeLessThan(0.75);
  });

  it("samples colours only from pixels with alpha > 0.5 and boosts by 1.15", () => {
    // Transparent pixels have vivid green (0, 255, 0, 100 -> alpha < 0.5).
    // Opaque pixels have Yes pink (200, 0, 100, 255).
    const width = 6;
    const height = 6;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const opaque = x >= 2 && x <= 3 && y >= 2 && y <= 3;
        if (opaque) {
          data[idx] = 200;
          data[idx + 1] = 0;
          data[idx + 2] = 100;
          data[idx + 3] = 255;
        } else {
          data[idx] = 0;
          data[idx + 1] = 255;
          data[idx + 2] = 0;
          data[idx + 3] = 120; // ~0.47 alpha, must be excluded
        }
      }
    }

    const sampled = sampleParticlesFromPixels({ width, height, data }, 500, {
      seed: 7,
    });
    const expectedR = (200 / 255) * 1.15;
    const expectedB = (100 / 255) * 1.15;

    for (let i = 0; i < sampled.count; i++) {
      expect(sampled.colors[i * 3]).toBeCloseTo(expectedR, 4);
      expect(sampled.colors[i * 3 + 1]).toBe(0);
      expect(sampled.colors[i * 3 + 2]).toBeCloseTo(expectedB, 4);
    }
  });

  it("weights edge pixels double relative to interior opaque pixels", () => {
    // 6x6 opaque block inside 10x10 transparent frame:
    // Total opaque pixels = 36:
    //   20 perimeter edge pixels (weight 2 -> 40 slots)
    //   16 interior pixels       (weight 1 -> 16 slots)
    // Expected edge probability = 40 / 56 = 71.43% (unweighted would be 20 / 36 = 55.56%).
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 2; y < 8; y++) {
      for (let x = 2; x < 8; x++) {
        const idx = (y * width + x) * 4;
        const isEdge = x === 2 || x === 7 || y === 2 || y === 7;
        // Mark edge pixels pure red, interior pixels pure blue to observe sampling ratio.
        data[idx] = isEdge ? 200 : 0;
        data[idx + 1] = 0;
        data[idx + 2] = isEdge ? 0 : 200;
        data[idx + 3] = 255;
      }
    }

    const sampled = sampleParticlesFromPixels({ width, height, data }, 10_000, {
      seed: 123,
    });
    let edgeHits = 0;
    for (let i = 0; i < sampled.count; i++) {
      if (sampled.colors[i * 3]! > 0.5) edgeHits += 1;
    }
    const edgeShare = edgeHits / sampled.count;
    expect(edgeShare).toBeGreaterThan(0.68);
    expect(edgeShare).toBeLessThan(0.75);
  });

  it("throws when an image contains no opaque pixels above alpha 0.5", () => {
    const data = new Uint8ClampedArray(4 * 4 * 4);
    expect(() =>
      sampleParticlesFromPixels({ width: 4, height: 4, data }, 100),
    ).toThrow(/opaque/i);
  });

  it("samples sparse ambient dust around the mark with dim brand-tinted colours", () => {
    const dust = sampleAmbientDust(1500, 99);
    expect(dust.count).toBe(1500);
    expect(dust.positions).toHaveLength(1500 * 3);
    expect(dust.colors).toHaveLength(1500 * 3);
    expect(dust.seeds).toHaveLength(1500);

    for (let i = 0; i < dust.count; i++) {
      const r = dust.colors[i * 3]!;
      const g = dust.colors[i * 3 + 1]!;
      const b = dust.colors[i * 3 + 2]!;
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(1);
      expect(g).toBeGreaterThanOrEqual(0);
      expect(g).toBeLessThanOrEqual(1);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThanOrEqual(1);
      expect(r + g + b).toBeGreaterThan(0);

      const s = dust.seeds[i]!;
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(1);
    }
  });
});
