"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  NormalBlending,
  PerspectiveCamera,
  Plane,
  Points,
  Raycaster,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { Logo } from "@/components/brand/logo";
import { useAtmosphereMode } from "@/components/layout/atmosphere-switcher";
import { usePageVisible } from "@/components/motion/use-page-visible";
import { usePrefersReducedMotion } from "@/components/motion/use-prefers-reduced-motion";
import { useQualityTier } from "@/components/motion/use-quality-tier";
import { atmosphereAttributes } from "@/lib/design/atmosphere";
import type { QualityTier } from "@/lib/motion/quality";
import { rasterizeSvgToPixels } from "@/lib/motion/particle-logo/rasterize";
import {
  sampleAmbientDust,
  sampleParticlesFromPixels,
  type PixelBuffer,
} from "@/lib/motion/particle-logo/sampling";
import {
  IDLE_SPIN_RAD_PER_SEC,
  IDLE_WOBBLE_AMPLITUDE,
  IDLE_WOBBLE_PERIOD_SEC,
  POINTER_REPULSE_RADIUS,
  POINTER_TILT_MAX,
  blendIntroAndScrollMorph,
  idleResumeWeight,
  introElapsedSec,
  scrollState,
} from "@/lib/motion/particle-logo/scroll";
import {
  DUST_FRAGMENT_SHADER,
  DUST_VERTEX_SHADER,
  PARTICLE_FRAGMENT_SHADER,
  PARTICLE_VERTEX_SHADER,
} from "@/lib/motion/particle-logo/shaders";
import {
  ambientDustCountForTier,
  clampParticleDpr,
  particleCountForTier,
} from "@/lib/motion/particle-logo/tiers";

const LOGO_SRC = "/brand/yes-logomark-gradient.svg";
const CAMERA_FOV_DEG = 42;
const TAN_HALF_FOV = Math.tan(((CAMERA_FOV_DEG / 2) * Math.PI) / 180);

const TIER_INTENSITY: Record<QualityTier, number> = {
  high: 0.95,
  medium: 0.98,
  low: 1.0,
};

const TIER_SIZE_SCALE: Record<QualityTier, number> = {
  high: 1.0,
  medium: 1.12,
  low: 1.28,
};

function buildGeometry(pixels: PixelBuffer, count: number): BufferGeometry {
  const sampled = sampleParticlesFromPixels(pixels, count);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(sampled.positions, 3));
  geometry.setAttribute("aNormal", new BufferAttribute(sampled.normals, 3));
  geometry.setAttribute("aColor", new BufferAttribute(sampled.colors, 3));
  geometry.setAttribute("aScatter", new BufferAttribute(sampled.scatter, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(sampled.seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function buildDustGeometry(count: number): BufferGeometry {
  const dust = sampleAmbientDust(count);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(dust.positions, 3));
  geometry.setAttribute("aColor", new BufferAttribute(dust.colors, 3));
  geometry.setAttribute("aColorDark", new BufferAttribute(dust.colorsDark, 3));
  geometry.setAttribute("aSeed", new BufferAttribute(dust.seeds, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

type StageMetrics = {
  vw: number;
  vh: number;
  heroCenterX: number;
  heroCenterY: number;
  baseCameraZ: number;
  basePointSize: number;
};

function measureStage(
  vw: number,
  vh: number,
  stageEl: Element | null,
): StageMetrics {
  const rect = stageEl?.getBoundingClientRect();
  const scrollY = window.scrollY || 0;
  const desktop = vw >= 1024;
  const stageW = rect
    ? Math.max(120, rect.width)
    : desktop
      ? vw * 0.45
      : vw * 0.85;
  const stageH = rect
    ? Math.max(120, rect.height)
    : desktop
      ? vh * 0.62
      : vh * 0.36;
  const heroCenterX = rect
    ? rect.left + rect.width / 2
    : desktop
      ? vw * 0.74
      : vw * 0.5;
  const heroCenterY = rect
    ? rect.top + scrollY + rect.height / 2
    : desktop
      ? vh * 0.48
      : vh * 0.3;

  const stageScale = desktop ? 0.72 : 0.78;
  const maxTargetPx = desktop ? 400 : 300;
  const targetPx = Math.max(
    170,
    Math.min(stageW * stageScale, stageH * stageScale, maxTargetPx),
  );
  const baseCameraZ = Math.max(
    3.3,
    (2.28 * vh) / (2 * TAN_HALF_FOV * targetPx),
  );
  const basePointSize = (desktop ? 2.75 : 3.2) * (baseCameraZ / 4.4);

  return {
    vw,
    vh,
    heroCenterX,
    heroCenterY,
    baseCameraZ,
    basePointSize,
  };
}

/**
 * Full-viewport WebGL 3D particle rendering of the Yes gradient logomark
 * (docs/spec/24-home-showcase.md). Falls back to the static <Logo> when
 * WebGL is unavailable or its context is lost.
 */
export function ParticleLogo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { mode } = useAtmosphereMode();
  const [domTheme, setDomTheme] = useState<string | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    const update = () => setDomTheme(root.dataset.theme || null);
    update();
    const observer = new MutationObserver(() => update());
    observer.observe(root, {
      attributes: true,
      attributeFilter: ["data-theme", "data-atmosphere"],
    });
    return () => observer.disconnect();
  }, []);

  const isDark = domTheme
    ? domTheme === "dark"
    : atmosphereAttributes(mode).theme === "dark";
  const darkTarget = isDark ? 1 : 0;
  const darkTargetRef = useRef<number>(darkTarget);
  const { tier, reportFrame } = useQualityTier();
  const visible = usePageVisible();
  const reduced = usePrefersReducedMotion();
  const [fallback, setFallback] = useState(false);

  useEffect(() => {
    darkTargetRef.current = darkTarget;
  }, [darkTarget]);

  // Refs shared cleanly across lifecycle, visibility, and tier-change effects.
  const tierRef = useRef<QualityTier>(tier);
  const visibleRef = useRef<boolean>(visible);
  const reducedRef = useRef<boolean>(reduced);
  const reportFrameRef = useRef(reportFrame);

  useEffect(() => {
    tierRef.current = tier;
  }, [tier]);

  useEffect(() => {
    visibleRef.current = visible;
  }, [visible]);

  useEffect(() => {
    reducedRef.current = reduced;
  }, [reduced]);

  useEffect(() => {
    reportFrameRef.current = reportFrame;
  }, [reportFrame]);

  const pixelsRef = useRef<PixelBuffer | null>(null);
  const rendererRef = useRef<WebGLRenderer | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const groupRef = useRef<Group | null>(null);
  const pointsRef = useRef<Points<BufferGeometry, ShaderMaterial> | null>(null);
  const materialRef = useRef<ShaderMaterial | null>(null);
  const dustPointsRef = useRef<Points<BufferGeometry, ShaderMaterial> | null>(
    null,
  );
  const dustMaterialRef = useRef<ShaderMaterial | null>(null);
  const stageRef = useRef<StageMetrics>({
    vw: 1440,
    vh: 900,
    heroCenterX: 1065,
    heroCenterY: 432,
    baseCameraZ: 5.5,
    basePointSize: 2.75,
  });
  const rafRef = useRef<number>(0);
  const framesRef = useRef<number>(0);
  const readyRef = useRef<boolean>(false);

  const renderStaticFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const renderer = rendererRef.current;
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const group = groupRef.current;
    const material = materialRef.current;
    const dustMaterial = dustMaterialRef.current;
    const dustPoints = dustPointsRef.current;
    if (
      !canvas ||
      !renderer ||
      !scene ||
      !camera ||
      !group ||
      !material ||
      !readyRef.current
    ) {
      return;
    }

    const m = stageRef.current;
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    camera.position.set(0, 0, m.baseCameraZ);
    camera.setViewOffset(
      m.vw,
      m.vh,
      m.vw / 2 - m.heroCenterX,
      m.vh / 2 - m.heroCenterY,
      m.vw,
      m.vh,
    );
    material.uniforms.uMorph!.value = 0;
    material.uniforms.uTime!.value = 0;
    material.uniforms.uOpacity!.value = 1;
    material.uniforms.uPointerStrength!.value = 0;
    if (dustPoints) {
      dustPoints.position.set(0, 0, 0);
    }
    if (dustMaterial) {
      dustMaterial.uniforms.uTime!.value = 0;
      dustMaterial.uniforms.uScrollMorph!.value = 0;
      dustMaterial.uniforms.uDark!.value = darkTargetRef.current;
      (dustMaterial.uniforms.uPointer!.value as Vector3).set(0, 0, 0);
    }
    renderer.render(scene, camera);
    framesRef.current = 1;
    canvas.dataset.state = "static";
    canvas.dataset.frames = "1";
    canvas.style.pointerEvents = "none";
  }, []);

  // Main WebGL setup and cleanup (runs once per fallback state).
  useEffect(() => {
    if (fallback) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: "high-performance",
      });
    } catch {
      queueMicrotask(() => setFallback(true));
      return;
    }
    rendererRef.current = renderer;

    const dpr = clampParticleDpr(window.devicePixelRatio || 1);
    renderer.setPixelRatio(dpr);

    const scene = new Scene();
    sceneRef.current = scene;

    const camera = new PerspectiveCamera(
      CAMERA_FOV_DEG,
      Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
      0.1,
      50,
    );
    cameraRef.current = camera;

    const group = new Group();
    scene.add(group);
    groupRef.current = group;

    const currentTier = tierRef.current;
    const material = new ShaderMaterial({
      vertexShader: PARTICLE_VERTEX_SHADER,
      fragmentShader: PARTICLE_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: NormalBlending,
      uniforms: {
        uTime: { value: 0 },
        uMorph: { value: 1 },
        uOpacity: { value: 1 },
        uPixelRatio: { value: dpr },
        uBaseSize: { value: 2.75 * TIER_SIZE_SCALE[currentTier] },
        uIntensity: { value: TIER_INTENSITY[currentTier] },
        uPointer: { value: new Vector3(0, 0, 0) },
        uPointerStrength: { value: 0 },
        uRadius: { value: POINTER_REPULSE_RADIUS },
      },
    });
    materialRef.current = material;

    const dustMaterial = new ShaderMaterial({
      vertexShader: DUST_VERTEX_SHADER,
      fragmentShader: DUST_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: dpr },
        uPointer: { value: new Vector3(0, 0, 0) },
        uScrollMorph: { value: 0 },
        uDark: { value: darkTargetRef.current },
      },
    });
    dustMaterialRef.current = dustMaterial;

    const dustPoints = new Points(
      buildDustGeometry(ambientDustCountForTier(currentTier)),
      dustMaterial,
    );
    dustPoints.frustumCulled = false;
    scene.add(dustPoints);
    dustPointsRef.current = dustPoints;

    const resize = () => {
      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      const nextDpr = clampParticleDpr(window.devicePixelRatio || 1);
      renderer.setPixelRatio(nextDpr);
      renderer.setSize(vw, vh, false);
      camera.aspect = vw / vh;
      camera.updateProjectionMatrix();

      const stageEl = document.querySelector("[data-particle-stage]");
      const metrics = measureStage(vw, vh, stageEl);
      stageRef.current = metrics;
      camera.setViewOffset(
        metrics.vw,
        metrics.vh,
        metrics.vw / 2 - metrics.heroCenterX,
        metrics.vh / 2 - metrics.heroCenterY,
        metrics.vw,
        metrics.vh,
      );
      material.uniforms.uPixelRatio!.value = nextDpr;
      material.uniforms.uBaseSize!.value =
        metrics.basePointSize * TIER_SIZE_SCALE[tierRef.current];
      material.uniforms.uIntensity!.value = TIER_INTENSITY[tierRef.current];
      dustMaterial.uniforms.uPixelRatio!.value = nextDpr;
      dustPoints.position.set(0, 0, 0);

      if (reducedRef.current) {
        renderStaticFrame();
      }
    };

    const stageObserver = new ResizeObserver(resize);
    const stageEl = document.querySelector("[data-particle-stage]");
    if (stageEl) stageObserver.observe(stageEl);
    window.addEventListener("resize", resize, { passive: true });
    resize();

    const onContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      setFallback(true);
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    // Simulation state
    let elapsed = 0;
    let introStartMs: number | null = null;
    let pausedAtMs: number | null = null;
    let idleTimer = 0;
    let spinY = 0;
    let spinVelocityY = 0;
    let tiltX = 0;
    let tiltY = 0;
    let targetTiltX = 0;
    let targetTiltY = 0;
    let pointerActive = false;
    let pointerStrength = 0;
    let targetPointerStrength = 0;
    let isDragging = false;
    let activePointerId: number | null = null;
    let lastDragX = 0;
    let lastFrameMs = 0;
    let currentDark = darkTargetRef.current;

    const pointerNdc = new Vector2(0, 0);
    const raycaster = new Raycaster();
    const planeNormal = new Vector3(0, 0, 1);
    const plane = new Plane(planeNormal, 0);
    const worldHit = new Vector3();
    const localHit = new Vector3();

    const isReduceNow = () =>
      reducedRef.current ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onPointerMove = (e: PointerEvent) => {
      if (isReduceNow()) return;
      const scroll = scrollState(window.scrollY, window.innerHeight);
      if (!scroll.inHero && !isDragging) return;

      const vw = Math.max(1, window.innerWidth);
      const vh = Math.max(1, window.innerHeight);
      pointerNdc.set((e.clientX / vw) * 2 - 1, -(e.clientY / vh) * 2 + 1);
      pointerActive = true;
      targetTiltY = pointerNdc.x * POINTER_TILT_MAX;
      targetTiltX = -pointerNdc.y * POINTER_TILT_MAX;
      idleTimer = 0;

      if (isDragging && activePointerId === e.pointerId) {
        const dx = e.clientX - lastDragX;
        lastDragX = e.clientX;
        const deltaAngle = dx * 0.008;
        spinY += deltaAngle;
        spinVelocityY = Math.max(-10, Math.min(10, deltaAngle * 45));
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      if (isReduceNow()) return;
      const scroll = scrollState(window.scrollY, window.innerHeight);
      if (!scroll.inHero) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;

      isDragging = true;
      activePointerId = e.pointerId;
      lastDragX = e.clientX;
      idleTimer = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {
        // Synthetic pointer events in tests may not support pointer capture.
      }
    };

    const endDrag = (e: PointerEvent) => {
      if (!isDragging || activePointerId !== e.pointerId) return;
      isDragging = false;
      activePointerId = null;
      try {
        if (canvas.hasPointerCapture(e.pointerId)) {
          canvas.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore
      }
    };

    const onPointerLeave = () => {
      pointerActive = false;
      targetTiltX = 0;
      targetTiltY = 0;
      targetPointerStrength = 0;
    };

    const onWheel = (e: WheelEvent) => {
      if (isReduceNow()) return;
      const scroll = scrollState(window.scrollY, window.innerHeight);
      if (!scroll.inHero) return;
      if (Math.abs(e.deltaX) > 0.5) {
        spinVelocityY += Math.max(-3.5, Math.min(3.5, e.deltaX * 0.004));
        idleTimer = 0;
      }
    };

    const syncPointerEvents = () => {
      if (isReduceNow()) {
        canvas.style.pointerEvents = "none";
        return;
      }
      const scroll = scrollState(window.scrollY, window.innerHeight);
      const next = scroll.inHero ? "auto" : "none";
      if (canvas.style.pointerEvents !== next) {
        canvas.style.pointerEvents = next;
      }
    };
    syncPointerEvents();

    window.addEventListener("scroll", syncPointerEvents, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("blur", onPointerLeave);
    document.addEventListener("mouseleave", onPointerLeave);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", onPointerLeave);
    canvas.addEventListener("wheel", onWheel, { passive: true });

    const tick = (now: number) => {
      if (cancelled || !readyRef.current) return;
      if (isReduceNow()) {
        renderStaticFrame();
        return;
      }
      if (!visibleRef.current) {
        canvas.dataset.state = "paused";
        pausedAtMs = pausedAtMs ?? now;
        lastFrameMs = 0;
        return;
      }

      if (introStartMs === null) {
        introStartMs = now;
      } else if (pausedAtMs !== null) {
        introStartMs += now - pausedAtMs;
        pausedAtMs = null;
      }

      const deltaMs = lastFrameMs === 0 ? 0 : now - lastFrameMs;
      lastFrameMs = now;
      if (elapsed > 2.5 && deltaMs > 0 && deltaMs < 120) {
        reportFrameRef.current(deltaMs);
      }

      const dt = Math.min(deltaMs, 50) / 1000;
      elapsed += dt;
      idleTimer += dt;

      const scroll = scrollState(window.scrollY, window.innerHeight);
      syncPointerEvents();

      const idleW = idleResumeWeight(idleTimer);
      if (!isDragging) {
        spinY += IDLE_SPIN_RAD_PER_SEC * idleW * dt;
      }
      spinY += spinVelocityY * dt;
      spinVelocityY *= Math.exp(-3.5 * dt);

      const wobbleX =
        Math.sin(elapsed * ((Math.PI * 2) / IDLE_WOBBLE_PERIOD_SEC)) *
        IDLE_WOBBLE_AMPLITUDE *
        idleW;

      const smooth = 1 - Math.exp(-8 * dt);
      const activeMask = 1 - scroll.morph;
      tiltX += (targetTiltX * activeMask - tiltX) * smooth;
      tiltY += (targetTiltY * activeMask - tiltY) * smooth;

      const m = stageRef.current;
      group.position.set(0, 0, scroll.groupZ);
      group.rotation.set(wobbleX + tiltX, spinY + tiltY, 0);
      camera.position.set(0, 0, m.baseCameraZ + scroll.cameraDollyZ);
      camera.setViewOffset(
        m.vw,
        m.vh,
        (m.vw / 2 - m.heroCenterX) * activeMask,
        (m.vh / 2 - m.heroCenterY) * activeMask,
        m.vw,
        m.vh,
      );
      group.updateMatrixWorld();

      if (pointerActive && activeMask > 0.05) {
        planeNormal.set(0, 0, 1).applyQuaternion(group.quaternion);
        plane.setFromNormalAndCoplanarPoint(planeNormal, group.position);
        raycaster.setFromCamera(pointerNdc, camera);
        if (raycaster.ray.intersectPlane(plane, worldHit)) {
          group.worldToLocal(localHit.copy(worldHit));
          if (localHit.lengthSq() < 6.5) {
            const uPtr = material.uniforms.uPointer!.value as Vector3;
            if (pointerStrength < 0.01) {
              uPtr.copy(localHit);
            } else {
              uPtr.lerp(localHit, 0.35);
            }
            targetPointerStrength = 1;
          } else {
            targetPointerStrength = 0;
          }
        } else {
          targetPointerStrength = 0;
        }
      } else {
        targetPointerStrength = 0;
      }

      pointerStrength +=
        (targetPointerStrength * activeMask - pointerStrength) * smooth;

      // Intro progresses on wall-clock time so it completes in 1.8 s even at low FPS.
      const introSec = introElapsedSec(now, introStartMs);
      material.uniforms.uTime!.value = elapsed;
      material.uniforms.uMorph!.value = blendIntroAndScrollMorph(
        introSec,
        scroll.morph,
      );
      material.uniforms.uOpacity!.value = scroll.opacity;
      material.uniforms.uPointerStrength!.value = pointerStrength;
      dustPoints.position.set(0, 0, 0);
      dustMaterial.uniforms.uTime!.value = elapsed;
      dustMaterial.uniforms.uScrollMorph!.value = scroll.morph;
      const targetDark = darkTargetRef.current;
      currentDark += (targetDark - currentDark) * Math.min(1, dt * 6);
      dustMaterial.uniforms.uDark!.value = currentDark;
      (dustMaterial.uniforms.uPointer!.value as Vector3).set(
        pointerNdc.x * pointerStrength,
        pointerNdc.y * pointerStrength,
        0,
      );

      renderer.render(scene, camera);
      framesRef.current += 1;
      canvas.dataset.state = "running";
      canvas.dataset.frames = String(framesRef.current);

      rafRef.current = requestAnimationFrame(tick);
    };

    const startLoop = () => {
      cancelAnimationFrame(rafRef.current);
      lastFrameMs = 0;
      if (isReduceNow()) {
        renderStaticFrame();
      } else if (!visibleRef.current) {
        canvas.dataset.state = "paused";
        pausedAtMs = pausedAtMs ?? performance.now();
      } else {
        if (introStartMs === null) introStartMs = performance.now();
        else if (pausedAtMs !== null) {
          introStartMs += performance.now() - pausedAtMs;
          pausedAtMs = null;
        }
        canvas.dataset.state = "running";
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    // Expose loop starter via dataset trigger / helper ref for visibility/reduced changes.
    loopStarterRef.current = startLoop;

    rasterizeSvgToPixels(LOGO_SRC)
      .then((pixels) => {
        if (cancelled) return;
        pixelsRef.current = pixels;
        const activeTier = tierRef.current;
        const count = particleCountForTier(activeTier);
        const geometry = buildGeometry(pixels, count);
        const points = new Points(geometry, material);
        points.frustumCulled = false;
        group.add(points);
        pointsRef.current = points;
        readyRef.current = true;

        canvas.dataset.tier = activeTier;
        canvas.dataset.particles = String(count);
        resize();
        startLoop();
      })
      .catch(() => {
        if (!cancelled) setFallback(true);
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      loopStarterRef.current = null;
      cancelAnimationFrame(rafRef.current);
      stageObserver.disconnect();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", syncPointerEvents);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("blur", onPointerLeave);
      document.removeEventListener("mouseleave", onPointerLeave);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", endDrag);
      canvas.removeEventListener("pointercancel", endDrag);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("webglcontextlost", onContextLost);

      if (pointsRef.current) {
        pointsRef.current.geometry.dispose();
        pointsRef.current = null;
      }
      if (dustPointsRef.current) {
        dustPointsRef.current.geometry.dispose();
        dustPointsRef.current = null;
      }
      material.dispose();
      materialRef.current = null;
      dustMaterial.dispose();
      dustMaterialRef.current = null;
      renderer.dispose();
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      groupRef.current = null;
    };
  }, [fallback, renderStaticFrame]);

  const loopStarterRef = useRef<(() => void) | null>(null);

  // Pause and resume cleanly on visibility or reduced-motion changes.
  useEffect(() => {
    if (fallback || !readyRef.current) return;
    loopStarterRef.current?.();
  }, [visible, reduced, fallback]);

  // Keep dust material in sync when atmosphere/theme changes while static.
  useEffect(() => {
    if (dustMaterialRef.current) {
      dustMaterialRef.current.uniforms.uDark!.value = darkTarget;
      if (reducedRef.current) {
        renderStaticFrame();
      }
    }
  }, [darkTarget, renderStaticFrame]);

  // Recreate geometry in place when quality tier drops without resetting renderer.
  useEffect(() => {
    const canvas = canvasRef.current;
    const pixels = pixelsRef.current;
    const points = pointsRef.current;
    const dustPoints = dustPointsRef.current;
    const material = materialRef.current;
    if (!canvas || !pixels || !points || !material || !readyRef.current) return;

    const count = particleCountForTier(tier);
    const oldGeometry = points.geometry;
    points.geometry = buildGeometry(pixels, count);
    oldGeometry.dispose();

    if (dustPoints) {
      const oldDust = dustPoints.geometry;
      dustPoints.geometry = buildDustGeometry(ambientDustCountForTier(tier));
      oldDust.dispose();
    }

    material.uniforms.uBaseSize!.value =
      stageRef.current.basePointSize * TIER_SIZE_SCALE[tier];
    material.uniforms.uIntensity!.value = TIER_INTENSITY[tier];

    canvas.dataset.tier = tier;
    canvas.dataset.particles = String(count);

    if (reduced) {
      renderStaticFrame();
    }
  }, [tier, reduced, renderStaticFrame]);

  if (fallback) {
    return (
      <div
        aria-hidden="true"
        data-particle-logo
        data-state="fallback"
        data-tier={tier}
        data-particles="0"
        className="pointer-events-none absolute inset-0 z-0 grid items-center px-(--spacing-gutter) lg:grid-cols-12"
      >
        <div className="flex min-h-[38dvh] items-center justify-center sm:min-h-[42dvh] lg:col-span-6 lg:col-start-7 lg:min-h-[64dvh]">
          <Logo slug="yes-logomark-gradient" height={220} />
        </div>
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      data-particle-logo
      data-state={reduced ? "static" : visible ? "running" : "paused"}
      data-tier={tier}
      data-particles={String(particleCountForTier(tier))}
      className="fixed inset-0 z-0 size-full touch-pan-y"
    />
  );
}
