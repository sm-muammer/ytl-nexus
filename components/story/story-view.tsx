import Link from "next/link";
import { ItemBody } from "@/components/content/content-parts";
import { Rise } from "@/components/motion/reveal";
import { ChapterToc } from "@/components/story/chapter-toc";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import type { ContentItem } from "@/lib/content/types";
import type { DataSource } from "@/lib/server/adapters/types";
import {
  BEFORE_AFTER_COMPARISON,
  CONTINUE_LINKS,
  HANDOVER_TEAM,
  PROJECT_DOSSIER_FACTS,
  estimateReadingMinutes,
  getChapterMeta,
} from "@/lib/story/dossier";

const ctaPrimary =
  "bg-accent-ink text-canvas inline-flex min-h-11 min-w-11 items-center rounded-full px-6 text-sm font-medium transition-opacity duration-(--duration-fast) hover:opacity-90 active:scale-[0.98]";
const ctaSecondary =
  "border-border-strong bg-surface/70 hover:bg-surface-raised text-ink inline-flex min-h-11 min-w-11 items-center rounded-full border px-6 text-sm font-medium transition-[transform,background-color,border-color] duration-(--duration-fast) active:scale-[0.98]";

export function StoryView({
  chapters,
  source,
}: {
  chapters: readonly ContentItem[];
  source: DataSource;
}) {
  const readingMinutes = estimateReadingMinutes(chapters);
  const tocItems = chapters.map((chapter) => ({
    slug: chapter.slug,
    title: chapter.title,
    tag: getChapterMeta(chapter.slug).tag,
  }));

  return (
    <div className="max-w-page mx-auto space-y-16 px-(--spacing-gutter) pb-16">
      {/* Editorial Framing & Mandatory Disclaimer (STORY-03) */}
      <section
        aria-label="Project statement"
        className="border-pink-ink border-l pl-6"
      >
        <p className="text-ink text-lead max-w-(--spacing-prose) font-normal text-pretty">
          YTL Nexus is an internship project, not an official YTL commercial
          product.
        </p>
        <p className="text-muted mt-3 max-w-(--spacing-prose) leading-relaxed text-pretty">
          Designed and engineered by{" "}
          <strong className="text-ink font-semibold">Muammer</strong> (BSc IT
          Cloud Engineering, APU Malaysia) with the{" "}
          <strong className="text-ink font-semibold">
            YTL Communications IT Infrastructure
          </strong>{" "}
          team — a greenfield case study on unifying telemetry, local AI,
          enterprise mail, SFTP, relational records, headless publishing, and
          security assurance on one hardened Rocky Linux host.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <LiveDemoLabel source={source} />
          <span className="text-muted font-mono text-xs tabular-nums">
            {chapters.length} chapters
          </span>
          <span aria-hidden="true" className="text-line">
            ·
          </span>
          <span className="text-muted font-mono text-xs tabular-nums">
            ~{readingMinutes} min read
          </span>
          <span aria-hidden="true" className="text-line">
            ·
          </span>
          <span className="text-muted font-mono text-xs">
            Rocky Linux 9 · Nexus Core 01
          </span>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/tour" className={ctaPrimary}>
            Take the guided tour
          </Link>
          <Link href="/platform" className={ctaSecondary}>
            Inspect platform architecture
          </Link>
        </div>
      </section>

      {/* Static Code-Derived Project Dossier */}
      <section aria-labelledby="story-dossier-heading">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="story-dossier-heading"
            className="font-display text-heading-3 text-ink font-semibold tracking-tight"
          >
            Project dossier
          </h2>
          <p className="text-muted font-mono text-xs">
            Derived from codebase — not live server telemetry
          </p>
        </div>

        <dl className="border-line/70 divide-line/70 mt-5 grid divide-y border-y sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {PROJECT_DOSSIER_FACTS.map((fact) => (
            <div key={fact.label} className="flex flex-col gap-1.5 p-6">
              <dt className="text-muted font-mono text-xs tracking-[0.12em] uppercase">
                {fact.label}
              </dt>
              <dd className="text-heading-1 font-display text-ink order-first font-semibold tracking-tight tabular-nums">
                {fact.value}
              </dd>
              <dd className="text-muted text-data mt-1 leading-relaxed">
                {fact.note}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Before & After Greenfield Comparison */}
      <section aria-labelledby="story-before-after-heading">
        <h2
          id="story-before-after-heading"
          className="font-display text-heading-3 text-ink font-semibold tracking-tight"
        >
          Before &amp; after: greenfield rebuild
        </h2>
        <p className="text-muted mt-2 max-w-(--spacing-prose) text-pretty">
          Earlier prototype drafts on Nexus Core 01 were studied for
          requirements, backed up, and retired cleanly rather than patched.
        </p>

        <div className="border-line/70 divide-line/70 mt-6 grid divide-y border-y md:grid-cols-2 md:divide-x md:divide-y-0">
          {BEFORE_AFTER_COMPARISON.map((column, colIdx) => (
            <div
              key={column.heading}
              className="py-6 md:px-8 md:first:pl-0 md:last:pr-0"
            >
              <h3 className="font-display text-ink flex items-center gap-2.5 text-lg font-semibold tracking-tight">
                <span
                  aria-hidden="true"
                  className={`size-2 shrink-0 rounded-full ${
                    colIdx === 0 ? "bg-pink-ink" : "bg-accent-ink"
                  }`}
                />
                <span>{column.heading}</span>
              </h3>
              <p className="text-muted mt-1 font-mono text-xs">
                {column.subtitle}
              </p>
              <ul className="mt-4 space-y-2.5">
                {column.items.map((point) => (
                  <li
                    key={point}
                    className="text-ink/85 text-data flex items-start gap-2.5 leading-relaxed"
                  >
                    <span
                      aria-hidden="true"
                      className="text-muted font-mono text-xs"
                    >
                      —
                    </span>
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* 6-Chapter Reading Room */}
      <section
        aria-label="Case study chapters"
        className="border-line/70 border-t pt-12"
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-16">
          <aside className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <ChapterToc chapters={tocItems} />
            <p className="border-line/70 text-muted mt-6 hidden border-t pt-4 font-mono text-xs leading-relaxed lg:block">
              Chapters are authored in Nexus Studio headless WordPress with
              deterministic offline fixture fallback.
            </p>
          </aside>

          <div className="max-w-(--spacing-prose) min-w-0 space-y-14">
            {chapters.map((chapter, index) => {
              const meta = getChapterMeta(chapter.slug);
              return (
                <Rise key={chapter.slug} delay={Math.min(index * 0.04, 0.2)}>
                  <article
                    id={`chapter-${chapter.slug}`}
                    data-story-chapter
                    tabIndex={-1}
                    aria-labelledby={`ch-${chapter.slug}`}
                    className="border-line/70 scroll-mt-24 border-t pt-10 outline-none first:border-t-0 first:pt-0"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="border-line bg-surface-raised text-ink rounded-sm border px-2 py-0.5 font-mono text-xs font-medium tabular-nums">
                        Chapter {index + 1} of {chapters.length}
                      </span>
                      <span className="text-pink-ink font-mono text-xs font-medium">
                        {meta.tag}
                      </span>
                    </div>

                    <h2
                      id={`ch-${chapter.slug}`}
                      className="font-display text-heading-2 text-ink mt-3 font-semibold tracking-tight text-balance"
                    >
                      {chapter.title}
                    </h2>

                    <p className="text-muted text-data mt-2 text-pretty">
                      {meta.takeaway}
                    </p>

                    <div className="nx-story-prose text-ink/85 mt-6 leading-relaxed">
                      <ItemBody html={chapter.html} />
                    </div>
                  </article>
                </Rise>
              );
            })}
          </div>
        </div>
      </section>

      {/* Handover & Team Ownership */}
      <section
        aria-labelledby="story-handover-heading"
        className="border-line/70 border-t pt-12"
      >
        <h2
          id="story-handover-heading"
          className="font-display text-heading-3 text-ink font-semibold tracking-tight"
        >
          Handover &amp; team ownership
        </h2>
        <p className="text-muted mt-2 max-w-(--spacing-prose) text-pretty">
          YTL Nexus runs as a team-owned pilot with complete operational guides
          and zero dependency on personal intern accounts.
        </p>

        <div
          tabIndex={0}
          role="region"
          aria-label="Team responsibilities matrix"
          className="border-line/70 mt-6 overflow-x-auto border-y"
        >
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead className="border-line/70 text-muted border-b font-mono text-xs uppercase">
              <tr>
                <th scope="col" className="py-3.5 pr-6 font-semibold">
                  Owner
                </th>
                <th scope="col" className="px-6 py-3.5 font-semibold">
                  Role
                </th>
                <th scope="col" className="px-6 py-3.5 font-semibold">
                  Operational Focus
                </th>
                <th scope="col" className="py-3.5 pl-6 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-line/60 text-data divide-y">
              {HANDOVER_TEAM.map((member) => (
                <tr key={member.name}>
                  <td className="text-ink py-4 pr-6 font-semibold whitespace-nowrap">
                    {member.name}
                  </td>
                  <td className="text-muted px-6 py-4">{member.role}</td>
                  <td className="text-muted max-w-md px-6 py-4 leading-relaxed">
                    {member.focus}
                  </td>
                  <td className="text-accent-ink py-4 pl-6 font-mono text-xs whitespace-nowrap">
                    {member.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Continue Exploring */}
      <section
        aria-labelledby="story-continue-heading"
        className="border-line/70 border-t pt-12"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="story-continue-heading"
            className="font-display text-heading-3 text-ink font-semibold tracking-tight"
          >
            Continue exploring
          </h2>
          <span className="text-muted font-mono text-xs">
            Public showcase routes
          </span>
        </div>

        <ul className="border-line mt-6 grid grid-cols-1 border-t border-l sm:grid-cols-2 lg:grid-cols-4">
          {CONTINUE_LINKS.map((item) => (
            <li key={item.href} className="border-line border-r border-b">
              <Link
                href={item.href}
                className="hover:bg-surface/65 group flex h-full min-h-28 flex-col justify-between gap-3 p-5 transition-colors duration-150 ease-out"
              >
                <div>
                  <span className="font-display text-ink inline-flex items-baseline gap-2 text-base font-semibold">
                    <span>{item.title}</span>
                    <span
                      aria-hidden="true"
                      className="text-accent-ink text-sm transition-transform duration-150 ease-out group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </span>
                  <p className="text-muted text-data mt-1.5 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
