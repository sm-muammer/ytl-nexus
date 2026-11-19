"use client";

import { useEffect, useRef } from "react";

export interface ChapterTocItem {
  slug: string;
  title: string;
  tag: string;
}

export function ChapterToc({
  chapters,
}: {
  chapters: readonly ChapterTocItem[];
}) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav || chapters.length === 0) return;

    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a"));
    if (links.length === 0) return;

    const setActiveHref = (activeHref: string, toggleClass: boolean) => {
      for (const link of links) {
        const isCurrent = link.getAttribute("href") === activeHref;
        if (toggleClass) {
          link.classList.toggle("target-current", isCurrent);
        }
        link.setAttribute("aria-current", isCurrent ? "true" : "false");
      }
    };

    const supportsNative = (() => {
      if (typeof CSS === "undefined" || typeof CSS.supports !== "function") {
        return false;
      }
      if (!CSS.supports("scroll-target-group: auto")) return false;
      try {
        nav.querySelector("a:target-current");
        return true;
      } catch {
        return false;
      }
    })();

    if (supportsNative) {
      const syncNative = () => {
        const matched =
          nav.querySelector<HTMLAnchorElement>("a:target-current");
        const activeHref =
          matched?.getAttribute("href") ?? links[0]?.getAttribute("href") ?? "";
        setActiveHref(activeHref, false);
      };

      syncNative();
      document.addEventListener("scrollend", syncNative, { passive: true });
      window.addEventListener("hashchange", syncNative);
      nav.addEventListener("click", syncNative);
      return () => {
        document.removeEventListener("scrollend", syncNative);
        window.removeEventListener("hashchange", syncNative);
        nav.removeEventListener("click", syncNative);
      };
    }

    // Fallback for browsers without scroll-target-group / :target-current
    const firstHref = links[0]?.getAttribute("href") ?? "";
    setActiveHref(firstHref, true);

    if (typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    const sections = Array.from(
      document.querySelectorAll<HTMLElement>("[data-story-chapter]"),
    );
    if (sections.length === 0) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            if (id) {
              setActiveHref(`#${id}`, true);
            }
          }
        }
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );

    for (const section of sections) {
      observer.observe(section);
    }

    return () => observer.disconnect();
  }, [chapters]);

  return (
    <nav ref={navRef} aria-label="Story chapters" className="nx-story-toc">
      <p className="text-muted mb-3 font-mono text-xs tracking-[0.16em] uppercase">
        Chapters
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:gap-1.5 lg:overflow-visible lg:pb-0">
        {chapters.map((chapter, index) => {
          const num = String(index + 1).padStart(2, "0");
          return (
            <li key={chapter.slug} className="shrink-0 lg:shrink">
              <a
                href={`#chapter-${chapter.slug}`}
                className="border-line/70 text-muted hover:border-border-strong hover:text-ink flex min-h-11 items-center gap-3 rounded-lg border px-3.5 py-2 text-sm transition-[transform,background-color,border-color,color] duration-150 ease-out active:scale-[0.98]"
              >
                <span className="font-mono text-xs tabular-nums">{num}</span>
                <span className="min-w-0 truncate font-medium lg:whitespace-normal">
                  {chapter.title}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
