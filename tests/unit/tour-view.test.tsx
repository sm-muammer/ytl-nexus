import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TourView } from "@/components/tour/tour-view";
import { contentFixtures } from "@/lib/fixtures/content";

const tourSteps = contentFixtures
  .filter((i) => i.type === "tour_step")
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

describe("TourView component", () => {
  it("renders the first tour step and step indicator", () => {
    render(<TourView steps={tourSteps} source="live" />);

    expect(screen.getByText(/Step 1 of 16/)).toBeInTheDocument();
    expect(screen.getByText("Welcome to YTL Nexus")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
  });

  it("navigates forward and backward through steps", () => {
    render(<TourView steps={tourSteps} source="demo" />);

    expect(screen.getByText("Demo data")).toBeInTheDocument();
    const prevBtn = screen.getByTestId("tour-prev");
    const nextBtn = screen.getByTestId("tour-next");

    expect(prevBtn).toBeDisabled();
    expect(nextBtn).toBeEnabled();

    // Click Next
    fireEvent.click(nextBtn);
    expect(screen.getByText(/Step 2 of 16/)).toBeInTheDocument();
    expect(
      screen.getByText("Nexus Command: Telemetry & Host Health"),
    ).toBeInTheDocument();
    expect(prevBtn).toBeEnabled();

    // Click Prev
    fireEvent.click(prevBtn);
    expect(screen.getByText(/Step 1 of 16/)).toBeInTheDocument();
    expect(screen.getByText("Welcome to YTL Nexus")).toBeInTheDocument();
    expect(prevBtn).toBeDisabled();
  });

  it("allows jumping directly to a step via stepper tabs", () => {
    render(<TourView steps={tourSteps} source="live" />);

    const step16Tab = screen.getByRole("tab", {
      name: /Go to step 16: Tour Complete/i,
    });
    fireEvent.click(step16Tab);

    expect(screen.getByText(/Step 16 of 16/)).toBeInTheDocument();
    expect(
      screen.getByText("Tour Complete: Ready for Exploration"),
    ).toBeInTheDocument();

    const nextBtn = screen.getByTestId("tour-next");
    expect(nextBtn).toBeDisabled();
    expect(nextBtn).toHaveTextContent("Completed");
  });

  it("toggles presenter mode", () => {
    render(<TourView steps={tourSteps} source="live" />);

    const tourContainer = document.querySelector("[data-tour-view]");
    expect(tourContainer).toHaveAttribute("data-presenter-mode", "false");

    const toggleBtn = screen.getByTestId("toggle-presenter-mode");
    fireEvent.click(toggleBtn);
    expect(tourContainer).toHaveAttribute("data-presenter-mode", "true");
    expect(screen.getByText("Exit Presenter Mode (Esc)")).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(tourContainer).toHaveAttribute("data-presenter-mode", "false");
  });
});
