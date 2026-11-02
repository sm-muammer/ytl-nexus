"use client";

import { useEffect, useRef } from "react";
import { MAX_DPR, PARTICLE_COUNT } from "@/lib/motion/quality";
import { usePageVisible } from "./use-page-visible";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";
import { useQualityTier } from "./use-quality-tier";

// A quiet drifting-particle backdrop for public pages (design language,
// section 4). It is decorative, hidden from assistive technology, and never
// appears on forms, tables, Nexus Control or the mail inbox. Nexus Command
// builds its own data-driven field in Task 8.
//
// Behaviour, exposed through data attributes for tests:
//   data-state   running | paused (tab hidden) | static (reduced motion)
//   data-tier    high | medium | low
//   data-frames  frames painted so far; static draws one frame

type Particle = {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  colour: 0 | 1 | 2;
  alpha: number;
};

/** Small deterministic generator so the static frame is always the same. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeParticles(count: number): Particle[] {
  const rand = mulberry32(0x4e455855);
  return Array.from({ length: count }, () => {
    const pick = rand();
    return {
      x: rand(),
      y: rand(),
      radius: 0.6 + rand() * 1.8,
      vx: (rand() - 0.5) * 0.012,
      vy: -0.004 - rand() * 0.012,
      colour: pick < 0.4 ? 0 : pick < 0.7 ? 1 : 2,
      alpha: 0.25 + rand() * 0.45,
    };
  });
}

const wrap = (v: number) => (v < 0 ? v + 1 : v > 1 ? v - 1 : v);

export function AmbientField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const framesRef = useRef(0);
  const { tier, reportFrame } = useQualityTier();
  const visible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  const count = PARTICLE_COUNT[tier];

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Colours come from the design tokens in globals.css, never from literals.
    const style = getComputedStyle(canvas);
    const palette = [
      style.getPropertyValue("--color-ytl-blue").trim(),
      style.getPropertyValue("--color-yes-pink").trim(),
      style.color,
    ];
    const particles = makeParticles(count);
    const dpr = Math.min(
      window.devicePixelRatio || 1,
      tier === "low" ? 1 : MAX_DPR,
    );
    let width = 0;
    let height = 0;

    const paint = () => {
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = palette[p.colour] ?? style.color;
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paint();
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
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
      const seconds = Math.min(delta, 50) / 1000;
      for (const p of particles) {
        p.x = wrap(p.x + p.vx * seconds);
        p.y = wrap(p.y + p.vy * seconds);
      }
      paint();
      framesRef.current += 1;
      canvas.dataset.frames = String(framesRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [count, tier, visible, reduced, reportFrame]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-ambient-field
      className={`pointer-events-none size-full ${className ?? ""}`}
    />
  );
}
