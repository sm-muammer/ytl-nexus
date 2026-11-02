"use client";

import { useEffect, useRef } from "react";
import { MAX_DPR, PARTICLE_COUNT } from "@/lib/motion/quality";
import type { CanvasKind } from "@/lib/navigation/scenes";
import { createScene, type Palette } from "./scene-engine";
import { usePageVisible } from "./use-page-visible";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useQualityTier } from "./use-quality-tier";

// Full-viewport particle backdrop for public pages. Decorative, hidden from
// assistive technology, and never used on forms, tables, Nexus Control or the
// mail inbox (lib/navigation/scenes.ts keeps those pages canvas-free). Each
// public page picks its own scene; see components/motion/scene-engine.ts.
//
// Behaviour, exposed through data attributes for tests:
//   data-state      running | paused (tab hidden) | static (reduced motion)
//   data-tier       high | medium | low
//   data-particles  particles in the scene
//   data-frames     frames painted so far; static draws one frame
//   data-scene      which scene is drawn

const REFERENCE_AREA = 1440 * 900;

export function AmbientField({
  kind,
  className,
}: {
  kind: CanvasKind;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef(0);
  const { tier, reportFrame } = useQualityTier();
  const visible = usePageVisible();
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Colours come from the design tokens in globals.css, never from literals.
    const style = getComputedStyle(canvas);
    const token = (name: string) => style.getPropertyValue(name).trim();
    const palette: Palette = {
      blue: token("--color-ytl-blue"),
      pink: token("--color-yes-pink"),
      indigo: token("--color-yes-gradient-end"),
      violet: token("--nx-violet-ink"),
      ink: style.color,
    };

    // Bigger screens get proportionally more particles, within limits.
    const areaFactor = Math.min(
      2.2,
      Math.max(0.6, (window.innerWidth * window.innerHeight) / REFERENCE_AREA),
    );
    const count = Math.round(PARTICLE_COUNT[tier] * areaFactor);
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      tier === "low" ? 1 : MAX_DPR,
    );
    const scene = createScene(kind, ctx, palette, count, 0x4e455855);

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      scene.resize(rect.width, rect.height);
      scene.draw();
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    canvas.dataset.scene = kind;
    canvas.dataset.tier = tier;
    canvas.dataset.particles = String(count);

    // Read the preference directly as well: the first effect runs before the
    // hook has caught up with the client value, and no frame may play.
    const reduceNow = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || reduceNow) {
      canvas.dataset.state = "static";
      canvas.dataset.frames = "1";
      return () => observer.disconnect();
    }
    if (!visible) {
      canvas.dataset.state = "paused";
      return () => observer.disconnect();
    }

    canvas.dataset.state = "running";
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const delta = last === 0 ? 0 : now - last;
      last = now;
      if (delta > 0) reportFrame(delta);
      scene.step(Math.min(delta, 50) / 1000);
      scene.draw();
      framesRef.current += 1;
      canvas.dataset.frames = String(framesRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [kind, tier, visible, reduced, reportFrame]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-ambient-field
      className={`pointer-events-none size-full ${className ?? ""}`}
    />
  );
}
