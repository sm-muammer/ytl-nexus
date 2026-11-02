import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "@/components/brand/logo";
import { StatusBadge } from "@/components/ui/status-badge";
import { MIN_LOGO_HEIGHT } from "@/lib/brand/catalog";

describe("Logo", () => {
  it("renders the named asset with its alt text", () => {
    render(<Logo slug="ytl-communications-left-main-colour" height={40} />);
    const img = screen.getByRole("img", {
      name: "YTL Communications, left logo, main colour",
    });
    expect(img).toHaveAttribute(
      "src",
      expect.stringContaining("ytl-communications-left-main-colour.svg"),
    );
  });

  it("never renders below the 31 px screen floor", () => {
    render(<Logo slug="yes-logomark-pink" height={12} />);
    const img = screen.getByRole("img", { name: "Yes logomark, pink" });
    expect(Number(img.getAttribute("height"))).toBeGreaterThanOrEqual(
      MIN_LOGO_HEIGHT,
    );
  });

  it("derives width from the aspect ratio so the logo is never stretched", () => {
    render(<Logo slug="ytl-communications-left-main-colour" height={50} />);
    const img = screen.getByRole("img");
    const ratio =
      Number(img.getAttribute("width")) / Number(img.getAttribute("height"));
    expect(ratio).toBeCloseTo(3722 / 760, 1);
  });
});

describe("StatusBadge", () => {
  it.each([
    ["ok", "Healthy"],
    ["warn", "Degraded"],
    ["bad", "Down"],
  ] as const)(
    "shows %s as text plus a hidden icon, not colour alone",
    (status, label) => {
      const { container } = render(<StatusBadge status={status} />);
      expect(screen.getByText(label)).toBeInTheDocument();
      const icon = container.querySelector("svg");
      expect(icon).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
    },
  );
});
