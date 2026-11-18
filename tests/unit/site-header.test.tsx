import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  redirect: vi.fn(),
  notFound: vi.fn(),
  forbidden: vi.fn(),
}));

import { SiteHeader } from "@/components/layout/site-header";
import type { Actor } from "@/lib/roles";

describe("SiteHeader navigation", () => {
  it("renders brand, global nav links, atmosphere switcher, search and sign in for a live visitor", () => {
    const { container } = render(<SiteHeader mode="live" actor={null} />);

    // Brand landmark
    const brandLink = screen.getByRole("link", { name: /YTL Nexus, home/i });
    expect(brandLink).toHaveAttribute("href", "/");

    // Primary navigation links in global nav
    const globalNav = screen.getByRole("navigation", { name: /Global/i });
    expect(globalNav).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform" })).toHaveAttribute(
      "href",
      "/platform",
    );
    expect(screen.getByRole("link", { name: "Status" })).toHaveAttribute(
      "href",
      "/status",
    );
    expect(screen.getByRole("link", { name: "Library" })).toHaveAttribute(
      "href",
      "/library",
    );
    expect(screen.getByRole("link", { name: "Tour" })).toHaveAttribute(
      "href",
      "/tour",
    );
    expect(screen.getByRole("link", { name: "Story" })).toHaveAttribute(
      "href",
      "/story",
    );
    expect(screen.getByRole("link", { name: "Yes" })).toHaveAttribute(
      "href",
      "/yes",
    );

    // Atmosphere switcher header toggle is removed per user request
    const atmosphereToggle = container.querySelector(
      "[data-atmosphere-toggle]",
    );
    expect(atmosphereToggle).toBeNull();

    // Command palette trigger
    const commandTrigger = container.querySelector(
      "[data-command-palette-trigger]",
    );
    expect(commandTrigger).not.toBeNull();

    // Sign in link for visitors in live mode
    expect(screen.getByRole("link", { name: /Sign in/i })).toHaveAttribute(
      "href",
      "/signin",
    );

    // NavSheet triggers
    expect(
      screen.getByRole("button", { name: /All modules/i }),
    ).toBeInTheDocument();
  });

  it("renders demo session strip for demo visitors without indicator dots", () => {
    const { container } = render(<SiteHeader mode="demo" actor={null} />);

    const sessionBtn = container.querySelector("[data-session-label]");
    expect(sessionBtn).not.toBeNull();
    expect(sessionBtn).toHaveTextContent("Demo session");
    expect(sessionBtn).toHaveTextContent("Not signed in");
    // Indicator dot must not be present
    expect(
      sessionBtn?.querySelector(".bg-accent-ink, .bg-pink-ink"),
    ).toBeNull();
  });

  it("renders session button for signed-in actors without indicator dots", () => {
    const actor: Actor = { userId: "u-admin", role: "admin" };
    const { container } = render(<SiteHeader mode="live" actor={actor} />);

    const sessionBtn = container.querySelector("[data-session-label]");
    expect(sessionBtn).not.toBeNull();
    expect(sessionBtn).toHaveTextContent("Signed in");
    expect(sessionBtn).toHaveTextContent("Administrator");
    // Indicator dot must not be present
    expect(
      sessionBtn?.querySelector(".bg-accent-ink, .bg-pink-ink"),
    ).toBeNull();
  });
});
