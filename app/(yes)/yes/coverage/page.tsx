import { pageMetadata } from "@/components/layout/module-page";
import { CoverageChecker } from "@/components/yes/coverage-checker";

export const metadata = pageMetadata("/yes/coverage");

export default function YesCoveragePage() {
  return (
    <div className="space-y-16 py-8">
      {/* Header */}
      <section className="px-(--spacing-gutter) text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl text-ink">
            Check Your{" "}
            <span className="bg-gradient-to-r from-yes-pink to-yes-gradient-end bg-clip-text text-transparent">
              5G Coverage
            </span>
          </h1>
          <p className="text-muted text-base leading-relaxed">
            Verify 5G network strength, expected throughput speeds, and tower
            availability in your town, neighborhood, or office.
          </p>
        </div>
      </section>

      {/* Coverage Checker Component */}
      <section className="px-(--spacing-gutter)">
        <CoverageChecker />
      </section>

      {/* Infrastructure Details */}
      <section className="px-(--spacing-gutter)">
        <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="border-line bg-surface/80 rounded-2xl border p-5">
            <span className="text-2xl font-bold text-ink">&gt; 80%</span>
            <p className="text-muted mt-1 text-xs">
              National Populated Coverage (COPA)
            </p>
          </div>
          <div className="border-line bg-surface/80 rounded-2xl border p-5">
            <span className="text-2xl font-bold text-ink">700MHz / 3.5GHz</span>
            <p className="text-muted mt-1 text-xs">
              Dual-Band 5G Infrastructure
            </p>
          </div>
          <div className="border-line bg-surface/80 rounded-2xl border p-5">
            <span className="text-2xl font-bold text-ink">Zero Throttling</span>
            <p className="text-muted mt-1 text-xs">Full Speed Nationwide</p>
          </div>
        </div>
      </section>
    </div>
  );
}
