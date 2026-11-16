import Link from "next/link";
import { findModule } from "@/lib/navigation/modules";
import { ROLE_LABEL, type Role } from "@/lib/roles";

export function RelatedModules({
  slugs,
  title = "Related modules",
  className = "",
}: {
  slugs: readonly string[];
  title?: string;
  className?: string;
}) {
  const modules = slugs.map((s) => findModule(s)).filter(Boolean);
  if (modules.length === 0) return null;

  return (
    <section
      aria-labelledby="related-modules-title"
      className={`border-line bg-surface-elevated/40 rounded-xl border p-6 ${className}`}
      data-related-modules
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="related-modules-title" className="text-base font-semibold">
          {title}
        </h2>
        <span className="text-muted text-xs">Connected subsystems</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <Link
            key={m.slug}
            href={m.href}
            className="border-line bg-surface hover:border-ink hover:bg-surface-elevated flex flex-col justify-between rounded-lg border p-4 transition-all duration-200"
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-ink text-sm font-semibold">{m.name}</span>
                {m.minRole ? (
                  <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300 uppercase">
                    {ROLE_LABEL[m.minRole as Role] ?? m.minRole}
                  </span>
                ) : (
                  <span className="text-muted text-[10px] font-medium uppercase">
                    Public
                  </span>
                )}
              </div>
              <p className="text-muted mt-1 line-clamp-2 text-xs">
                {m.summary}
              </p>
            </div>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-sky-400">
              Open module &rarr;
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
