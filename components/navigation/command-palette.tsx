"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MODULES, type ModuleInfo } from "@/lib/navigation/modules";
import { meetsRole, type Actor } from "@/lib/roles";

type SearchItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  group: string;
  minRole: ModuleInfo["minRole"];
};

function buildSearchItems(actor: Actor): SearchItem[] {
  const items: SearchItem[] = [];

  for (const m of MODULES) {
    if (m.hidden && !meetsRole(actor, "admin")) continue;
    if (m.minRole && !meetsRole(actor, m.minRole)) continue;

    items.push({
      id: m.slug,
      title: m.name,
      subtitle: m.subtitle,
      href: m.href,
      group: m.group,
      minRole: m.minRole,
    });

    if (m.pages) {
      for (const p of m.pages) {
        items.push({
          id: p.href,
          title: `${m.name}: ${p.title}`,
          subtitle: p.subtitle,
          href: p.href,
          group: m.group,
          minRole: m.minRole,
        });
      }
    }
  }

  return items;
}

export function CommandPalette({ actor }: { actor: Actor }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const allItems = buildSearchItems(actor);
  const filtered = allItems.filter(
    (i) =>
      i.title.toLowerCase().includes(query.toLowerCase()) ||
      i.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      i.group.toLowerCase().includes(query.toLowerCase()),
  );

  function openPalette() {
    setQuery("");
    setSelectedIndex(0);
    setOpen(true);
  }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setQuery("");
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  function navigateTo(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      navigateTo(filtered[selectedIndex].href);
    }
  }

  return (
    <>
      {/* Header Pill / Trigger Button */}
      <button
        type="button"
        onClick={openPalette}
        aria-label="Open command palette (Cmd+K)"
        className="border-line bg-surface hover:border-ink hover:text-ink text-muted hidden items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors sm:inline-flex"
        data-command-palette-trigger
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-muted text-[11px]">Search...</span>
        <kbd className="border-line bg-surface-elevated text-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
          ⌘K
        </kbd>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Command Palette"
          className="bg-canvas/80 fixed inset-0 z-(--z-overlay) flex items-start justify-center p-4 pt-[15vh] backdrop-blur-md"
          onClick={() => setOpen(false)}
        >
          <div
            className="border-line bg-surface-elevated flex w-full max-w-xl flex-col overflow-hidden rounded-xl border shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            data-command-palette-modal
          >
            {/* Search Input */}
            <div className="border-line flex items-center border-b px-4 py-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-muted mr-3 shrink-0"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleInputKeyDown}
                placeholder="Jump to module or subpage..."
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-controls="command-results-list"
                className="text-ink placeholder:text-muted w-full bg-transparent text-sm outline-none"
              />
              <kbd
                onClick={() => setOpen(false)}
                className="border-line text-muted hover:text-ink cursor-pointer rounded border px-1.5 py-0.5 text-[10px]"
              >
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <ul
              id="command-results-list"
              role="listbox"
              className="max-h-80 overflow-y-auto p-2"
            >
              {filtered.length === 0 ? (
                <li className="text-muted px-4 py-6 text-center text-xs">
                  No matching modules or pages found.
                </li>
              ) : (
                filtered.map((item, index) => {
                  const selected = index === selectedIndex;
                  return (
                    <li
                      key={item.id}
                      role="option"
                      aria-selected={selected}
                      onClick={() => navigateTo(item.href)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                        selected
                          ? "bg-surface-elevated/80 border-border-strong text-ink border"
                          : "text-muted hover:text-ink border border-transparent"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-200">
                          {item.title}
                        </p>
                        <p className="text-muted truncate text-[11px]">
                          {item.subtitle}
                        </p>
                      </div>
                      <span className="text-muted ml-3 shrink-0 font-mono text-[10px] uppercase">
                        {item.group}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Footer / Instructions */}
            <div className="border-line bg-surface/50 text-muted flex items-center justify-between border-t px-4 py-2 text-[11px]">
              <div className="flex items-center gap-3">
                <span>
                  <kbd className="font-mono">↑↓</kbd> navigate
                </span>
                <span>
                  <kbd className="font-mono">↵</kbd> select
                </span>
                <span>
                  <kbd className="font-mono">esc</kbd> close
                </span>
              </div>
              <span>Navigation only</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
