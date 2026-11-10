"use client";

import { useRef, useState } from "react";

export type Marker = {
  x: number;
  time: string;
  values: {
    name: string;
    text: string;
    y: number;
    colour: "accent" | "pink";
  }[];
};

const dot = { accent: "fill-accent-ink", pink: "fill-pink-ink" } as const;

/**
 * The interactive layer of a range chart (CMD-07). The server draws the lines;
 * this adds the tooltip: pointer movement and the Left, Right, Home and End
 * keys pick a time, and the readout above the chart gives the values at that
 * time. The readout is a polite live region, so a screen reader hears it. The
 * chart itself is one tab stop.
 */
export function ChartFrame({
  label,
  width,
  height,
  top,
  bottom,
  markers,
  children,
}: {
  label: string;
  width: number;
  height: number;
  top: number;
  bottom: number;
  markers: Marker[];
  children: React.ReactNode;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const active = index === null ? null : (markers[index] ?? null);

  const nearest = (clientX: number) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const x = ((clientX - rect.left) / rect.width) * width;
    let best = 0;
    let bestDist = Infinity;
    markers.forEach((m, i) => {
      const d = Math.abs(m.x - x);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    return best;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const last = markers.length - 1;
    const from = index ?? (e.key === "ArrowLeft" || e.key === "End" ? last : 0);
    let next: number | null = null;
    if (e.key === "ArrowRight")
      next = index === null ? 0 : Math.min(last, from + 1);
    else if (e.key === "ArrowLeft")
      next = index === null ? last : Math.max(0, from - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else if (e.key === "Escape") setIndex(null);
    if (next !== null) {
      e.preventDefault();
      setIndex(next);
    }
  };

  return (
    <>
      <p
        data-readout
        aria-live="polite"
        className="text-data mt-2 min-h-6 tabular-nums"
      >
        {active ? (
          <>
            <span className="text-muted">{active.time}</span>
            {active.values.map((v) => (
              <span key={v.name} className="ml-4">
                {v.name}: <span className="font-medium">{v.text}</span>
              </span>
            ))}
          </>
        ) : (
          <span className="text-muted">
            Point at the chart, or focus it and use the arrow keys, to read a
            value.
          </span>
        )}
      </p>
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        role="group"
        aria-roledescription="chart"
        aria-label={`${label}. Use the left and right arrow keys to read values.`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        onPointerMove={(e) => setIndex(nearest(e.clientX))}
        onPointerLeave={() => setIndex(null)}
        className="focus-visible:outline-accent-ink mt-1 h-auto w-full touch-pan-y focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {children}
        {active ? (
          <g aria-hidden="true">
            <line
              x1={active.x}
              x2={active.x}
              y1={top}
              y2={height - bottom}
              className="stroke-border-strong"
              strokeWidth={1}
            />
            {active.values.map((v) => (
              <circle
                key={v.name}
                cx={active.x}
                cy={v.y}
                r={4}
                className={dot[v.colour]}
              />
            ))}
          </g>
        ) : null}
      </svg>
    </>
  );
}
