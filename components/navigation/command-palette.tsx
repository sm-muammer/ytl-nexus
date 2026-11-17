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
        className="group relative flex h-9 items-center gap-2 rounded-full border border-slate-700/60 bg-slate-900/40 px-3 py-1.5 text-xs font-normal text-slate-300 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-cyan-500/50 hover:bg-slate-800/60 hover:text-white hover:shadow-[0_0_15px_rgba(6,182,212,0.15)] sm:inline-flex"
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
          className="text-slate-400 transition-colors group-hover:text-cyan-400"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="text-xs text-slate-400 transition-colors group-hover:text-slate-200">
          Search modules...
        </span>
        <kbd
          aria-hidden="true"
          className="ml-1 rounded border border-slate-700/80 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 group-hover:border-cyan-500/40 group-hover:text-cyan-300"
        >
          ⌘K
        </kbd>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation Command Palette"
          className="animate-in fade-in fixed inset-0 z-(--z-overlay) flex items-start justify-center bg-black/75 p-4 pt-[12vh] backdrop-blur-xl duration-150"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-800/90 bg-slate-950/95 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.85),0_0_20px_rgba(6,182,212,0.1)] ring-1 ring-white/10 backdrop-blur-2xl"
            onClick={(e) => e.stopPropagation()}
            data-command-palette-modal
          >
            {/* Search Input Bar */}
            <div className="flex items-center border-b border-slate-800/80 bg-slate-900/30 px-4 py-3.5">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="mr-3 shrink-0 text-cyan-400"
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
                placeholder="Jump to module, tool, or subpage..."
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-controls="command-results-list"
                className="w-full border-none bg-transparent text-sm text-slate-100 outline-none [-webkit-appearance:none] placeholder:text-slate-400 focus:ring-0 focus:outline-none focus-visible:outline-none"
              />
              <kbd
                onClick={() => setOpen(false)}
                className="cursor-pointer rounded border border-slate-700/80 bg-slate-800/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-400 transition-colors hover:border-slate-600 hover:text-slate-200"
              >
                ESC
              </kbd>
            </div>

            {/* Results List */}
            <ul
              id="command-results-list"
              role="listbox"
              className="max-h-84 divide-y divide-slate-800/30 overflow-y-auto p-2"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-10 text-center text-xs text-slate-400">
                  No matching modules or subpages found for &ldquo;{query}
                  &rdquo;.
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
                      className={`group flex cursor-pointer items-center justify-between rounded-xl px-3.5 py-2.5 transition-all duration-150 ${
                        selected
                          ? "bg-slate-800/70 text-white shadow-sm ring-1 ring-cyan-500/30"
                          : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                      }`}
                    >
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-xs font-semibold ${selected ? "text-cyan-300" : "text-slate-200"}`}
                          >
                            {item.title}
                          </p>
                          {item.minRole ? (
                            <span className="py-0.2 rounded border border-slate-700/60 bg-slate-800/80 px-1.5 font-mono text-[9px] tracking-wider text-slate-400 uppercase">
                              {item.minRole}
                            </span>
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-slate-400">
                          {item.subtitle}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="font-mono text-[10px] tracking-wider text-slate-400 uppercase">
                          {item.group}
                        </span>
                        {selected ? (
                          <span className="text-xs text-cyan-400">↵</span>
                        ) : null}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>

            {/* Footer / Instructions */}
            <div className="flex items-center justify-between border-t border-slate-800/80 bg-slate-900/60 px-4 py-2.5 text-[11px] text-slate-400">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-700 bg-slate-800/80 px-1 py-0.5 font-mono text-[10px] text-slate-300">
                    ↑↓
                  </kbd>{" "}
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-700 bg-slate-800/80 px-1 py-0.5 font-mono text-[10px] text-slate-300">
                    ↵
                  </kbd>{" "}
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="rounded border border-slate-700 bg-slate-800/80 px-1 py-0.5 font-mono text-[10px] text-slate-300">
                    esc
                  </kbd>{" "}
                  close
                </span>
              </div>
              <span className="font-mono text-[10px] text-slate-400">
                YTL Nexus
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
