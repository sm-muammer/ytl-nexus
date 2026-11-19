"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import { ItemBody } from "@/components/content/content-parts";
import { usePageVisible } from "@/components/motion/use-page-visible";
import { TourOverviewDialog } from "@/components/tour/tour-overview-dialog";
import { TourSlideVisual } from "@/components/tour/tour-slide-visual";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";
import type { ContentItem } from "@/lib/content/types";
import type { Accent } from "@/lib/navigation/modules";
import { accessLabel } from "@/lib/roles";
import {
  TOUR_CHAPTERS,
  getTourSlideMeta,
  parseInitialTourStep,
  type TourChapter,
} from "@/lib/tour/slides";

interface TourViewProps {
  steps: ContentItem[];
  source: "live" | "demo";
  initialStep?: number;
}

const ACCENT_BAR: Record<Accent, string> = {
  blue: "bg-accent-ink",
  pink: "bg-pink-ink",
  violet: "bg-violet-ink",
};

const ACCENT_TEXT: Record<Accent, string> = {
  blue: "text-accent-ink",
  pink: "text-pink-ink",
  violet: "text-violet-ink",
};

const ACCENT_BADGE: Record<Accent, string> = {
  blue: "border-accent-ink/30 bg-accent-ink/10 text-accent-ink",
  pink: "border-pink-ink/30 bg-pink-ink/10 text-pink-ink",
  violet: "border-violet-ink/30 bg-violet-ink/10 text-violet-ink",
};

function clampStep(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(Math.max(0, index), total - 1);
}

function formatTimer(seconds: number): string {
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function TourView({ steps, source, initialStep = 0 }: TourViewProps) {
  const totalSteps = steps.length;
  const [currentIdx, setCurrentIdx] = useState(() =>
    clampStep(initialStep, totalSteps),
  );
  const [direction, setDirection] = useState<1 | -1>(1);
  const [presenterMode, setPresenterMode] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [presenterSeconds, setPresenterSeconds] = useState(0);

  const reduced = useReducedMotion();
  const pageVisible = usePageVisible();
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(
    null,
  );
  const currentIdxRef = useRef(clampStep(initialStep, totalSteps));

  const safeIdx = clampStep(currentIdx, totalSteps);
  const currentStep = steps[safeIdx];

  const slideMetas = useMemo(
    () => steps.map((step, idx) => getTourSlideMeta(step, idx)),
    [steps],
  );

  const chapterButtons = useMemo(() => {
    const firstIndexByChapter = new Map<TourChapter, number>();
    slideMetas.forEach((meta, idx) => {
      if (!firstIndexByChapter.has(meta.chapter)) {
        firstIndexByChapter.set(meta.chapter, idx);
      }
    });
    return TOUR_CHAPTERS.filter((c) => firstIndexByChapter.has(c)).map(
      (chapter) => ({
        chapter,
        firstIndex: firstIndexByChapter.get(chapter)!,
      }),
    );
  }, [slideMetas]);

  const navigateTo = useCallback(
    (nextIndex: number, syncUrl = true) => {
      const clamped = clampStep(nextIndex, totalSteps);
      const prev = currentIdxRef.current;
      currentIdxRef.current = clamped;
      setDirection(clamped >= prev ? 1 : -1);
      setCurrentIdx(clamped);
      if (syncUrl && typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (clamped > 0) {
          url.searchParams.set("step", String(clamped + 1));
        } else {
          url.searchParams.delete("step");
        }
        window.history.replaceState(
          null,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
    },
    [totalSteps],
  );

  const goNext = useCallback(() => {
    if (safeIdx < totalSteps - 1) {
      navigateTo(safeIdx + 1);
    }
  }, [navigateTo, safeIdx, totalSteps]);

  const goPrev = useCallback(() => {
    if (safeIdx > 0) {
      navigateTo(safeIdx - 1);
    }
  }, [navigateTo, safeIdx]);

  const togglePresenterMode = useCallback(() => {
    if (!presenterMode) {
      setPresenterSeconds(0);
    }
    setPresenterMode((prev) => !prev);
  }, [presenterMode]);

  // Sync browser back/forward history changes on ?step=
  useEffect(() => {
    function handlePopState() {
      const rawStep =
        new URLSearchParams(window.location.search).get("step") ?? undefined;
      navigateTo(parseInitialTourStep(rawStep, totalSteps), false);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [navigateTo, totalSteps]);

  // Presenter elapsed timer (ticks only while Presenter Mode + tab visible)
  useEffect(() => {
    if (!presenterMode || !pageVisible) return;
    const id = window.setInterval(() => {
      setPresenterSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [pageVisible, presenterMode]);

  // Keyboard navigation (TOUR-03)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      if (overviewOpen) {
        if (
          (e.key === "g" || e.key === "G") &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault();
          setOverviewOpen(false);
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === " ") {
        if (
          target instanceof HTMLButtonElement ||
          target instanceof HTMLAnchorElement
        ) {
          return;
        }
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Home") {
        e.preventDefault();
        navigateTo(0);
      } else if (e.key === "End") {
        e.preventDefault();
        navigateTo(totalSteps - 1);
      } else if (
        (e.key === "g" || e.key === "G") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        setOverviewOpen(true);
      } else if (e.key === "Escape" && presenterMode) {
        e.preventDefault();
        setPresenterMode(false);
      } else if (
        (e.key === "p" || e.key === "P") &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
        togglePresenterMode();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    goNext,
    goPrev,
    navigateTo,
    overviewOpen,
    presenterMode,
    togglePresenterMode,
    totalSteps,
  ]);

  if (!currentStep) {
    return (
      <div className="px-(--spacing-gutter) py-16">
        <p className="text-muted">No tour steps available.</p>
      </div>
    );
  }

  const currentMeta = slideMetas[safeIdx]!;
  const progressScale = totalSteps > 1 ? (safeIdx + 1) / totalSteps : 1;
  const paddedSlide = String(safeIdx + 1).padStart(2, "0");
  const paddedTotal = String(totalSteps).padStart(2, "0");

  return (
    <div
      data-tour-view
      data-presenter-mode={presenterMode ? "true" : "false"}
      className={
        presenterMode
          ? "bg-canvas fixed inset-0 z-(--z-modal) flex flex-col justify-between gap-6 overflow-y-auto px-(--spacing-gutter) py-6 sm:py-8"
          : "relative flex flex-col gap-6"
      }
    >
      {/* Screen-reader live announcement on slide changes */}
      <div role="status" aria-live="polite" className="sr-only">
        Slide {safeIdx + 1} of {totalSteps}: {currentStep.title}
      </div>

      {/* Signal-ribbon transition indicator across steps (TOUR-02) */}
      <div
        aria-hidden="true"
        data-tour-progress-ribbon
        className="bg-surface border-line fixed inset-x-0 top-0 z-(--z-toast) h-1.5 w-full overflow-hidden border-b"
      >
        <m.div
          className="from-ytl-blue via-yes-pink to-yes-gradient-end h-full w-full origin-left bg-linear-to-r"
          initial={false}
          animate={
            reduced
              ? { opacity: 1 }
              : { transform: `scaleX(${progressScale})`, opacity: 1 }
          }
          style={
            reduced ? { transform: `scaleX(${progressScale})` } : undefined
          }
          transition={{
            duration: 0.35,
            ease: [0.22, 1, 0.36, 1],
          }}
        />
      </div>

      {/* Header controls / Status + Overview + Presenter toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-data text-ink bg-surface border-line rounded-md border px-2.5 py-1 font-mono font-semibold tabular-nums">
            Step {safeIdx + 1} of {totalSteps}
          </span>
          <span className="border-line bg-surface-raised text-muted rounded-md border px-2.5 py-1 font-mono text-xs font-medium">
            {currentMeta.chapter}
          </span>
          <LiveDemoLabel source={source} />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {presenterMode ? (
            <button
              type="button"
              onClick={() => setPresenterSeconds(0)}
              aria-label={`Presenter timer ${formatTimer(presenterSeconds)}. Click to reset.`}
              title="Reset presenter timer"
              className="border-line bg-surface text-muted hover:border-border-strong hover:text-ink inline-flex min-h-11 items-center gap-2 rounded-md border px-3 py-1 font-mono text-xs tabular-nums transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-3.5 shrink-0 fill-none stroke-current"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="8" cy="8.5" r="5.5" />
                <path d="M8 5.5v3l2 1.25M6.5 1.75h3" />
              </svg>
              <span>{formatTimer(presenterSeconds)}</span>
            </button>
          ) : null}

          <button
            type="button"
            data-testid="tour-overview-open"
            aria-haspopup="dialog"
            onClick={() => setOverviewOpen(true)}
            className="border-border-strong bg-surface text-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-2 rounded-md border px-3.5 py-1 text-xs font-medium transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97]"
            title="Open slide grid overview (Shortcut: G)"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 16 16"
              className="size-3.5 fill-none stroke-current"
              strokeWidth={1.6}
            >
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            <span>All slides (G)</span>
          </button>

          <button
            type="button"
            data-testid="toggle-presenter-mode"
            onClick={togglePresenterMode}
            className="border-border-strong bg-surface text-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-2 rounded-md border px-3.5 py-1 text-xs font-medium transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97]"
            title="Toggle Presenter Mode (Shortcut: P or Esc to exit)"
          >
            <span
              aria-hidden="true"
              className={
                presenterMode
                  ? "bg-pink-ink inline-block size-2 rounded-full"
                  : "bg-muted inline-block size-2 rounded-full"
              }
            />
            {presenterMode ? "Exit Presenter Mode (Esc)" : "Presenter Mode (P)"}
          </button>
        </div>
      </div>

      {/* Chapter quick-jump rail */}
      {!presenterMode ? (
        <nav
          aria-label="Tour chapters"
          className="flex flex-wrap items-center gap-2"
        >
          {chapterButtons.map(({ chapter, firstIndex }) => {
            const active = chapter === currentMeta.chapter;
            return (
              <button
                key={chapter}
                type="button"
                aria-pressed={active}
                onClick={() => navigateTo(firstIndex)}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 font-mono text-xs font-medium transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] ${
                  active
                    ? "border-accent-ink bg-surface-raised text-ink"
                    : "border-line bg-surface/70 text-muted hover:border-border-strong hover:text-ink"
                }`}
              >
                {chapter}
              </button>
            );
          })}
        </nav>
      ) : null}

      {/* Main 2-column presentation stage */}
      <div
        data-step-card
        onTouchStart={(e) => {
          if (e.touches.length !== 1) return;
          const touch = e.touches[0]!;
          touchStartRef.current = {
            x: touch.clientX,
            y: touch.clientY,
            t: Date.now(),
          };
        }}
        onTouchEnd={(e) => {
          const start = touchStartRef.current;
          touchStartRef.current = null;
          if (!start || e.changedTouches.length === 0) return;
          const touch = e.changedTouches[0]!;
          const dx = touch.clientX - start.x;
          const dy = touch.clientY - start.y;
          const dt = Math.max(Date.now() - start.t, 1);
          const velocity = Math.abs(dx) / dt;
          const isHorizontal = Math.abs(dx) > Math.abs(dy) * 1.5;
          if (
            isHorizontal &&
            (Math.abs(dx) > 48 || (Math.abs(dx) > 28 && velocity > 0.25))
          ) {
            if (dx < 0) {
              goNext();
            } else {
              goPrev();
            }
          }
        }}
        className={`border-line bg-glass shadow-raised relative overflow-hidden rounded-xl border backdrop-blur-md ${
          presenterMode
            ? "mx-auto flex w-full max-w-7xl flex-1 items-center"
            : ""
        }`}
      >
        {/* Top accent hairline */}
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-0.5 ${ACCENT_BAR[currentMeta.accent]}`}
        />

        <m.div
          key={currentStep.slug}
          initial={
            reduced
              ? { opacity: 0 }
              : {
                  opacity: 0,
                  transform:
                    direction >= 0 ? "translateX(14px)" : "translateX(-14px)",
                }
          }
          animate={
            reduced
              ? { opacity: 1 }
              : { opacity: 1, transform: "translateX(0px)" }
          }
          transition={{
            duration: reduced ? 0.16 : 0.22,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`grid w-full gap-8 lg:grid-cols-12 lg:items-center lg:gap-10 ${
            presenterMode ? "p-6 sm:p-10 lg:p-12" : "p-6 sm:p-8 lg:p-10"
          }`}
        >
          {/* Left column: slide narrative, highlights & safe module link */}
          <div className="flex flex-col lg:col-span-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted font-mono text-xs font-semibold tabular-nums">
                {paddedSlide} / {paddedTotal}
              </span>
              {currentStep.relatedService ? (
                <span
                  className={`rounded border px-2 py-0.5 font-mono text-xs font-medium ${ACCENT_BADGE[currentMeta.accent]}`}
                >
                  {currentStep.relatedService}
                </span>
              ) : null}
              <span className="border-line bg-surface-raised text-muted rounded border px-2 py-0.5 font-mono text-xs">
                {accessLabel(currentMeta.minRole)}
              </span>
            </div>

            <h2
              data-step-title
              className={`font-display text-ink mt-4 font-semibold tracking-tight text-balance ${
                presenterMode ? "text-heading-1" : "text-heading-2"
              }`}
            >
              {currentStep.title}
            </h2>

            <div
              data-step-body
              className={`text-muted mt-4 leading-relaxed ${
                presenterMode ? "text-lead max-w-3xl" : "text-body"
              }`}
            >
              <ItemBody html={currentStep.html} />
            </div>

            <ul className="mt-6 space-y-2.5">
              {currentMeta.highlights.map((bullet) => (
                <li
                  key={bullet}
                  data-tour-highlight
                  className="text-ink text-data flex items-start gap-2.5 leading-relaxed"
                >
                  <span
                    aria-hidden="true"
                    className={`mt-2 inline-block size-1.5 shrink-0 rounded-full ${ACCENT_BAR[currentMeta.accent]}`}
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              {currentMeta.moduleHref && currentMeta.moduleLabel ? (
                <Link
                  href={currentMeta.moduleHref}
                  className="border-border-strong bg-surface-raised text-ink hover:border-accent-ink inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-[transform,border-color,background-color] duration-150 ease-out active:scale-[0.98]"
                >
                  <span>{currentMeta.moduleLabel}</span>
                  <span
                    aria-hidden="true"
                    className={ACCENT_TEXT[currentMeta.accent]}
                  >
                    →
                  </span>
                </Link>
              ) : currentMeta.hiddenNote ? (
                <span className="border-line bg-surface-raised text-muted inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 font-mono text-xs">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 16 16"
                    className="size-3.5 shrink-0 fill-none stroke-current"
                    strokeWidth={1.6}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
                    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
                  </svg>
                  <span>{currentMeta.hiddenNote}</span>
                </span>
              ) : null}

              {safeIdx === totalSteps - 1 ? (
                <button
                  type="button"
                  data-testid="tour-restart"
                  onClick={() => navigateTo(0)}
                  className="border-border-strong bg-surface text-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98]"
                >
                  ↺ Restart tour
                </button>
              ) : null}
            </div>
          </div>

          {/* Right column: rich visual stage */}
          <div className="lg:col-span-5">
            <TourSlideVisual
              preview={currentMeta.preview}
              slideNumber={safeIdx + 1}
              chapter={currentMeta.chapter}
              accent={currentMeta.accent}
              presenterMode={presenterMode}
            />
          </div>
        </m.div>
      </div>

      {/* Step navigation buttons and scrubber */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            data-testid="tour-prev"
            onClick={goPrev}
            disabled={safeIdx === 0}
            className="border-border-strong bg-surface text-ink hover:bg-surface-raised disabled:border-line disabled:text-muted/50 min-h-11 rounded-md border px-5 py-2 font-medium transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:active:scale-100"
          >
            ← Previous
          </button>

          {/* Stepper dots - min 24x24 px touch targets for WCAG 2.2 target size */}
          <div
            role="tablist"
            aria-label="Tour steps"
            className="flex flex-wrap items-center justify-center gap-1"
          >
            {steps.map((step, idx) => (
              <button
                key={step.slug}
                type="button"
                role="tab"
                aria-selected={idx === safeIdx}
                aria-label={`Go to step ${idx + 1}: ${step.title}`}
                onClick={() => navigateTo(idx)}
                className="group flex h-6 min-h-6 w-6 min-w-6 items-center justify-center p-1"
              >
                <span
                  className={`block h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                    idx === safeIdx
                      ? "bg-pink-ink w-5"
                      : "bg-border-strong/50 group-hover:bg-ink/60 w-1.5"
                  }`}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="tour-next"
            onClick={goNext}
            disabled={safeIdx === totalSteps - 1}
            className="bg-accent-ink text-canvas disabled:bg-surface-raised disabled:text-muted/50 min-h-11 rounded-md px-6 py-2 font-medium transition-[transform,opacity,background-color] duration-150 ease-out hover:opacity-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-100 disabled:active:scale-100"
          >
            {safeIdx === totalSteps - 1 ? "Completed" : "Next →"}
          </button>
        </div>

        {/* Keyboard navigation helper */}
        <p className="text-data text-muted text-center font-mono text-xs">
          Navigate with{" "}
          <kbd className="border-line bg-surface rounded border px-1.5 py-0.5">
            ←
          </kbd>{" "}
          <kbd className="border-line bg-surface rounded border px-1.5 py-0.5">
            →
          </kbd>{" "}
          or{" "}
          <kbd className="border-line bg-surface rounded border px-1.5 py-0.5">
            Space
          </kbd>
          {" · "}
          <kbd className="border-line bg-surface rounded border px-1.5 py-0.5">
            Home
          </kbd>
          /
          <kbd className="border-line bg-surface rounded border px-1.5 py-0.5">
            End
          </kbd>
          {" · "}
          <kbd className="border-line bg-surface rounded border px-1.5 py-0.5">
            G
          </kbd>{" "}
          all slides{" · "}
          <kbd className="border-line bg-surface rounded border px-1.5 py-0.5">
            P
          </kbd>{" "}
          presenter mode
        </p>
      </div>

      <TourOverviewDialog
        open={overviewOpen}
        steps={steps}
        currentIdx={safeIdx}
        onSelect={(idx) => navigateTo(idx)}
        onClose={() => setOverviewOpen(false)}
      />
    </div>
  );
}
