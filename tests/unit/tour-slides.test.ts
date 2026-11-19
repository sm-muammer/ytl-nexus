import { describe, expect, it } from "vitest";
import { contentFixtures } from "@/lib/fixtures/content";
import type { ContentItem } from "@/lib/content/types";
import {
  TOUR_CHAPTERS,
  getTourSlideMeta,
  parseInitialTourStep,
} from "@/lib/tour/slides";

const tourSteps = contentFixtures
  .filter((i) => i.type === "tour_step")
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

describe("tour slide metadata registry", () => {
  it("provides curated metadata for all 16 tour_step fixtures", () => {
    expect(tourSteps).toHaveLength(16);

    const chaptersSeen = new Set<string>();
    tourSteps.forEach((step, idx) => {
      const meta = getTourSlideMeta(step, idx);
      expect(meta.slug).toBe(step.slug);
      expect(TOUR_CHAPTERS).toContain(meta.chapter);
      chaptersSeen.add(meta.chapter);
      expect(["blue", "pink", "violet"]).toContain(meta.accent);
      expect(meta.highlights).toHaveLength(3);
      for (const bullet of meta.highlights) {
        expect(bullet.trim().length).toBeGreaterThan(8);
      }
      expect(meta.preview).toBeDefined();
      expect(meta.preview.badge.trim().length).toBeGreaterThan(0);
    });

    for (const chapter of TOUR_CHAPTERS) {
      expect(chaptersSeen.has(chapter)).toBe(true);
    }
  });

  it("never exposes the hidden /control route on step 14", () => {
    const controlIdx = tourSteps.findIndex((s) => s.slug === "tour-14-control");
    expect(controlIdx).toBeGreaterThanOrEqual(0);
    const controlStep = tourSteps[controlIdx]!;
    const meta = getTourSlideMeta(controlStep, controlIdx);

    expect(meta.moduleHref).toBeNull();
    expect(meta.moduleLabel).toBeNull();
    expect(meta.minRole).toBe("admin");
    expect(meta.hiddenNote).toMatch(/administrator/i);
  });

  it("falls back cleanly for unknown future WordPress tour_step slugs", () => {
    const customStep: ContentItem = {
      id: 999,
      type: "tour_step",
      slug: "tour-99-custom-future-module",
      title: "Custom Future Step",
      excerpt: "A step authored later in WordPress.",
      html: "<p>A step authored later in WordPress.</p>",
      audience: "public",
      businessUnit: null,
      relatedService: "nexus-custom",
      sourceUrl: null,
      order: 99,
      modified: "2026-11-19T00:00:00.000Z",
    };

    const meta = getTourSlideMeta(customStep, 16);
    expect(meta.slug).toBe(customStep.slug);
    expect(TOUR_CHAPTERS).toContain(meta.chapter);
    expect(meta.highlights).toHaveLength(3);
    expect(meta.preview.kind).toBeTruthy();
  });

  it("never contains internal hostnames or IPs in curated slide metadata", () => {
    tourSteps.forEach((step, idx) => {
      const meta = getTourSlideMeta(step, idx);
      const serialized = JSON.stringify(meta);
      expect(serialized).not.toContain("10.26.64.164");
      expect(serialized).not.toContain("sn1lyvx1d0002");
    });
  });
});

describe("parseInitialTourStep", () => {
  it("parses valid 1-based step query parameters to 0-based indices", () => {
    expect(parseInitialTourStep("1", 16)).toBe(0);
    expect(parseInitialTourStep("5", 16)).toBe(4);
    expect(parseInitialTourStep("16", 16)).toBe(15);
  });

  it("clamps and sanitizes invalid, missing, array or out-of-range inputs", () => {
    expect(parseInitialTourStep(undefined, 16)).toBe(0);
    expect(parseInitialTourStep("0", 16)).toBe(0);
    expect(parseInitialTourStep("-3", 16)).toBe(0);
    expect(parseInitialTourStep("abc", 16)).toBe(0);
    expect(parseInitialTourStep("99", 16)).toBe(15);
    expect(parseInitialTourStep(["5", "9"], 16)).toBe(4);
    expect(parseInitialTourStep(["not-a-number"], 16)).toBe(0);
    expect(parseInitialTourStep("5", 0)).toBe(0);
  });
});
