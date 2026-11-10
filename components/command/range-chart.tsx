import {
  CHART_BOX,
  linePath,
  makeScale,
  niceMax,
  sample,
  seriesMax,
} from "@/lib/monitoring/chart";
import type { SeriesPoint } from "@/lib/monitoring/snapshot";
import { ChartFrame, type Marker } from "./chart-frame";

export type ChartSeries = {
  name: string;
  points: readonly SeriesPoint[];
  /** Line style, so two series differ by more than colour. */
  style: "solid" | "dashed";
  colour: "accent" | "pink";
};

const stroke = {
  accent: "stroke-accent-ink",
  pink: "stroke-pink-ink",
} as const;

const zone = "Asia/Kuala_Lumpur";

function clock(ms: number, withDate: boolean): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: zone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(withDate ? { day: "2-digit", month: "short" } : {}),
  }).format(new Date(ms));
}

/**
 * A line chart drawn on the server as SVG, with a legend, native tooltips
 * (each marker has a <title>), and the same numbers in a table. Colours come
 * from the design tokens; a second series is also dashed.
 */
export function RangeChart({
  id,
  title,
  series,
  format,
  fixedMax,
  withDate,
}: {
  id: string;
  title: string;
  series: ChartSeries[];
  format: (v: number) => string;
  /** For percentages: the axis is always 0 to this value. */
  fixedMax?: number;
  withDate: boolean;
}) {
  const all = series.flatMap((s) => s.points);
  const usable = series.filter((s) => s.points.length >= 2);

  if (all.length === 0 || usable.length === 0) {
    return (
      <section
        aria-labelledby={`${id}-t`}
        data-chart={id}
        className="border-line border-t pt-4"
      >
        <h2 id={`${id}-t`} className="text-heading-3 font-semibold">
          {title}
        </h2>
        <p className="text-muted mt-2">No data for this range.</p>
      </section>
    );
  }

  const tMin = Math.min(...all.map((p) => p.t));
  const tMax = Math.max(...all.map((p) => p.t));
  const yMax = fixedMax ?? niceMax(seriesMax(series.map((s) => s.points)), 1);
  const scale = makeScale(CHART_BOX, tMin, tMax, yMax);
  const plotBottom = CHART_BOX.height - CHART_BOX.bottom;
  const ticks = [0, 0.5, 1].map((f) => f * yMax);
  const rows = sample(usable[0]?.points ?? [], 12);

  // One marker per sampled time, with every series' value at that time.
  const lookups = usable.map((s) => new Map(s.points.map((p) => [p.t, p.v])));
  const markers: Marker[] = sample(usable[0]?.points ?? [], 60).map((row) => ({
    x: scale.x(row.t),
    time: clock(row.t, withDate),
    values: usable.flatMap((s, i) => {
      const v = lookups[i]?.get(row.t);
      return v === undefined
        ? []
        : [
            {
              name: s.name,
              text: format(v),
              y: scale.y(v),
              colour: s.colour,
            },
          ];
    }),
  }));

  return (
    <section
      aria-labelledby={`${id}-t`}
      data-chart={id}
      className="border-line border-t pt-4"
    >
      <h2 id={`${id}-t`} className="text-heading-3 font-semibold">
        {title}
      </h2>
      <ul className="text-data mt-2 flex flex-wrap gap-x-6 gap-y-1">
        {series.map((s) => (
          <li key={s.name} className="flex items-center gap-2">
            <svg aria-hidden="true" viewBox="0 0 28 6" className="h-1.5 w-7">
              <line
                x1="0"
                x2="28"
                y1="3"
                y2="3"
                strokeWidth={2}
                strokeDasharray={s.style === "dashed" ? "6 4" : undefined}
                className={stroke[s.colour]}
              />
            </svg>
            {s.name}
          </li>
        ))}
      </ul>
      <ChartFrame
        label={`${title}, ${clock(tMin, withDate)} to ${clock(tMax, withDate)}`}
        width={CHART_BOX.width}
        height={CHART_BOX.height}
        top={CHART_BOX.top}
        bottom={CHART_BOX.bottom}
        markers={markers}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line
              x1={CHART_BOX.left}
              x2={CHART_BOX.width - CHART_BOX.right}
              y1={scale.y(v)}
              y2={scale.y(v)}
              className="stroke-line"
              strokeWidth={1}
            />
            <text
              x={CHART_BOX.left - 6}
              y={scale.y(v) + 4}
              textAnchor="end"
              className="fill-muted"
              fontSize={11}
            >
              {format(v)}
            </text>
          </g>
        ))}
        <text
          x={CHART_BOX.left}
          y={plotBottom + 18}
          className="fill-muted"
          fontSize={11}
        >
          {clock(tMin, withDate)}
        </text>
        <text
          x={CHART_BOX.width - CHART_BOX.right}
          y={plotBottom + 18}
          textAnchor="end"
          className="fill-muted"
          fontSize={11}
        >
          {clock(tMax, withDate)} (MYT)
        </text>
        {usable.map((s) => (
          <g key={s.name}>
            <path
              d={linePath(s.points, scale)}
              fill="none"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeDasharray={s.style === "dashed" ? "6 4" : undefined}
              className={stroke[s.colour]}
            />
          </g>
        ))}
      </ChartFrame>
      <details className="mt-2">
        <summary className="text-data hover:text-ink text-muted flex min-h-11 cursor-pointer items-center underline-offset-4 hover:underline">
          Show the values as a table
        </summary>
        <div className="overflow-x-auto">
          <table className="text-data w-full border-collapse text-left">
            <caption className="sr-only">{title}</caption>
            <thead>
              <tr className="border-line border-b">
                <th scope="col" className="text-muted py-2 pr-4 font-medium">
                  Time (MYT)
                </th>
                {series.map((s) => (
                  <th
                    key={s.name}
                    scope="col"
                    className="text-muted py-2 pr-4 font-medium"
                  >
                    {s.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.t} className="border-line border-b">
                  <th
                    scope="row"
                    className="py-2 pr-4 font-normal tabular-nums"
                  >
                    {clock(row.t, withDate)}
                  </th>
                  {series.map((s) => {
                    const near = s.points.find((p) => p.t === row.t);
                    return (
                      <td key={s.name} className="py-2 pr-4 tabular-nums">
                        {near ? format(near.v) : "No data"}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
