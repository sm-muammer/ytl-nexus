"use client";

import Link from "next/link";
import { useId, useMemo, useRef, useState } from "react";
import { AtlasActions } from "@/components/atlas/atlas-actions";
import { HEALTH_STYLE, HealthBadge } from "@/components/command/health-badge";
import { HistoryStrip } from "@/components/status/status-parts";
import {
  NODE_H,
  NODE_W,
  buildGraph,
  edgePath,
  layoutGraph,
  moveFocus,
  reach,
  type Direction,
} from "@/lib/atlas/graph";
import { KIND_LABEL, type AtlasData, type AtlasNode } from "@/lib/atlas/types";
import type { Role } from "@/lib/roles";
import { badgeHealth, formatTime } from "@/lib/status/format";
import { UPTIME_WINDOWS, formatUptime } from "@/lib/status/health";
import { incidentTrackingPath } from "@/lib/status/tickets";
import { HEALTH_TEXT } from "@/lib/status/types";

// Nexus Atlas (ATL-01 to ATL-06). The map is drawn as SVG from the graph model
// and needs no graph library, so the page is usable as soon as it renders. Every
// node is a link: Tab reaches each one, arrow keys move between neighbours, and
// Enter selects. The list view shows the same services and dependencies as a
// table. One panel joins everything known about the selected service.

const ARROWS: Record<string, Direction> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
};

export function AtlasView({
  data,
  initial,
  role,
  demo,
}: {
  data: AtlasData;
  initial: string | null;
  role: Role | null;
  demo: boolean;
}) {
  const nodes = useMemo(
    () => new Map(data.nodes.map((n) => [n.slug, n])),
    [data.nodes],
  );
  const graph = useMemo(
    () =>
      buildGraph(
        data.nodes.map((n) => n.slug),
        data.edges,
      ),
    [data],
  );
  const layout = useMemo(() => layoutGraph(graph), [graph]);
  const [view, setView] = useState<"map" | "list">("map");
  const [selected, setSelected] = useState<string | null>(
    initial && nodes.has(initial) ? initial : null,
  );
  const [announce, setAnnounce] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const markerId = useId();

  const current = selected ? (nodes.get(selected) ?? null) : null;
  const affected = useMemo(
    () => new Set(selected ? reach(graph, selected, "downstream") : []),
    [graph, selected],
  );
  const needs = useMemo(
    () => new Set(selected ? reach(graph, selected, "upstream") : []),
    [graph, selected],
  );

  function select(slug: string) {
    setSelected(slug);
    const node = nodes.get(slug);
    setAnnounce(
      node ? `Selected ${node.name}. Details are shown in the panel.` : "",
    );
    const url = new URL(window.location.href);
    url.searchParams.set("service", slug);
    window.history.replaceState(null, "", url);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const direction = ARROWS[event.key];
    const slug = (event.target as Element)
      .closest("[data-node]")
      ?.getAttribute("data-node");
    if (!direction || !slug) return;
    event.preventDefault();
    const next = moveFocus(graph, layout, slug, direction);
    mapRef.current
      ?.querySelector<SVGAElement>(`[data-node="${CSS.escape(next)}"]`)
      ?.focus();
  }

  return (
    <div className="px-(--spacing-gutter) py-8" data-atlas>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div role="group" aria-label="View" className="flex gap-2">
          {(["map", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`min-h-11 rounded-full border px-5 text-sm font-semibold ${
                view === v
                  ? "border-accent-ink text-accent-ink"
                  : "border-border-strong hover:bg-surface-raised"
              }`}
            >
              {v === "map" ? "Map" : "List"}
            </button>
          ))}
        </div>
      </div>

      <p className="text-muted text-data mt-3 max-w-(--spacing-prose)">
        A line runs from a service to something it needs. If that service stops,
        everything on the left that leads to it is affected. Use Tab or the
        arrow keys to move between services and Enter to open one.
      </p>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          {view === "map" ? (
            <div
              ref={mapRef}
              onKeyDown={onKeyDown}
              role="region"
              aria-label="Service dependency map"
              tabIndex={-1}
              className="border-line overflow-x-auto rounded-md border"
              data-atlas-map
            >
              <svg
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                className="text-border-strong block h-auto w-full min-w-[720px]"
                role="group"
                aria-label="Services and what each one needs"
              >
                <defs>
                  <marker
                    id={markerId}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="7"
                    markerHeight="7"
                    orient="auto"
                  >
                    <path d="M0 0 10 5 0 10z" fill="context-stroke" />
                  </marker>
                </defs>
                {graph.edges.map((e) => {
                  const d = edgePath(layout, e);
                  if (!d) return null;
                  const on = e.from === selected || e.to === selected;
                  return (
                    <path
                      key={`${e.from}>${e.to}`}
                      d={d}
                      data-edge={`${e.from}>${e.to}`}
                      data-active={on ? "true" : undefined}
                      fill="none"
                      strokeWidth={on ? 2.5 : 1.25}
                      className={
                        on ? "stroke-accent-ink" : "stroke-border-strong"
                      }
                      opacity={selected && !on ? 0.35 : 1}
                      markerEnd={`url(#${markerId})`}
                    />
                  );
                })}
                {layout.nodes.map((p) => {
                  const n = nodes.get(p.slug);
                  if (!n) return null;
                  return (
                    <MapNode
                      key={p.slug}
                      node={n}
                      x={p.x}
                      y={p.y}
                      selected={p.slug === selected}
                      affected={affected.has(p.slug)}
                      needed={needs.has(p.slug)}
                      onSelect={select}
                    />
                  );
                })}
              </svg>
            </div>
          ) : (
            <ListView
              nodes={data.nodes}
              graph={graph}
              names={nodes}
              selected={selected}
              onSelect={select}
            />
          )}
          {view === "map" ? (
            <p className="text-muted text-data mt-3">
              Dashed outline: affected if the selected service fails. Thick
              line: a direct dependency of the selected service.
            </p>
          ) : null}
        </div>

        <section
          aria-labelledby="atlas-panel-title"
          data-atlas-panel
          className="min-w-0"
        >
          {current ? (
            <Panel
              node={current}
              names={nodes}
              upstream={graph.upstream[current.slug]!}
              downstream={graph.downstream[current.slug]!}
              affected={[...affected]}
              role={role}
              demo={demo}
              onSelect={select}
            />
          ) : (
            <>
              <h2
                id="atlas-panel-title"
                className="text-heading-3 font-semibold"
              >
                Service details
              </h2>
              <p className="text-muted mt-2 max-w-(--spacing-prose)">
                Select a service on the map or in the list to see its health,
                dependencies, runbook, incidents, permitted actions and audit
                history.
              </p>
            </>
          )}
        </section>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}

function MapNode({
  node,
  x,
  y,
  selected,
  affected,
  needed,
  onSelect,
}: {
  node: AtlasNode;
  x: number;
  y: number;
  selected: boolean;
  affected: boolean;
  needed: boolean;
  onSelect: (slug: string) => void;
}) {
  const style = HEALTH_STYLE[badgeHealth(node.health)];
  return (
    <a
      href={`?service=${node.slug}`}
      data-node={node.slug}
      data-health={node.health}
      data-selected={selected ? "true" : undefined}
      data-affected={affected ? "true" : undefined}
      aria-current={selected ? "true" : undefined}
      onClick={(e) => {
        e.preventDefault();
        onSelect(node.slug);
      }}
      className="cursor-pointer"
    >
      <rect
        x={x}
        y={y}
        width={NODE_W}
        height={NODE_H}
        rx={8}
        className={`fill-surface ${selected ? "stroke-accent-ink" : "stroke-border-strong"}`}
        strokeWidth={selected ? 3 : needed ? 2 : 1.25}
        strokeDasharray={affected ? "5 4" : undefined}
      />
      <g
        transform={`translate(${x + 12} ${y + 10})`}
        className={`${style.colour} fill-none stroke-current`}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {style.icon}
      </g>
      <text
        x={x + 36}
        y={y + 22}
        className="fill-ink text-[13px] font-semibold"
      >
        {node.name}
      </text>
      <text x={x + 12} y={y + 43} className="fill-muted text-[12px]">
        {HEALTH_TEXT[node.health]} · {KIND_LABEL[node.kind]}
      </text>
    </a>
  );
}

function ListView({
  nodes,
  graph,
  names,
  selected,
  onSelect,
}: {
  nodes: readonly AtlasNode[];
  graph: ReturnType<typeof buildGraph>;
  names: Map<string, AtlasNode>;
  selected: string | null;
  onSelect: (slug: string) => void;
}) {
  const label = (slugs: string[]) =>
    slugs.length === 0
      ? "None"
      : slugs.map((s) => names.get(s)?.name ?? s).join(", ");
  return (
    <div
      className="overflow-x-auto"
      role="region"
      aria-label="Service list"
      tabIndex={0}
      data-atlas-list
    >
      <table className="text-data w-full border-collapse text-left">
        <caption className="sr-only">
          Services, their state and what each one needs
        </caption>
        <thead>
          <tr className="border-line border-b">
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              Service
            </th>
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              State
            </th>
            <th scope="col" className="text-muted py-2 pr-4 font-medium">
              Needs
            </th>
            <th scope="col" className="text-muted py-2 font-medium">
              Needed by
            </th>
          </tr>
        </thead>
        <tbody>
          {nodes.map((n) => (
            <tr
              key={n.slug}
              data-service={n.slug}
              className={`border-line border-b ${selected === n.slug ? "bg-surface" : ""}`}
            >
              <th scope="row" className="py-3 pr-4 font-medium">
                <button
                  type="button"
                  onClick={() => onSelect(n.slug)}
                  aria-current={selected === n.slug ? "true" : undefined}
                  className="min-h-11 text-left underline underline-offset-4"
                >
                  {n.name}
                </button>
              </th>
              <td className="py-3 pr-4">
                <HealthBadge
                  health={badgeHealth(n.health)}
                  label={HEALTH_TEXT[n.health]}
                />
              </td>
              <td className="py-3 pr-4">{label(graph.upstream[n.slug]!)}</td>
              <td className="py-3">{label(graph.downstream[n.slug]!)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const AUDIT_TEXT: Record<string, string> = {
  "ops.health": "Health check",
  "ops.logs": "Log read",
  "ops.restart": "Restart",
};

function ServiceLinks({
  slugs,
  names,
  onSelect,
}: {
  slugs: readonly string[];
  names: Map<string, AtlasNode>;
  onSelect: (slug: string) => void;
}) {
  if (slugs.length === 0) return <span className="text-muted">None</span>;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {slugs.map((s) => (
        <li key={s}>
          <button
            type="button"
            onClick={() => onSelect(s)}
            className="min-h-11 underline underline-offset-4"
          >
            {names.get(s)?.name ?? s}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Panel({
  node,
  names,
  upstream,
  downstream,
  affected,
  role,
  demo,
  onSelect,
}: {
  node: AtlasNode;
  names: Map<string, AtlasNode>;
  upstream: readonly string[];
  downstream: readonly string[];
  affected: readonly string[];
  role: Role | null;
  demo: boolean;
  onSelect: (slug: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6" data-panel-service={node.slug}>
      <div>
        <h2 id="atlas-panel-title" className="text-heading-3 font-semibold">
          {node.name}
        </h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-4">
          <HealthBadge
            health={badgeHealth(node.health)}
            label={HEALTH_TEXT[node.health]}
          />
          <span className="text-muted text-data">{KIND_LABEL[node.kind]}</span>
        </p>
        {node.detail ? (
          <p className="text-muted text-data mt-1">{node.detail}</p>
        ) : null}
      </div>

      <section aria-labelledby="atlas-metrics" data-panel-metrics>
        <h3 id="atlas-metrics" className="font-semibold">
          Recent metrics
        </h3>
        <dl className="text-data mt-2 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
          <dt className="text-muted">Last check</dt>
          <dd>
            {node.lastCheckedAt === null
              ? "Never"
              : `${formatTime(node.lastCheckedAt)}${node.latencyMs === null ? "" : `, ${node.latencyMs} ms`}`}
          </dd>
          {UPTIME_WINDOWS.map((w) => (
            <div key={w.id} className="contents">
              <dt className="text-muted">Uptime {w.id}</dt>
              <dd className="tabular-nums">
                {formatUptime(node.uptime[w.id])}
              </dd>
            </div>
          ))}
          <dt className="text-muted">Last 24 hours</dt>
          <dd>
            <HistoryStrip buckets={node.history} />
          </dd>
        </dl>
      </section>

      <section aria-labelledby="atlas-deps" data-panel-deps>
        <h3 id="atlas-deps" className="font-semibold">
          Dependencies
        </h3>
        <dl className="text-data mt-2 flex flex-col gap-2">
          <div>
            <dt className="text-muted">Needs</dt>
            <dd>
              <ServiceLinks
                slugs={upstream}
                names={names}
                onSelect={onSelect}
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Needed by</dt>
            <dd>
              <ServiceLinks
                slugs={downstream}
                names={names}
                onSelect={onSelect}
              />
            </dd>
          </div>
          <div>
            <dt className="text-muted">Affected if it fails</dt>
            <dd data-affected-list>
              {affected.length === 0
                ? "Nothing else"
                : affected.map((s) => names.get(s)?.name ?? s).join(", ")}
            </dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="atlas-runbook" data-panel-runbook>
        <h3 id="atlas-runbook" className="font-semibold">
          Runbook
        </h3>
        <p className="text-data mt-2">
          {node.runbook ? (
            <Link
              href={`/library/${node.runbook.slug}`}
              className="underline underline-offset-4"
            >
              {node.runbook.title}
            </Link>
          ) : (
            <span className="text-muted">
              No runbook is linked to this service in Nexus Library.
            </span>
          )}
        </p>
      </section>

      <section aria-labelledby="atlas-incidents" data-panel-incidents>
        <h3 id="atlas-incidents" className="font-semibold">
          Recent incidents
        </h3>
        {node.incidents.length === 0 ? (
          <p className="text-muted text-data mt-2">
            No incidents in the last 30 days.
          </p>
        ) : (
          <ul className="text-data mt-2 flex flex-col gap-2">
            {node.incidents.map((i) => (
              <li key={i.id}>
                <Link
                  href={incidentTrackingPath(i.ticketNo)}
                  className="underline underline-offset-4"
                >
                  <span className="font-mono">{i.ticketNo}</span> · {i.title}
                </Link>
                <span className="text-muted">
                  {" "}
                  · {i.state === "resolved"
                    ? "Resolved"
                    : "Not resolved"} · {formatTime(i.openedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="atlas-actions" data-panel-actions>
        <h3 id="atlas-actions" className="font-semibold">
          Actions
        </h3>
        <div className="mt-2">
          <AtlasActions
            key={node.slug}
            slug={node.slug}
            role={role}
            demo={demo}
          />
        </div>
      </section>

      <section aria-labelledby="atlas-audit" data-panel-audit>
        <h3 id="atlas-audit" className="font-semibold">
          Audit history
        </h3>
        {node.audit.length === 0 ? (
          <p className="text-muted text-data mt-2">
            No operator actions recorded for this service.
          </p>
        ) : (
          <ul className="text-data mt-2 flex flex-col gap-1">
            {node.audit.map((a) => (
              <li key={`${a.ts}-${a.action}`}>
                {AUDIT_TEXT[a.action] ?? a.action}: {a.result}
                <span className="text-muted">
                  {" "}
                  · {formatTime(a.ts)}
                  {a.role ? ` · ${a.role}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
