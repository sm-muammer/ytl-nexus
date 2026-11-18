"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  ATMOSPHERE_EVENT,
  ATMOSPHERE_META,
  ATMOSPHERE_MODES,
  ATMOSPHERE_STORAGE_KEY,
  DEFAULT_ATMOSPHERE,
  atmosphereAttributes,
  nextAtmosphereMode,
  parseAtmosphereMode,
  type AtmosphereMode,
} from "@/lib/design/atmosphere";

function readAtmosphereSnapshot(): AtmosphereMode {
  if (typeof window === "undefined") return DEFAULT_ATMOSPHERE;
  const fromDom = document.documentElement.dataset.atmosphere;
  if (fromDom) return parseAtmosphereMode(fromDom);
  try {
    return parseAtmosphereMode(
      window.localStorage.getItem(ATMOSPHERE_STORAGE_KEY),
    );
  } catch {
    return DEFAULT_ATMOSPHERE;
  }
}

function subscribeAtmosphere(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === ATMOSPHERE_STORAGE_KEY || event.key === null) {
      callback();
    }
  };
  window.addEventListener(ATMOSPHERE_EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(ATMOSPHERE_EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}

function writeAtmosphereMode(mode: AtmosphereMode): void {
  if (typeof window === "undefined") return;
  const attrs = atmosphereAttributes(mode);
  document.documentElement.dataset.theme = attrs.theme;
  document.documentElement.dataset.atmosphere = attrs.atmosphere;
  try {
    window.localStorage.setItem(ATMOSPHERE_STORAGE_KEY, mode);
  } catch {
    // Storage may be blocked in strict privacy contexts.
  }
  window.dispatchEvent(new Event(ATMOSPHERE_EVENT));
}

export function useAtmosphereMode(): {
  mode: AtmosphereMode;
  setMode: (next: AtmosphereMode) => void;
} {
  const mode = useSyncExternalStore(
    subscribeAtmosphere,
    readAtmosphereSnapshot,
    () => DEFAULT_ATMOSPHERE,
  );

  useEffect(() => {
    const attrs = atmosphereAttributes(mode);
    if (document.documentElement.dataset.theme !== attrs.theme) {
      document.documentElement.dataset.theme = attrs.theme;
    }
    if (document.documentElement.dataset.atmosphere !== attrs.atmosphere) {
      document.documentElement.dataset.atmosphere = attrs.atmosphere;
    }
  }, [mode]);

  return { mode, setMode: writeAtmosphereMode };
}

function ModeIcon({ mode }: { mode: AtmosphereMode }) {
  if (mode === "blueprint") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0 fill-none stroke-current stroke-[1.6]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="2" width="12" height="12" rx="1.5" />
        <path d="M2 8h12M8 2v12" />
      </svg>
    );
  }
  if (mode === "daylight") {
    return (
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="size-3.5 shrink-0 fill-none stroke-current stroke-[1.6]"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="8" cy="8" r="3" />
        <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
      </svg>
    );
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className="size-3.5 shrink-0 fill-none stroke-current stroke-[1.6]"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3a4.2 4.2 0 0 0 6.5 6.5Z" />
    </svg>
  );
}

/** Compact header button cycling Obsidian -> Blueprint -> Daylight modes. */
export function AtmosphereHeaderToggle() {
  const { mode, setMode } = useAtmosphereMode();
  const meta = ATMOSPHERE_META[mode];
  const next = nextAtmosphereMode(mode);

  return (
    <button
      type="button"
      onClick={() => setMode(next)}
      data-atmosphere-toggle
      aria-label={`Atmosphere mode: ${meta.label}. Switch to ${ATMOSPHERE_META[next].label}`}
      title={`${meta.label} — click for ${ATMOSPHERE_META[next].label}`}
      className="border-line bg-surface/60 text-muted hover:border-border-strong hover:bg-surface-raised hover:text-ink hidden size-11 min-h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full border text-xs font-medium transition-colors duration-(--duration-fast) sm:inline-flex 2xl:w-auto 2xl:px-3.5"
    >
      <ModeIcon mode={mode} />
      <span className="hidden whitespace-nowrap 2xl:inline">{meta.label}</span>
    </button>
  );
}

/** Accessible 3-way atmosphere pill group used on / and inside NavSheet. */
export function AtmosphereModeGroup({ className }: { className?: string }) {
  const { mode, setMode } = useAtmosphereMode();

  return (
    <div
      role="group"
      aria-label="Atmosphere mode"
      data-atmosphere-group
      className={`inline-flex flex-wrap items-center gap-1.5 ${className ?? ""}`}
    >
      {ATMOSPHERE_MODES.map((id) => {
        const meta = ATMOSPHERE_META[id];
        const active = mode === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={active}
            data-atmosphere-option={id}
            title={meta.description}
            className="border-line bg-surface/60 text-muted hover:border-border-strong hover:bg-surface-raised hover:text-ink aria-pressed:border-accent-ink aria-pressed:bg-surface-raised aria-pressed:text-accent-ink inline-flex min-h-11 min-w-11 items-center gap-1.5 rounded-full border px-3.5 font-mono text-xs font-medium tracking-wide transition-colors duration-(--duration-fast)"
          >
            <ModeIcon mode={id} />
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
