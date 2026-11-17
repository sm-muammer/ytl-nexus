import Link from "next/link";
import type { ContentItem } from "@/lib/content/types";
import type { DataSource } from "@/lib/server/adapters/types";

/** Plain notice when WordPress cannot be reached. Never shows a host or error. */
export function ContentUnavailable() {
  return (
    <p role="status" className="border-border-strong border-l-2 pl-6">
      The content service is not reachable right now. Try again in a minute.
    </p>
  );
}

export function SourceLabel(_props: { source?: DataSource }) {
  return null;
}

export function AudienceTag({
  audience,
}: {
  audience: ContentItem["audience"];
}) {
  return audience === "internal" ? (
    <span className="text-data text-muted border-line rounded-sm border px-2 py-0.5">
      Internal
    </span>
  ) : null;
}

export function ItemList({
  items,
  basePath = "/library",
}: {
  items: readonly ContentItem[];
  basePath?: string;
}) {
  if (items.length === 0) {
    return <p className="text-muted">Nothing here yet.</p>;
  }
  return (
    <ul className="divide-line border-line divide-y border-y">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            href={`${basePath}/${item.slug}`}
            className="hover:bg-surface flex min-h-11 flex-col gap-0.5 px-2 py-4 transition-colors duration-(--duration-fast)"
          >
            <span className="flex flex-wrap items-center gap-3">
              <span className="font-medium">{item.title}</span>
              <AudienceTag audience={item.audience} />
            </span>
            <span className="text-muted text-data">{item.excerpt}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** The HTML was sanitized when the item was mapped (lib/content/wp.ts). */
export function ItemBody({ html }: { html: string }) {
  return (
    <div
      className="content-body max-w-(--spacing-prose) space-y-4 [&_a]:underline [&_code]:font-mono [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
