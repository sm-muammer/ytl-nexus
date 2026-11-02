import Link from "next/link";
import { AmbientField } from "@/components/motion/ambient-field";
import { Rise } from "@/components/motion/reveal";
import {
  NAV_GROUP_LABEL,
  type Accent,
  type PageInfo,
} from "@/lib/navigation/modules";
import type { Register } from "./app-shell";

const eyebrowClass: Record<Accent, string> = {
  blue: "text-accent-ink",
  pink: "text-pink-ink",
  violet: "text-violet-ink",
};

// Literal class strings so Tailwind can find them. Colours come from tokens.
const glowClass: Record<Accent, string> = {
  blue: "bg-[radial-gradient(60rem_40rem_at_85%_0%,color-mix(in_oklab,var(--color-ytl-blue)_20%,transparent),transparent_70%)]",
  pink: "bg-[radial-gradient(60rem_40rem_at_85%_0%,color-mix(in_oklab,var(--color-yes-pink)_20%,transparent),transparent_70%)]",
  violet:
    "bg-[radial-gradient(60rem_40rem_at_85%_0%,color-mix(in_oklab,var(--color-violet-ink)_22%,transparent),transparent_70%)]",
};

/**
 * Title block with the module's sub-brand name. The public register is
 * editorial: a large serif name over a quiet particle field. The workspace
 * register is compact: a breadcrumb, a plain heading and no decoration.
 * Particles stay out of forms, tables and Control, so `ambient` is off there.
 */
export function ModuleHero({
  page,
  register,
  ambient = false,
}: {
  page: Pick<PageInfo, "title" | "subtitle" | "accent" | "group" | "parent">;
  register: Register;
  ambient?: boolean;
}) {
  if (register === "workspace") {
    return (
      <div className="border-line border-b px-(--spacing-gutter) py-6">
        {page.parent ? (
          <nav aria-label="Breadcrumb" className="text-data mb-1">
            <Link
              href={page.parent.href}
              className="text-muted hover:text-ink inline-flex min-h-11 items-center underline-offset-4 hover:underline md:min-h-6"
            >
              {page.parent.name}
            </Link>
          </nav>
        ) : (
          <p
            className={`${eyebrowClass[page.accent]} mb-1 font-mono text-xs tracking-[0.2em] uppercase`}
          >
            {NAV_GROUP_LABEL[page.group]}
          </p>
        )}
        <h1 className="text-heading-2 font-semibold text-balance">
          {page.title}
        </h1>
        <p className="text-muted mt-1 max-w-(--spacing-prose)">
          {page.subtitle}
        </p>
      </div>
    );
  }

  return (
    <div className="border-line relative isolate overflow-hidden border-b">
      {ambient ? (
        <AmbientField className="absolute inset-0 -z-10 opacity-80" />
      ) : null}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 ${glowClass[page.accent]}`}
      />
      <div className="px-(--spacing-gutter) py-(--spacing-section)">
        <Rise>
          <p
            className={`${eyebrowClass[page.accent]} font-mono text-xs tracking-[0.3em] uppercase`}
          >
            {NAV_GROUP_LABEL[page.group]}
          </p>
        </Rise>
        <Rise delay={0.06}>
          <h1 className="text-heading-1 mt-4 max-w-4xl font-serif font-medium tracking-tight text-balance break-words">
            {page.title}
          </h1>
        </Rise>
        <Rise delay={0.12}>
          <p className="text-muted text-lead mt-5 max-w-(--spacing-prose) text-pretty">
            {page.subtitle}
          </p>
        </Rise>
      </div>
    </div>
  );
}
