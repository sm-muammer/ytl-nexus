import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnvironmentBadge } from "@/components/ui/environment-badge";
import { LiveDemoLabel } from "@/components/ui/live-demo-label";

describe("LiveDemoLabel", () => {
  it("labels fixture values as Demo data", () => {
    render(<LiveDemoLabel source="demo" />);
    const label = screen.getByText("Demo data");
    expect(label).toHaveAttribute("data-source", "demo");
  });

  it("labels real values as Live", () => {
    render(<LiveDemoLabel source="live" />);
    expect(screen.getByText("Live")).toHaveAttribute("data-source", "live");
  });

  it("supports the short Demo wording for tight spaces", () => {
    render(<LiveDemoLabel source="demo" short />);
    expect(screen.getByText("Demo")).toBeInTheDocument();
  });
});

describe("EnvironmentBadge", () => {
  it("states Demo mode", () => {
    render(<EnvironmentBadge mode="demo" />);
    expect(screen.getByText("Demo mode")).toHaveAttribute("data-mode", "demo");
  });

  it("states Live mode", () => {
    render(<EnvironmentBadge mode="live" />);
    expect(screen.getByText("Live mode")).toHaveAttribute("data-mode", "live");
  });
});
