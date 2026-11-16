"use client";

import { useState, useEffect, useCallback } from "react";
import * as m from "motion/react-m";
import { useReducedMotion } from "motion/react";
import type { ContentItem } from "@/lib/content/types";
import { ItemBody } from "@/components/content/content-parts";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";

interface TourViewProps {
  steps: ContentItem[];
  source: "live" | "demo";
}

export function TourView({ steps, source }: TourViewProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [presenterMode, setPresenterMode] = useState(false);
  const reduced = useReducedMotion();

  const totalSteps = steps.length;
  const currentStep = steps[currentIdx];

  const goNext = useCallback(() => {
    setCurrentIdx((prev) => (prev < totalSteps - 1 ? prev + 1 : prev));
  }, [totalSteps]);

  const goPrev = useCallback(() => {
    setCurrentIdx((prev) => (prev > 0 ? prev - 1 : prev));
  }, []);

  const goToStep = useCallback(
    (index: number) => {
      if (index >= 0 && index < totalSteps) {
        setCurrentIdx(index);
      }
    },
    [totalSteps],
  );

  // Keyboard navigation for tour and presenter mode (TOUR-03)
  // Arrow right / Space: Next
  // Arrow left: Prev
  // Escape: Exit presenter mode
  // P key: Toggle presenter mode
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (e.key === "ArrowRight" || (e.key === " " && !presenterMode)) {
        e.preventDefault();
        goNext();
      } else if (e.key === " " && presenterMode) {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
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
        setPresenterMode((prev) => !prev);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNext, goPrev, presenterMode]);

  if (!currentStep) {
    return (
      <div className="px-(--spacing-gutter) py-16">
        <p className="text-muted">No tour steps available.</p>
      </div>
    );
  }

  const progressPercent =
    totalSteps > 1 ? (currentIdx / (totalSteps - 1)) * 100 : 100;

  return (
    <div
      data-tour-view
      data-presenter-mode={presenterMode ? "true" : "false"}
      className={
        presenterMode
          ? "bg-canvas fixed inset-0 z-50 flex flex-col justify-between overflow-y-auto p-8 sm:p-16 lg:p-24"
          : "relative flex flex-col gap-8"
      }
    >
      {/* Signal-ribbon transition indicator across steps (TOUR-02) */}
      <div
        aria-hidden="true"
        data-tour-progress-ribbon
        className="bg-surface border-border-subtle fixed inset-x-0 top-0 z-(--z-toast) h-1.5 w-full overflow-hidden border-b"
      >
        <m.div
          key={currentIdx}
          className="from-ytl-blue via-yes-pink to-yes-gradient-end h-full origin-left bg-linear-to-r"
          initial={
            reduced
              ? { opacity: 0.8 }
              : { width: `${progressPercent}%`, opacity: 1 }
          }
          animate={
            reduced
              ? { opacity: [0.8, 1, 0.8] }
              : { width: `${progressPercent}%`, opacity: 1 }
          }
          transition={{
            duration: 0.5,
            ease: [0.65, 0, 0.35, 1],
          }}
        />
      </div>

      {/* Header controls / Presenter toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-caption text-muted bg-surface border-border-subtle rounded-md border px-2.5 py-1 font-mono font-semibold">
            Step {currentIdx + 1} of {totalSteps}
          </span>
          <LiveDemoLabel source={source} />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="toggle-presenter-mode"
            onClick={() => setPresenterMode((prev) => !prev)}
            className="hover:bg-surface active:bg-surface-elevated text-caption border-border-strong flex min-h-11 items-center gap-2 rounded-md border px-3 py-1 font-medium transition-colors"
            title="Toggle Presenter Mode (Shortcut: P or Esc to exit)"
          >
            <span
              className={
                presenterMode
                  ? "bg-yes-pink inline-block h-2.5 w-2.5 rounded-full"
                  : "bg-muted inline-block h-2.5 w-2.5 rounded-full"
              }
            />
            {presenterMode ? "Exit Presenter Mode (Esc)" : "Presenter Mode (P)"}
          </button>
        </div>
      </div>

      {/* Main step display */}
      <div
        data-step-card
        key={currentStep.slug}
        className={
          presenterMode
            ? "mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-12"
            : "border-border-subtle bg-surface/50 rounded-xl border p-6 sm:p-10"
        }
      >
        <m.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="mb-4 flex items-center gap-2">
            {currentStep.relatedService ? (
              <span className="text-caption text-ytl-blue bg-ytl-blue/10 border-ytl-blue/20 rounded border px-2 py-0.5 font-mono font-medium">
                {currentStep.relatedService}
              </span>
            ) : null}
          </div>

          <h2
            data-step-title
            className={
              presenterMode
                ? "text-heading-1 font-bold tracking-tight text-white sm:text-5xl lg:text-6xl"
                : "text-heading-2 font-bold tracking-tight text-white"
            }
          >
            {currentStep.title}
          </h2>

          <div
            data-step-body
            className={
              presenterMode
                ? "text-heading-4 text-muted mt-8 max-w-3xl leading-relaxed sm:text-2xl"
                : "text-body text-muted mt-4 max-w-(--spacing-prose) leading-relaxed"
            }
          >
            <ItemBody html={currentStep.html} />
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
            disabled={currentIdx === 0}
            className="hover:bg-surface active:bg-surface-elevated disabled:border-border disabled:text-muted/40 min-h-11 rounded-md border border-white/20 px-5 py-2 font-medium transition-colors disabled:cursor-not-allowed"
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
                aria-selected={idx === currentIdx}
                aria-label={`Go to step ${idx + 1}: ${step.title}`}
                onClick={() => goToStep(idx)}
                className="group flex h-6 min-h-6 w-6 min-w-6 items-center justify-center p-1"
              >
                <span
                  className={`block transition-all duration-200 ${
                    idx === currentIdx
                      ? "bg-yes-pink w-4 rounded-full"
                      : "w-1.5 rounded-full bg-white/20 group-hover:bg-white/40"
                  } h-1.5`}
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            data-testid="tour-next"
            onClick={goNext}
            disabled={currentIdx === totalSteps - 1}
            className="from-ytl-blue to-yes-pink disabled:from-surface disabled:to-surface disabled:text-muted/40 min-h-11 rounded-md bg-linear-to-r px-6 py-2 font-medium text-white transition-opacity hover:opacity-90 active:opacity-100 disabled:cursor-not-allowed"
          >
            {currentIdx === totalSteps - 1 ? "Completed" : "Next →"}
          </button>
        </div>

        {/* Keyboard navigation helper */}
        <p className="text-caption text-muted/70 text-center font-mono">
          Tip: Navigate with <kbd className="border-border border px-1">←</kbd>{" "}
          and <kbd className="border-border border px-1">→</kbd> or{" "}
          <kbd className="border-border border px-1">Space</kbd>. Press{" "}
          <kbd className="border-border border px-1">P</kbd> for Presenter Mode.
        </p>
      </div>
    </div>
  );
}
