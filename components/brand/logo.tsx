import Image from "next/image";
import {
  MIN_LOGO_HEIGHT,
  brandSvgPath,
  findBrandMaster,
} from "@/lib/brand/catalog";

type LogoProps = {
  /** Asset name from lib/brand/catalog.ts, for example "yes-logomark-pink". */
  slug: string;
  /** Rendered height in CSS px. Values below the 31 px screen floor are raised. */
  height: number;
  className?: string;
  priority?: boolean;
};

/**
 * Official logo. Width follows the master's aspect ratio, so the logo is only
 * ever scaled proportionally, and it never renders below the guideline floor.
 * SVGs are served as-is (`unoptimized`): they are already vector and cropped.
 */
export function Logo({ slug, height, className, priority }: LogoProps) {
  const master = findBrandMaster(slug);
  const h = Math.max(height, MIN_LOGO_HEIGHT);
  const w = Math.round(h * master.aspectRatio * 100) / 100;
  return (
    <Image
      src={brandSvgPath(master)}
      alt={master.alt}
      width={w}
      height={h}
      unoptimized
      priority={priority}
      loading={priority ? "eager" : undefined}
      data-logo={slug}
      className={className}
      style={{ height: h, width: "auto" }}
    />
  );
}
