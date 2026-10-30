import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("Home page (platform baseline)", () => {
  it("names the product in the only level-one heading", () => {
    render(<HomePage />);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("YTL Nexus");
  });

  it("presents the project as an internship project of YTL Communications IT Infrastructure", () => {
    render(<HomePage />);

    expect(
      screen.getByText(
        /internship project.*YTL Communications IT Infrastructure/i,
      ),
    ).toBeInTheDocument();
  });

  it("lists the planned modules by their Nexus names", () => {
    render(<HomePage />);

    const list = screen.getByRole("list", { name: /planned modules/i });
    const items = within(list).getAllByRole("listitem");
    const names = items.map((item) => item.textContent);

    expect(names).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Nexus Command"),
        expect.stringContaining("Nexus AI"),
        expect.stringContaining("Nexus Transfer"),
        expect.stringContaining("Nexus Mail"),
        expect.stringContaining("Yes Experience"),
      ]),
    );
  });
});
