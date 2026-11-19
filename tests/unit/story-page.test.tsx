import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { contentFixtures } from "@/lib/fixtures/content";
import { MODULES } from "@/lib/navigation/modules";
import { ADAPTER_NAMES } from "@/lib/server/adapters/types";
import { SHIELD_CHECKS } from "@/lib/shield/model";
import { BACKUP_COMPONENTS } from "@/lib/continuity/model";

const { mockGetActor, mockListContent } = vi.hoisted(() => ({
  mockGetActor: vi.fn(),
  mockListContent: vi.fn(),
}));

vi.mock("@/components/motion/ambient-field", () => ({
  AmbientField: () => null,
}));

vi.mock("@/lib/server/session", () => ({
  getActor: mockGetActor,
}));

vi.mock("@/lib/server/content", () => ({
  listContent: mockListContent,
}));

import StoryPage from "@/app/(public)/story/page";
import * as dossier from "@/lib/story/dossier";

const storyFixtures = contentFixtures
  .filter((i) => i.type === "story_chapter")
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

describe("Project Story page (/story)", () => {
  beforeEach(() => {
    mockGetActor.mockResolvedValue(null);
    mockListContent.mockResolvedValue({
      ok: true,
      source: "live",
      items: storyFixtures,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the single H1, subtitle, Muammer credit, and mandatory internship disclaimer (STORY-03)", async () => {
    const jsx = await StoryPage();
    render(jsx);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Project Story");
    expect(screen.getByText("The internship case study")).toBeInTheDocument();

    expect(screen.getAllByText(/Muammer/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/APU Malaysia/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/YTL Communications IT Infrastructure/i).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText(
        /YTL Nexus is an internship project, not an official YTL commercial product/i,
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders all 6 ordered story chapters with current v1.0.0+ platform facts", async () => {
    const jsx = await StoryPage();
    const { container } = render(jsx);

    const articles = container.querySelectorAll("article[data-story-chapter]");
    expect(articles).toHaveLength(6);

    expect(
      screen.getByRole("heading", { level: 2, name: /The Starting Point/i }),
    ).toBeInTheDocument();

    const text = container.textContent ?? "";
    expect(text).toMatch(/8.*adapters|dual-mode/i);
    expect(text).toMatch(/5 isolated MariaDB|five isolated/i);
    expect(text).toMatch(/\/account/);
    expect(text).toMatch(/3D WebGL|Three\.js/i);
    expect(text).toMatch(/Obsidian/i);
    expect(text).toMatch(/Blueprint/i);
    expect(text).toMatch(/Daylight/i);
    expect(text).toContain("gemma3:1b-it-qat");
    expect(text).toMatch(/11.*Nexus Shield|11 host security/i);
    expect(text).toMatch(/9.*components/i);
    expect(text).toContain("Logesh");
    expect(text).toContain("Azlin");
    expect(text).toContain("Sonu");
  });

  it("shows Live label for live WordPress items and Demo data label for demo items", async () => {
    const liveJsx = await StoryPage();
    const { unmount } = render(liveJsx);

    const liveBadge = document.querySelector("[data-live-demo]");
    expect(liveBadge).not.toBeNull();
    expect(liveBadge).toHaveAttribute("data-source", "live");
    expect(screen.getByText("Live")).toBeInTheDocument();
    unmount();

    mockListContent.mockResolvedValue({
      ok: true,
      source: "demo",
      items: storyFixtures,
    });
    const demoJsx = await StoryPage();
    render(demoJsx);

    const demoBadge = document.querySelector("[data-live-demo]");
    expect(demoBadge).not.toBeNull();
    expect(demoBadge).toHaveAttribute("data-source", "demo");
    expect(screen.getByText("Demo data")).toBeInTheDocument();
  });

  it("falls back cleanly to deterministic fixtures with Demo data label when WordPress is unavailable or empty", async () => {
    mockListContent.mockResolvedValue({ ok: false, source: "live" });
    const unavailableJsx = await StoryPage();
    const { container, unmount } = render(unavailableJsx);

    expect(
      screen.queryByText(/The content service is not reachable right now/i),
    ).toBeNull();
    expect(
      container.querySelectorAll("article[data-story-chapter]"),
    ).toHaveLength(6);
    expect(document.querySelector("[data-live-demo]")).toHaveAttribute(
      "data-source",
      "demo",
    );
    expect(screen.getByText("Demo data")).toBeInTheDocument();
    unmount();

    mockListContent.mockResolvedValue({ ok: true, source: "live", items: [] });
    const emptyJsx = await StoryPage();
    const { container: emptyContainer } = render(emptyJsx);

    expect(
      emptyContainer.querySelectorAll("article[data-story-chapter]"),
    ).toHaveLength(6);
    expect(document.querySelector("[data-live-demo]")).toHaveAttribute(
      "data-source",
      "demo",
    );
  });

  it("renders the static Project dossier region with code-derived counts labelled as static facts", async () => {
    const jsx = await StoryPage();
    render(jsx);

    const dossierRegion = screen.getByRole("region", {
      name: /project dossier/i,
    });
    expect(
      within(dossierRegion).getByText(/not live server telemetry/i),
    ).toBeInTheDocument();
    expect(
      within(dossierRegion).getByText(String(MODULES.length + 1)),
    ).toBeInTheDocument();
    expect(
      within(dossierRegion).getByText(String(ADAPTER_NAMES.length)),
    ).toBeInTheDocument();
    expect(
      within(dossierRegion).getByText(String(SHIELD_CHECKS.length)),
    ).toBeInTheDocument();
    expect(
      within(dossierRegion).getByText(String(BACKUP_COMPONENTS.length)),
    ).toBeInTheDocument();
  });

  it("renders the Before & After greenfield comparison region", async () => {
    const jsx = await StoryPage();
    render(jsx);

    const comparison = screen.getByRole("region", {
      name: /before.*after|greenfield/i,
    });
    expect(
      within(comparison).getByText(/Legacy Prototype State/i),
    ).toBeInTheDocument();
    expect(
      within(comparison).getByText(/YTL Nexus v1\.0\.0/i),
    ).toBeInTheDocument();
  });

  it("links the Story chapters table of contents directly to matching focusable chapter articles", async () => {
    const jsx = await StoryPage();
    const { container } = render(jsx);

    const tocNav = screen.getByRole("navigation", { name: "Story chapters" });
    const links = within(tocNav).getAllByRole("link");
    expect(links).toHaveLength(storyFixtures.length);

    for (const chapter of storyFixtures) {
      const link = links.find(
        (el) => el.getAttribute("href") === `#chapter-${chapter.slug}`,
      );
      expect(link).toBeDefined();
      const target = container.querySelector(`#chapter-${chapter.slug}`);
      expect(target).not.toBeNull();
      expect(target?.tagName.toLowerCase()).toBe("article");
      expect(target).toHaveAttribute("tabindex", "-1");
    }
  });

  it("renders the Handover & Team Ownership region listing Logesh, Azlin, Sonu, and Muammer", async () => {
    const jsx = await StoryPage();
    render(jsx);

    const handover = screen.getByRole("region", {
      name: /handover|team ownership/i,
    });
    expect(within(handover).getByText(/Logesh/)).toBeInTheDocument();
    expect(within(handover).getByText(/Azlin/)).toBeInTheDocument();
    expect(within(handover).getByText(/Sonu/)).toBeInTheDocument();
    expect(within(handover).getByText(/Muammer/)).toBeInTheDocument();
  });

  it("renders Continue exploring links to /tour, /platform, /library, and /yes", async () => {
    const jsx = await StoryPage();
    render(jsx);

    const continueSection = screen.getByRole("region", {
      name: /continue exploring/i,
    });
    expect(
      within(continueSection).getByRole("link", { name: /Nexus Tour|Tour/i }),
    ).toHaveAttribute("href", "/tour");
    expect(
      within(continueSection).getByRole("link", { name: /Platform/i }),
    ).toHaveAttribute("href", "/platform");
    expect(
      within(continueSection).getByRole("link", {
        name: /Nexus Library|Library/i,
      }),
    ).toHaveAttribute("href", "/library");
    expect(
      within(continueSection).getByRole("link", { name: /Yes Experience/i }),
    ).toHaveAttribute("href", "/yes");
  });

  it("never exposes internal hostnames, internal IPs, or hidden control paths", async () => {
    const jsx = await StoryPage();
    const { container } = render(jsx);

    const pageHtml = container.innerHTML;
    const serializedDossier = JSON.stringify(dossier);

    for (const payload of [pageHtml, serializedDossier]) {
      expect(payload).not.toContain("10.26.64.164");
      expect(payload).not.toContain("sn1lyvx1d0002");
      expect(payload).not.toContain("/control");
    }
  });

  it("renders its own content only without a nested <main> landmark", async () => {
    const jsx = await StoryPage();
    const { container } = render(jsx);

    expect(container.querySelector("main")).toBeNull();
  });
});
