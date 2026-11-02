import Link from "next/link";
import { AmbientField } from "@/components/motion/ambient-field";
import { Rise } from "@/components/motion/reveal";
import type { Accent, PageInfo } from "@/lib/navigation/modules";
import type { Register } from "./app-shell";

// The sub-brand shows as one short bar above the title, in a token colour. No
// eyebrow label and no gradient wash: the title and subtitle carry the page.
const barClass: Record<Accent, string> = {
  blue: "bg-accent-ink",
  pink: "bg-pink-ink",
  violet: "bg-violet-ink",
};

/**
 * Title block with the module's sub-brand name. The public register is
 * editorial: a large serif name, optionally over the quiet particle field. The
 * workspace register is compact: a plain heading, and a breadcrumb on child
 * pages. Particles stay out of forms, tables and Control, so `ambient` is off
 * there.
 */
export function ModuleHero({
  page,
  register,
  ambient = false,
}: {
  page: Pick<PageInfo, "title" | "subtitle" | "accent" | "parent">;
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
        ) : null}
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
        <AmbientField className="absolute inset-0 -z-10 opacity-60" />
      ) : null}
      <div className="px-(--spacing-gutter) py-(--spacing-section)">
        <Rise>
          <span
            aria-hidden="true"
            className={`${barClass[page.accent]} block h-1 w-14 rounded-full`}
          />
          <h1 className="text-heading-1 mt-6 max-w-4xl font-serif font-medium tracking-tight text-balance break-words">
            {page.title}
          </h1>
          <p className="text-muted text-lead mt-5 max-w-(--spacing-prose) text-pretty">
            {page.subtitle}
          </p>
        </Rise>
      </div>
    </div>
  );
}
