// The single list of official brand masters and the files generated from them.
// Aspect ratios come from the cropped master PNGs in assets/source/.

export type BrandMaster = {
  brand: "ytl-communications" | "yes";
  /** Output name without extension, for example "yes-logomark-pink". */
  slug: string;
  /** Source PDF path relative to the repository root. */
  pdf: string;
  /** Source PNG path relative to the repository root. */
  png: string;
  arrangement: "primary" | "left" | "centered" | "logomark";
  variant: string;
  /** Width over height of the cropped master PNG. */
  aspectRatio: number;
  /** CSS pixel widths for the 1x PNG fallback; the 2x file is generated too. */
  displayWidth: number;
  alt: string;
};

const ytlRoot = "assets/source/ytl-communications";

const ytlVariants = [
  { dir: "main-colour", slug: "main-colour", file: "", label: "main colour" },
  {
    dir: "black-wordmark",
    slug: "black-wordmark",
    file: "_YTL Black Wordmark",
    label: "black wordmark",
  },
  {
    dir: "reverse-white-wordmark",
    slug: "reverse-white-wordmark",
    file: "_Reverse-white Wordmark",
    label: "reverse white wordmark",
  },
  {
    dir: "black-monochrome",
    slug: "black-monochrome",
    file: "_YTL Black Monochrome",
    label: "black monochrome",
  },
  {
    dir: "reverse-white-monochrome",
    slug: "reverse-white-monochrome",
    file: "_Reverse-white Monochrome",
    label: "reverse white monochrome",
  },
] as const;

const ytlArrangements = [
  { key: "primary", file: "Primary", displayWidth: 200 },
  { key: "left", file: "Left", displayWidth: 200 },
  { key: "centered", file: "Centered", displayWidth: 120 },
] as const;

// Pixel size of each cropped master PNG: [arrangement][variant dir].
const ytlPngSize: Record<string, Record<string, [number, number]>> = {
  primary: {
    "main-colour": [3722, 760],
    "black-wordmark": [3722, 760],
    "reverse-white-wordmark": [3722, 760],
    "black-monochrome": [3688, 696],
    "reverse-white-monochrome": [3688, 696],
  },
  left: {
    "main-colour": [3722, 760],
    "black-wordmark": [3722, 760],
    "reverse-white-wordmark": [3722, 760],
    "black-monochrome": [3689, 696],
    "reverse-white-monochrome": [3689, 696],
  },
  centered: {
    "main-colour": [3084, 1452],
    "black-wordmark": [3084, 1452],
    "reverse-white-wordmark": [3084, 1452],
    "black-monochrome": [3084, 1419],
    "reverse-white-monochrome": [3084, 1419],
  },
};

const ytlMasters: BrandMaster[] = ytlArrangements.flatMap((a) =>
  ytlVariants.map((v) => {
    const base = `YTL Communications_${a.file} Logo${v.file}_Final`;
    const [w, h] = ytlPngSize[a.key]![v.dir]!;
    return {
      brand: "ytl-communications" as const,
      slug: `ytl-communications-${a.key}-${v.slug}`,
      pdf: `${ytlRoot}/${v.dir}/pdf/${base}.pdf`,
      png: `${ytlRoot}/${v.dir}/png/${base}.png`,
      arrangement: a.key,
      variant: v.slug,
      aspectRatio: w / h,
      displayWidth: a.displayWidth,
      alt: `YTL Communications, ${a.key} logo, ${v.label}`,
    };
  }),
);

const yesVariants = ["gradient", "pink", "black", "white"] as const;

const yesMasters: BrandMaster[] = yesVariants.map((v) => {
  const name = `Yes_Logomark_${v[0]!.toUpperCase()}${v.slice(1)}`;
  return {
    brand: "yes" as const,
    slug: `yes-logomark-${v}`,
    pdf: `assets/source/yes/${v}/pdf/${name}.pdf`,
    png: `assets/source/yes/${v}/png/${name}.png`,
    arrangement: "logomark" as const,
    variant: v,
    aspectRatio: 2250 / 2251,
    displayWidth: 48,
    alt: `Yes logomark, ${v}`,
  };
});

export const brandMasters: readonly BrandMaster[] = [
  ...ytlMasters,
  ...yesMasters,
];

export function pngFilename(master: BrandMaster, scale: 1 | 2): string {
  return `${master.slug}-w${master.displayWidth * scale}.png`;
}

/** Every file the pipeline writes to public/brand/. */
export function brandAssetFilenames(): string[] {
  return brandMasters.flatMap((m) => [
    `${m.slug}.svg`,
    pngFilename(m, 1),
    pngFilename(m, 2),
  ]);
}

/** Screen floor from the YTL guideline: 8 mm at 96 CSS px per inch. */
export const MIN_LOGO_HEIGHT = 31;

export function findBrandMaster(slug: string): BrandMaster {
  const master = brandMasters.find((m) => m.slug === slug);
  if (!master) throw new Error(`Unknown brand asset: ${slug}`);
  return master;
}

export function brandSvgPath(master: BrandMaster): string {
  return `/brand/${master.slug}.svg`;
}
