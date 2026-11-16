import { pageMetadata } from "@/components/layout/module-page";
import { YES_PLANS } from "@/lib/yes/data";
import { PlanCard } from "@/components/yes/plan-card";

export const metadata = pageMetadata("/yes/plans");

export default function YesPlansPage() {
  return (
    <div className="space-y-16 py-8">
      {/* Header */}
      <section className="px-(--spacing-gutter) text-center">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="text-ink text-3xl font-extrabold tracking-tight sm:text-5xl">
            Choose Your{" "}
            <span className="from-yes-pink to-yes-gradient-end bg-gradient-to-r bg-clip-text text-transparent">
              5G Infinite Plan
            </span>
          </h1>
          <p className="text-muted text-base leading-relaxed">
            Full-speed uncapped 5G data, generous hotspot quotas, and nationwide
            reach designed for smartphones and high-bandwidth lifestyles.
          </p>
          <div className="border-line bg-surface-elevated/80 text-muted inline-block rounded-lg border px-3 py-1.5 text-xs">
            Concept design – not live pricing · See{" "}
            <a
              href="https://www.yes.my/postpaid/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-yes-pink font-medium underline"
            >
              official yes.my postpaid rates ↗
            </a>
          </div>
        </div>
      </section>

      {/* Plan Cards Grid */}
      <section className="px-(--spacing-gutter)">
        <div className="max-w-page mx-auto grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {YES_PLANS.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
      </section>

      {/* Disclaimers & Official note */}
      <section className="px-(--spacing-gutter)">
        <div className="border-line bg-surface/80 text-muted mx-auto max-w-3xl space-y-2 rounded-2xl border p-6 text-xs">
          <p className="text-ink font-semibold">
            Subscription Guidelines & Terms:
          </p>
          <p>
            1. All plan features listed above are part of the YTL Nexus UX
            redesign concept showcase.
          </p>
          <p>
            2. Verified Malaysian citizens (MyKad) and international residents
            (Passport) may activate official Yes 5G SIMs and eSIMs exclusively
            via the MyYes app or official Yes stores.
          </p>
          <p>
            3. 5G speeds depend on device hardware capabilities, location, cell
            tower load, and building penetration.
          </p>
        </div>
      </section>
    </div>
  );
}
