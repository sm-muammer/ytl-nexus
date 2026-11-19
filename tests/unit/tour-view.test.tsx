import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { TourView } from "@/components/tour/tour-view";
import { contentFixtures } from "@/lib/fixtures/content";

const tourSteps = contentFixtures
  .filter((i) => i.type === "tour_step")
  .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

beforeAll(() => {
  if (typeof HTMLDialogElement !== "undefined") {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    };
  }
});

beforeEach(() => {
  window.history.replaceState(null, "", "/tour");
});

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

  it("opens directly at initialStep with visual preview stage and 3 key highlights", () => {
    const { container } = render(
      <TourView steps={tourSteps} source="live" initialStep={4} />,
    );

    expect(screen.getByText(/Step 5 of 16/)).toBeInTheDocument();
    expect(
      screen.getByText("Nexus AI: Grounded Local Intelligence"),
    ).toBeInTheDocument();

    const visualStage = container.querySelector("[data-tour-visual]");
    expect(visualStage).not.toBeNull();

    const highlights = container.querySelectorAll("[data-tour-highlight]");
    expect(highlights).toHaveLength(3);
  });

  it("syncs URL query parameter only on user navigation and cleans ?step on step 1", () => {
    render(<TourView steps={tourSteps} source="live" />);

    // Initial render at step 1 keeps /tour clean without ?step=1
    expect(window.location.pathname).toBe("/tour");
    expect(window.location.search).toBe("");

    fireEvent.click(screen.getByTestId("tour-next"));
    expect(window.location.search).toBe("?step=2");

    fireEvent.click(screen.getByTestId("tour-prev"));
    expect(window.location.search).toBe("");
  });

  it("supports jumping across chapters via the chapter quick-jump rail", () => {
    render(<TourView steps={tourSteps} source="live" />);

    const chapterNav = screen.getByRole("navigation", {
      name: /Tour chapters/i,
    });

    fireEvent.click(within(chapterNav).getByRole("button", { name: "Assure" }));
    expect(screen.getByText(/Step 11 of 16/)).toBeInTheDocument();
    expect(
      screen.getByText("Nexus Continuity: Verified Backups & Drills"),
    ).toBeInTheDocument();

    fireEvent.click(
      within(chapterNav).getByRole("button", { name: "Services" }),
    );
    expect(screen.getByText(/Step 5 of 16/)).toBeInTheDocument();

    fireEvent.click(within(chapterNav).getByRole("button", { name: "Govern" }));
    expect(screen.getByText(/Step 14 of 16/)).toBeInTheDocument();
  });

  it("opens slide overview dialog via button or G key and jumps to selected slide", () => {
    render(<TourView steps={tourSteps} source="live" />);

    const openBtn = screen.getByTestId("tour-overview-open");
    fireEvent.click(openBtn);

    const dialog = document.querySelector(
      "dialog[data-tour-overview]",
    ) as HTMLDialogElement | null;
    expect(dialog).not.toBeNull();
    expect(dialog).toHaveAttribute("open");

    const step12Tile = within(dialog!).getByRole("button", {
      name: /12.*Nexus Shield: Security Posture Assessment/i,
    });
    fireEvent.click(step12Tile);

    expect(dialog).not.toHaveAttribute("open");
    expect(screen.getByText(/Step 12 of 16/)).toBeInTheDocument();
    expect(
      screen.getByText("Nexus Shield: Security Posture Assessment"),
    ).toBeInTheDocument();

    // Open again via keyboard 'g'
    fireEvent.keyDown(window, { key: "g" });
    expect(dialog).toHaveAttribute("open");
  });

  it("supports Home/End keys and keeps Presenter Mode open when Escape closes the overview dialog", () => {
    render(<TourView steps={tourSteps} source="live" />);

    fireEvent.keyDown(window, { key: "End" });
    expect(screen.getByText(/Step 16 of 16/)).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Home" });
    expect(screen.getByText(/Step 1 of 16/)).toBeInTheDocument();

    // Enter Presenter Mode
    fireEvent.keyDown(window, { key: "p" });
    const tourContainer = document.querySelector("[data-tour-view]");
    expect(tourContainer).toHaveAttribute("data-presenter-mode", "true");

    // Open Overview dialog while in Presenter Mode
    fireEvent.keyDown(window, { key: "g" });
    const dialog = document.querySelector(
      "dialog[data-tour-overview]",
    ) as HTMLDialogElement | null;
    expect(dialog).toHaveAttribute("open");

    // First Escape while dialog is open must not exit Presenter Mode; browser closes the dialog
    fireEvent.keyDown(window, { key: "Escape" });
    act(() => {
      fireEvent(dialog!, new Event("cancel"));
      dialog!.close();
    });
    expect(dialog).not.toHaveAttribute("open");
    expect(tourContainer).toHaveAttribute("data-presenter-mode", "true");

    // Second Escape exits Presenter Mode
    fireEvent.keyDown(window, { key: "Escape" });
    expect(tourContainer).toHaveAttribute("data-presenter-mode", "false");
  });

  it("shows module links where safe, hides /control on step 14, and provides Restart tour on step 16", () => {
    render(<TourView steps={tourSteps} source="live" initialStep={1} />);

    // Step 2 links to /command
    expect(
      screen.getByRole("link", { name: /Open Nexus Command/i }),
    ).toHaveAttribute("href", "/command");

    // Jump to Step 14 (Nexus Control)
    const step14Tab = screen.getByRole("tab", {
      name: /Go to step 14: Nexus Control/i,
    });
    fireEvent.click(step14Tab);
    expect(screen.queryByRole("link", { name: /control/i })).toBeNull();
    expect(
      document.querySelector('a[href="/control"]'),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Hidden control plane · Administrator only/i),
    ).toBeInTheDocument();

    // Jump to Step 16 (Tour Complete) and click Restart tour
    const step16Tab = screen.getByRole("tab", {
      name: /Go to step 16: Tour Complete/i,
    });
    fireEvent.click(step16Tab);
    const restartBtn = screen.getByTestId("tour-restart");
    fireEvent.click(restartBtn);
    expect(screen.getByText(/Step 1 of 16/)).toBeInTheDocument();
    expect(screen.getByText("Welcome to YTL Nexus")).toBeInTheDocument();
  });
});
