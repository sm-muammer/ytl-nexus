import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { StatusBadge } from "@/components/ui/status-badge";
import { brandMasters, type BrandMaster } from "@/lib/brand/catalog";
import {
  brandColours,
  contrastRatio,
  themes,
  type ThemeRole,
} from "@/lib/design/tokens";

export const metadata: Metadata = {
  title: "Design",
  description: "Logos, colour, type and motion tokens for YTL Nexus.",
  robots: { index: false, follow: false },
};

// The reference page is internal and lives in the workspace route group, so
// the shell supplies the main landmark. Task 6 puts requireRole("viewer") in
// front of it; until identity exists the route is open but never indexed.

const LIGHT_VARIANTS = new Set([
  "main-colour",
  "black-wordmark",
  "black-monochrome",
  "black",
]);

function isOnLight(master: BrandMaster) {
  if (master.brand === "yes") {
    return master.variant === "pink" || master.variant === "black";
  }
  return LIGHT_VARIANTS.has(master.variant);
}

/**
 * Clear space per the YTL guideline equals the height of the "Nine Pillars"
 * symbol. In the horizontal logos the symbol spans the full logo height; in the
 * centred logo it is the top element, measured here as about half the height.
 * The supplied assets include no Yes guideline, so the Yes value is a
 * conservative quarter of the mark's height.
 */
function clearSpace(master: BrandMaster, height: number) {
  if (master.brand === "yes") return Math.round(height * 0.25);
  return Math.round(height * (master.arrangement === "centered" ? 0.5 : 1));
}

function logoHeight(master: BrandMaster) {
  if (master.brand === "yes") return 64;
  return master.arrangement === "centered" ? 72 : 40;
}

function LogoFrame({ master }: { master: BrandMaster }) {
  const height = logoHeight(master);
  const clear = clearSpace(master, height);
  const onLight = isOnLight(master);
  return (
    <figure className="m-0 flex flex-col gap-3">
      <div
        data-theme={onLight ? "light" : "dark"}
        data-logo-frame
        data-clear-space={clear}
        className="bg-canvas border-border-strong flex w-fit max-w-full border border-dashed"
        style={{ padding: clear }}
      >
        <div className="outline-pink-ink outline outline-1 outline-offset-0">
          <Logo slug={master.slug} height={height} />
        </div>
      </div>
      <figcaption className="text-muted text-data font-mono">
        {master.slug}
        <br />
        clear space {clear}px, {onLight ? "light" : "dark"} background
      </figcaption>
    </figure>
  );
}

const brandSwatches = [
  {
    name: "YTL Blue",
    cls: "bg-ytl-blue",
    hex: brandColours.ytlBlue,
    note: "Pantone 2995 C",
  },
  {
    name: "YTL Black",
    cls: "bg-ytl-black",
    hex: brandColours.ytlBlack,
    note: "Pantone Black 7 C",
  },
  {
    name: "YTL Grey",
    cls: "bg-ytl-grey",
    hex: brandColours.ytlGrey,
    note: "Cool Gray 6 C",
  },
  {
    name: "Yes pink",
    cls: "bg-yes-pink",
    hex: brandColours.yesPink,
    note: "Yes logomark fill",
  },
  {
    name: "Yes gradient end",
    cls: "bg-yes-gradient-end",
    hex: brandColours.yesGradientEnd,
    note: "Yes gradient, last stop",
  },
];

const roleOrder: ThemeRole[] = [
  "canvas",
  "surface",
  "surface-raised",
  "line",
  "border-strong",
  "ink",
  "muted",
  "accent-ink",
  "pink-ink",
  "violet-ink",
  "ok-ink",
  "warn-ink",
  "bad-ink",
];

function ThemePalette({ name }: { name: "dark" | "light" }) {
  const t = themes[name];
  return (
    <div
      data-theme={name}
      className="bg-canvas border-line rounded-lg border p-5"
    >
      <h3 className="text-heading-3 mb-4 font-semibold capitalize">
        {name} theme
      </h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {roleOrder.map((role) => (
          <li key={role} className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="border-border-strong size-10 shrink-0 rounded-md border"
              style={{ background: `var(--nx-${role})` }}
            />
            <span className="text-data">
              <span className="text-ink block font-medium">{role}</span>
              <span className="text-muted font-mono">
                {t[role]}
                {role.endsWith("-ink") || role === "muted"
                  ? `, ${contrastRatio(t[role], t.canvas).toFixed(1)}:1`
                  : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const tokenTables = {
  Spacing: [
    ["--spacing-gutter", "clamp(1rem, 0.6rem + 2vw, 3rem)"],
    ["--spacing-section", "clamp(4rem, 3rem + 5vw, 9rem)"],
    ["--spacing-prose", "65ch"],
  ],
  Radius: [
    ["--radius-sm", "0.25rem"],
    ["--radius-md", "0.5rem"],
    ["--radius-lg", "0.875rem"],
    ["--radius-xl", "1.5rem"],
    ["--radius-pill", "999px"],
  ],
  Motion: [
    ["--duration-instant", "80ms"],
    ["--duration-fast", "140ms"],
    ["--duration-base", "220ms"],
    ["--duration-slow", "420ms"],
    ["--duration-ribbon", "700ms"],
    ["--ease-out-quint", "cubic-bezier(0.22, 1, 0.36, 1)"],
    ["--ease-in-quad", "cubic-bezier(0.55, 0.085, 0.68, 0.53)"],
    ["--ease-in-out-cubic", "cubic-bezier(0.65, 0, 0.35, 1)"],
  ],
  "Z-layers": [
    ["--z-base", "0"],
    ["--z-raised", "10"],
    ["--z-sticky", "20"],
    ["--z-dropdown", "30"],
    ["--z-overlay", "40"],
    ["--z-modal", "50"],
    ["--z-toast", "60"],
    ["--z-skip-link", "70"],
  ],
} as const;

const typeScale = [
  ["text-display", "text-display font-serif"],
  ["text-heading-1", "text-heading-1 font-serif"],
  ["text-heading-2", "text-heading-2 font-semibold"],
  ["text-heading-3", "text-heading-3 font-semibold"],
  ["text-lead", "text-lead"],
  ["text-body", "text-body"],
  ["text-data", "text-data"],
] as const;

export default function DesignPage() {
  const ytl = brandMasters.filter((m) => m.brand === "ytl-communications");
  const yes = brandMasters.filter((m) => m.brand === "yes");
  return (
    <div className="flex flex-col gap-20 px-(--spacing-gutter) py-(--spacing-section)">
      <div className="max-w-(--spacing-prose)">
        <p className="text-accent-ink font-mono text-xs tracking-[0.3em] uppercase">
          Adaptive Nexus
        </p>
        <h1 className="text-heading-1 mt-4 font-serif font-medium text-balance">
          Design reference
        </h1>
        <p className="text-muted text-lead mt-4">
          Official logos, colour roles, type, spacing, motion and layering used
          across YTL Nexus. Components use these tokens, never raw values.
        </p>
      </div>

      <section aria-labelledby="logos-ytl" className="flex flex-col gap-8">
        <div className="max-w-(--spacing-prose)">
          <h2 id="logos-ytl" className="text-heading-2 font-semibold">
            YTL Communications logos
          </h2>
          <p className="text-muted mt-3">
            Three arrangements in five treatments. Dashed outline: clear space
            equal to the height of the Nine Pillars symbol. Pink outline: the
            logo itself. Minimum height is 31 CSS px (8 mm).
          </p>
        </div>
        <div className="flex flex-wrap gap-10">
          {ytl.map((m) => (
            <LogoFrame key={m.slug} master={m} />
          ))}
        </div>
      </section>

      <section aria-labelledby="logos-yes" className="flex flex-col gap-8">
        <div className="max-w-(--spacing-prose)">
          <h2 id="logos-yes" className="text-heading-2 font-semibold">
            Yes logomarks
          </h2>
          <p className="text-muted mt-3">
            Never recoloured. The gradient is kept as real gradient stops in the
            SVG. No separate Yes guideline was supplied, so the clear space here
            is a conservative working value.
          </p>
        </div>
        <div className="flex flex-wrap gap-10">
          {yes.map((m) => (
            <LogoFrame key={m.slug} master={m} />
          ))}
        </div>
      </section>

      <section aria-labelledby="colour" className="flex flex-col gap-8">
        <h2 id="colour" className="text-heading-2 font-semibold">
          Colour
        </h2>
        <h3 className="text-heading-3 font-semibold">Brand colours</h3>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {brandSwatches.map((s) => (
            <li key={s.name} className="flex flex-col gap-2">
              <span
                aria-hidden="true"
                className={`${s.cls} border-border-strong h-20 rounded-lg border`}
              />
              <span className="font-medium">{s.name}</span>
              <span className="text-muted text-data font-mono">
                {s.hex}, {s.note}
              </span>
            </li>
          ))}
        </ul>
        <div className="grid gap-6 lg:grid-cols-2">
          <ThemePalette name="dark" />
          <ThemePalette name="light" />
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-heading-3 font-semibold">Status</h3>
          <p className="text-muted max-w-(--spacing-prose)">
            Green, amber and red are for status only. Each state has its own
            icon and a text label, so colour is never the only signal.
          </p>
          <div className="flex flex-wrap gap-3">
            <StatusBadge status="ok" />
            <StatusBadge status="warn" />
            <StatusBadge status="bad" />
          </div>
        </div>
      </section>

      <section aria-labelledby="type" className="flex flex-col gap-8">
        <div className="max-w-(--spacing-prose)">
          <h2 id="type" className="text-heading-2 font-semibold">
            Typography
          </h2>
          <p className="text-muted mt-3">
            Fraunces for editorial headings, Geist for interface text, Geist
            Mono for data. All three are SIL Open Font License 1.1 and are
            served from this repository.
          </p>
        </div>
        <ul className="flex flex-col gap-6">
          {typeScale.map(([name, cls]) => (
            <li key={name} className="border-line border-b pb-6">
              <span className="text-muted text-data font-mono">{name}</span>
              <p className={`${cls} mt-1 text-balance`}>
                One platform for infrastructure
              </p>
            </li>
          ))}
        </ul>
        <p className="text-data font-mono">
          0123456789 · nexus-web.service · 10.26.64.164 · 99.982%
        </p>
      </section>

      <section aria-labelledby="tokens" className="flex flex-col gap-8">
        <h2 id="tokens" className="text-heading-2 font-semibold">
          Spacing, radius, motion and layers
        </h2>
        <div className="grid gap-6 lg:grid-cols-2">
          {Object.entries(tokenTables).map(([title, rows]) => (
            <div
              key={title}
              className="border-line bg-surface rounded-lg border p-5"
            >
              <h3 className="text-heading-3 mb-3 font-semibold">{title}</h3>
              <dl className="text-data grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 font-mono">
                {rows.map(([token, value]) => (
                  <div key={token} className="contents">
                    <dt className="text-ink">{token}</dt>
                    <dd className="text-muted break-words">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
