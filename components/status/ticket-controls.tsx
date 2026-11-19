"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { FormError, inputClass } from "@/components/auth/form-parts";
import {
  incidentTrackingPath,
  normalizeIncidentTicketNo,
} from "@/lib/status/tickets";

function copyTextFallback(text: string): boolean {
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function useCopyState() {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  async function copy(text: string) {
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) ok = copyTextFallback(text);
    if (ok) {
      setCopied(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    }
  }

  return { copied, copy };
}

function CopyIcon({ checked }: { checked: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 fill-none stroke-current stroke-[1.75]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {checked ? (
        <path d="m3.5 8.5 3 3 6-7" />
      ) : (
        <>
          <rect x="5.5" y="5.5" width="7.5" height="8.5" rx="1.5" />
          <path d="M10.5 5.5V3.5A1.5 1.5 0 0 0 9 2H4A1.5 1.5 0 0 0 2.5 3.5V10A1.5 1.5 0 0 0 4 11.5h1.5" />
        </>
      )}
    </svg>
  );
}

export function CopyTicketButton({ ticketNo }: { ticketNo: string }) {
  const { copied, copy } = useCopyState();
  return (
    <button
      type="button"
      onClick={() => copy(ticketNo)}
      aria-label={`Copy ticket ${ticketNo}`}
      className="border-border-strong bg-surface text-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors active:scale-[0.98]"
    >
      <CopyIcon checked={copied} />
      <span>{copied ? "Copied" : "Copy ticket"}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? `Copied ${ticketNo}` : ""}
      </span>
    </button>
  );
}

export function CopyTrackingLinkButton({ path }: { path: string }) {
  const { copied, copy } = useCopyState();
  return (
    <button
      type="button"
      onClick={() => copy(`${window.location.origin}${path}`)}
      className="border-border-strong bg-surface text-ink hover:bg-surface-raised inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors active:scale-[0.98]"
    >
      <CopyIcon checked={copied} />
      <span>{copied ? "Link copied" : "Copy tracking link"}</span>
      <span className="sr-only" aria-live="polite">
        {copied ? "Tracking link copied" : ""}
      </span>
    </button>
  );
}

export function IncidentTicketLookup({
  defaultValue = "",
  initialError,
}: {
  defaultValue?: string;
  initialError?: string;
}) {
  const router = useRouter();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | undefined>(initialError);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeIncidentTicketNo(value);
    if (!normalized) {
      setError(
        "Enter a valid ticket number such as INC-2026-0001 (format INC-YYYY-NNNN).",
      );
      inputRef.current?.focus();
      return;
    }
    setError(undefined);
    router.push(incidentTrackingPath(normalized));
  }

  return (
    <form
      action="/status"
      method="get"
      onSubmit={onSubmit}
      data-ticket-lookup
      className="border-line bg-surface/60 flex max-w-xl flex-col gap-3 rounded-lg border p-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          Track by ticket number
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            ref={inputRef}
            id={inputId}
            name="ticket"
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(undefined);
            }}
            placeholder="INC-2026-0001"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={24}
            aria-invalid={error ? "true" : undefined}
            className={`${inputClass} font-mono uppercase`}
          />
          <button
            type="submit"
            className="bg-accent-ink text-canvas min-h-11 shrink-0 rounded-full px-5 text-sm font-semibold transition-opacity duration-(--duration-fast) hover:opacity-90 active:scale-[0.98]"
          >
            Track status
          </button>
        </div>
        <p className="text-muted text-data">
          Enter an auto-assigned ticket number (for example{" "}
          <span className="font-mono">INC-2026-0002</span>) to view current
          status and updates.
        </p>
      </div>
      <FormError message={error} />
    </form>
  );
}
