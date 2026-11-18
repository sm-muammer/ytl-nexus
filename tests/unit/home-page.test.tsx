import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The WebGL particle logo draws on a canvas, which jsdom does not provide.
// Its behaviour is covered by unit tests on lib/motion/particle-logo and E2E tests.
vi.mock("@/components/home/particle-logo-loader", () => ({
  ParticleLogoLoader: () => null,
}));

import HomePage from "@/app/(public)/page";
import { MODULES, PUBLIC_MODULES } from "@/lib/navigation/modules";

describe("Home page", () => {
  it("names the product in the only level-one heading and shows the mono eyebrow and CTAs", () => {
    render(<HomePage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("YTL Nexus");
    expect(
      screen.getByText(/Internship project · YTL Communications/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Take the tour/i }),
    ).toHaveAttribute("href", "/tour");
    expect(
      screen.getByRole("link", { name: /How it fits together/i }),
    ).toHaveAttribute("href", "/platform");
  });

  it("presents static project facts derived from code rather than live metrics", () => {
    render(<HomePage />);

    const factsSection = screen.getByRole("region", {
      name: /project facts/i,
    });
    expect(
      within(factsSection).getByText(String(PUBLIC_MODULES.length)),
    ).toBeInTheDocument();
    expect(
      within(factsSection).getByText(/not live server telemetry/i),
    ).toBeInTheDocument();
    expect(
      within(factsSection).getByText(/Live \/ Demo labelled/i),
    ).toBeInTheDocument();
  });

  it("presents the project as an internship project of YTL Communications IT Infrastructure", () => {
    render(<HomePage />);

    expect(
      screen.getAllByText(
        /internship project.*YTL Communications IT Infrastructure/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/not an official YTL/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Read the project story/i }),
    ).toHaveAttribute("href", "/story");
  });

  it("lists every module in the bento grid by its Nexus name, each with a link and an access level", () => {
    render(<HomePage />);

    const list = screen.getByRole("list", { name: /^modules$/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(PUBLIC_MODULES.length);

    for (const entry of PUBLIC_MODULES) {
      const link = within(list).getByText(entry.name).closest("a");
      expect(link).not.toBeNull();
      expect(link).toHaveAttribute("href", entry.href);
      expect(within(link!).getByText(entry.summary)).toBeInTheDocument();
    }
    expect(within(list).getAllByText("Public").length).toBeGreaterThan(0);
    // Nexus Control is hidden: the home page does not announce it.
    expect(within(list).queryByText(/Nexus Control/)).toBeNull();
    expect(MODULES.filter((m) => m.hidden).map((m) => m.slug)).toEqual([
      "control",
    ]);
  });

  it("renders the three-tier architecture teaser linking to /platform", () => {
    render(<HomePage />);

    const teaser = screen.getByRole("region", {
      name: /how it fits together/i,
    });
    expect(within(teaser).getByText("Ingress")).toBeInTheDocument();
    expect(within(teaser).getByText("Nexus Core 01")).toBeInTheDocument();
    expect(within(teaser).getByText("Services")).toBeInTheDocument();
    expect(
      within(teaser).getByRole("link", {
        name: /Explore platform architecture/i,
      }),
    ).toHaveAttribute("href", "/platform");
  });

  it("credits Muammer as the builder in the hero and about disclosure", () => {
    render(<HomePage />);

    expect(screen.getAllByText(/Muammer/i).length).toBeGreaterThanOrEqual(2);
  });

  it("renders the atmosphere mode switcher and masked blueprint backdrop", () => {
    const { container } = render(<HomePage />);

    expect(container.querySelector("[data-home-blueprint]")).not.toBeNull();
    const group = screen.getByRole("group", { name: /atmosphere mode/i });
    expect(
      within(group).getByRole("button", { name: "Obsidian" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Blueprint" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "Daylight" }),
    ).toBeInTheDocument();
  });

  it("renders its own content only: the layout supplies the main landmark", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector("main")).toBeNull();
  });
});
