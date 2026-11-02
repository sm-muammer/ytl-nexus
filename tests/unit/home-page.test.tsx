import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The ambient particle field draws on a canvas, which jsdom does not provide.
// Its behaviour is covered by the end-to-end tests.
vi.mock("@/components/motion/ambient-field", () => ({
  AmbientField: () => null,
}));

import HomePage from "@/app/(public)/page";
import { MODULES } from "@/lib/navigation/modules";

describe("Home page", () => {
  it("names the product in the only level-one heading", () => {
    render(<HomePage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("YTL Nexus");
  });

  it("presents the project as an internship project of YTL Communications IT Infrastructure", () => {
    render(<HomePage />);

    expect(
      screen.getAllByText(
        /internship project.*YTL Communications IT Infrastructure/i,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/not an official YTL/i)).toBeInTheDocument();
  });

  it("lists every module by its Nexus name, each with a link and an access level", () => {
    render(<HomePage />);

    const list = screen.getByRole("list", { name: /^modules$/i });
    const items = within(list).getAllByRole("listitem");
    expect(items).toHaveLength(MODULES.length);

    for (const entry of MODULES) {
      const link = within(list).getByRole("link", {
        name: new RegExp(entry.name, "i"),
      });
      expect(link).toHaveAttribute("href", entry.href);
    }
    expect(within(list).getAllByText("Public").length).toBeGreaterThan(0);
    expect(within(list).getAllByText(/Administrator/).length).toBeGreaterThan(
      0,
    );
  });

  it("renders its own content only: the layout supplies the main landmark", () => {
    const { container } = render(<HomePage />);
    expect(container.querySelector("main")).toBeNull();
  });
});
