import type { YesPlan } from "@/lib/yes/data";

export function PlanCard({ plan }: { plan: YesPlan }) {
  return (
    <div
      className={`border-line bg-surface/90 relative flex flex-col justify-between rounded-2xl border p-6 transition-all hover:shadow-lg ${
        plan.popular
          ? "ring-yes-pink shadow-md ring-2"
          : "hover:border-border-strong"
      }`}
    >
      {plan.popular && (
        <span className="bg-yes-pink text-surface absolute -top-3 right-6 rounded-full px-3 py-0.5 text-xs font-semibold shadow-xs">
          Popular Choice
        </span>
      )}

      <div>
        <div className="flex items-baseline justify-between">
          <h3 className="text-ink text-lg font-bold tracking-tight">
            {plan.title}
          </h3>
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-ink text-3xl font-extrabold">{plan.price}</span>
          <span className="text-muted text-sm">{plan.period}</span>
        </div>

        <p className="text-muted/80 mt-1 text-xs">
          Concept design – not live pricing
        </p>

        <ul className="mt-6 space-y-3 text-sm">
          {plan.features.map((feat, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <svg
                aria-hidden="true"
                className="text-status-success mt-0.5 h-4 w-4 shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2.5"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-ink/90 leading-snug">{feat}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <a
          href={plan.officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="focus-ring bg-yes-pink text-surface inline-flex w-full items-center justify-center rounded-xl py-2.5 text-center text-sm font-semibold shadow-xs transition-transform hover:opacity-95 active:scale-95"
        >
          Select Plan on yes.my ↗
        </a>
      </div>
    </div>
  );
}
