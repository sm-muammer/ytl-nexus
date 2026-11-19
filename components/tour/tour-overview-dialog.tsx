"use client";

import { useEffect, useId, useRef } from "react";
import type { ContentItem } from "@/lib/content/types";
import { accessLabel } from "@/lib/roles";
import { getTourSlideMeta } from "@/lib/tour/slides";

export function TourOverviewDialog({
  open,
  steps,
  currentIdx,
  onSelect,
  onClose,
}: {
  open: boolean;
  steps: readonly ContentItem[];
  currentIdx: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      openerRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (dialog && dialog.open && typeof dialog.close === "function") {
      dialog.close();
    } else {
      onClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      data-tour-overview
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      onClose={() => {
        onClose();
        if (openerRef.current?.isConnected) {
          openerRef.current.focus();
        }
      }}
      onClick={(event) => {
        const dialog = event.currentTarget;
        if ("closedBy" in HTMLDialogElement.prototype) return;
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isDialogContent) {
          closeDialog();
        }
      }}
      className="bg-canvas text-ink border-line shadow-overlay m-auto max-h-[88dvh] w-[min(92vw,68rem)] max-w-none overflow-y-auto rounded-2xl border p-0"
    >
      {open ? (
        <div className="flex flex-col gap-6 p-5 sm:p-7">
          <div className="border-line flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <h2
                id={titleId}
                className="font-display text-heading-3 text-ink font-semibold tracking-tight"
              >
                All tour slides
              </h2>
              <p className="text-muted text-data mt-1">
                Jump directly to any of the {steps.length} guided slides.
              </p>
            </div>
            <button
              type="button"
              data-testid="tour-overview-close"
              onClick={closeDialog}
              className="border-border-strong bg-surface text-ink hover:bg-surface-raised inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border px-4 text-sm font-medium transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.97]"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 fill-none stroke-current stroke-2"
                strokeLinecap="round"
              >
                <path d="m3 3 10 10M13 3 3 13" />
              </svg>
              <span>Close</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, idx) => {
              const meta = getTourSlideMeta(step, idx);
              const active = idx === currentIdx;
              const padded = String(idx + 1).padStart(2, "0");

              return (
                <button
                  key={step.slug}
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => {
                    onSelect(idx);
                    closeDialog();
                  }}
                  className={`flex min-h-28 flex-col justify-between gap-3 rounded-xl border p-4 text-left transition-[transform,background-color,border-color] duration-150 ease-out active:scale-[0.98] ${
                    active
                      ? "border-accent-ink bg-surface-raised"
                      : "border-line bg-surface/70 hover:border-border-strong hover:bg-surface-raised"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        active ? "text-accent-ink" : "text-muted"
                      }`}
                    >
                      {padded}
                    </span>
                    <span className="text-muted font-mono text-[11px]">
                      {meta.chapter}
                    </span>
                  </div>

                  <span className="text-ink text-sm leading-snug font-semibold">
                    {step.title}
                  </span>

                  <span className="text-muted font-mono text-[11px]">
                    {accessLabel(meta.minRole)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
