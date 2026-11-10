"use client";

import { useEffect, useRef } from "react";
import { usePageVisible } from "@/components/motion/use-page-visible";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { useQualityTier } from "@/components/motion/use-quality-tier";
import {
  BEHAVIOUR,
  ClusterField,
  type ClusterInput,
} from "@/lib/monitoring/cluster-field";
import { MAX_DPR, type QualityTier } from "@/lib/motion/quality";
import type { Health } from "@/lib/monitoring/snapshot";

// The Nexus Command particle field (CMD-05). One cluster per tracked service;
// colour and motion come from its health. The canvas is decorative and hidden
// from assistive technology: the service table beside it says the same things
// in text. Pointer: particles near the cursor move gently away.
//
// Data attributes for tests:
//   data-state     running | paused (tab hidden) | static (reduced motion)
//   data-tier      high | medium | low
//   data-particles particles drawn
//   data-frames    frames painted so far
//   data-frame-ms  average milliseconds per frame over the last 60 frames

const PER_CLUSTER: Record<QualityTier, number> = {
  high: 36,
  medium: 20,
  low: 10,
};

type Colours = Record<Health, string> & { label: string };

function readColours(el: HTMLElement): Colours {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name).trim();
  return {
    ok: token("--nx-ok-ink"),
    warn: token("--nx-warn-ink"),
    bad: token("--nx-bad-ink"),
    idle: token("--nx-muted"),
    stale: token("--nx-muted"),
    label: token("--nx-ink"),
  };
}

export function ParticleField({
  clusters,
  height = 360,
}: {
  clusters: readonly ClusterInput[];
  height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fieldRef = useRef<ClusterField | null>(null);
  const clustersRef = useRef(clusters);
  const { tier, reportFrame } = useQualityTier();
  const visible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  // The static frame has no loop to pick up a health change, so it is redrawn.
  const staticKey = reduced ? clusters.map((c) => c.health).join() : "";

  // Health changes reach the running field without rebuilding it.
  useEffect(() => {
    clustersRef.current = clusters;
    fieldRef.current?.setClusters(clusters);
  }, [clusters]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const colours = readColours(canvas);
    const field = new ClusterField(PER_CLUSTER[tier]);
    fieldRef.current = field;
    field.setClusters(clustersRef.current);
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      tier === "low" ? 1 : MAX_DPR,
    );

    const draw = () => {
      const w = canvas.width / dpr;
      const h = canvas.height / dpr;
      ctx.clearRect(0, 0, w, h);
      for (const p of field.particles) {
        const c = field.clusters[p.cluster];
        if (!c) continue;
        const b = BEHAVIOUR[c.health];
        ctx.globalAlpha = b.alpha;
        ctx.strokeStyle = ctx.fillStyle = colours[c.health];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        if (b.hollow) {
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = colours.label;
      ctx.font = "500 13px var(--font-geist-sans, system-ui), sans-serif";
      ctx.textAlign = "center";
      for (const c of field.clusters) {
        ctx.fillText(c.name, c.centre.x, c.centre.y + c.radius + 22);
      }
    };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      field.resize(rect.width, rect.height);
      draw();
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);

    canvas.dataset.tier = tier;
    canvas.dataset.particles = String(field.particleCount);

    const reduceNow = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || reduceNow) {
      canvas.dataset.state = "static";
      canvas.dataset.frames = "1";
      return () => {
        observer.disconnect();
        fieldRef.current = null;
      };
    }
    if (!visible) {
      canvas.dataset.state = "paused";
      return () => {
        observer.disconnect();
        fieldRef.current = null;
      };
    }

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      field.setPointer({ x: e.clientX - r.left, y: e.clientY - r.top });
    };
    const onLeave = () => field.setPointer(null);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);

    canvas.dataset.state = "running";
    let frames = 0;
    let raf = 0;
    let last = 0;
    const recent: number[] = [];
    const tick = (now: number) => {
      const delta = last === 0 ? 0 : now - last;
      last = now;
      if (delta > 0) {
        reportFrame(delta);
        recent.push(delta);
        if (recent.length > 60) recent.shift();
      }
      field.step(Math.min(delta, 50) / 1000);
      draw();
      frames += 1;
      canvas.dataset.frames = String(frames);
      if (frames % 30 === 0 && recent.length > 0) {
        canvas.dataset.frameMs = (
          recent.reduce((a, b) => a + b, 0) / recent.length
        ).toFixed(1);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      observer.disconnect();
      fieldRef.current = null;
    };
  }, [tier, visible, reduced, reportFrame, staticKey]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-particle-field
      style={{ height }}
      className="w-full touch-pan-y"
    />
  );
}
