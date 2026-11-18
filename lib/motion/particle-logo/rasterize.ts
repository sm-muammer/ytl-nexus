import type { PixelBuffer } from "./sampling";

const DEFAULT_RASTER_SIZE = 768;

/**
 * Loads an SVG (or raster image) URL and rasterises it to an offscreen 2D
 * canvas (~768 px on its long side) to obtain RGBA pixels for particle sampling.
 */
export async function rasterizeSvgToPixels(
  src: string,
  maxSide = DEFAULT_RASTER_SIZE,
): Promise<PixelBuffer> {
  const img = new Image();
  img.decoding = "async";

  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });

  if (typeof img.decode === "function") {
    try {
      await img.decode();
    } catch {
      // onload already fired; continue if decode rejects on SVG in older engines.
    }
  }

  const natW = img.naturalWidth || maxSide;
  const natH = img.naturalHeight || maxSide;
  const scale = maxSide / Math.max(natW, natH);
  const width = Math.max(1, Math.round(natW * scale));
  const height = Math.max(1, Math.round(natH * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("2D canvas context unavailable for SVG rasterisation");
  }

  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const imageData = ctx.getImageData(0, 0, width, height);

  return {
    width,
    height,
    data: imageData.data,
  };
}
