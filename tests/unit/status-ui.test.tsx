import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { demoIncidents } from "@/lib/fixtures/status";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

import {
  IncidentList,
  IncidentProgressSteps,
  IncidentStateBadge,
} from "@/components/status/status-parts";
import {
  CopyTicketButton,
  IncidentTicketLookup,
} from "@/components/status/ticket-controls";

beforeEach(() => {
  pushMock.mockReset();
});

describe("IncidentTicketLookup", () => {
  it("normalizes a valid ticket number and routes to its tracking page", () => {
    render(<IncidentTicketLookup />);
    const input = screen.getByLabelText(/ticket number/i);
    fireEvent.change(input, { target: { value: " #inc-2026-0002 " } });
    fireEvent.submit(input.closest("form")!);
    expect(pushMock).toHaveBeenCalledWith("/status/incidents/INC-2026-0002");
  });

  it("shows a validation error and does not navigate on an invalid ticket number", () => {
    render(<IncidentTicketLookup />);
    const input = screen.getByLabelText(/ticket number/i);
    fireEvent.change(input, { target: { value: "not-a-ticket" } });
    fireEvent.submit(input.closest("form")!);
    expect(pushMock).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(/INC-YYYY-NNNN/i);
  });
});

describe("CopyTicketButton", () => {
  it("renders the ticket copy button and announces copy feedback", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<CopyTicketButton ticketNo="INC-2026-0002" />);
    const btn = screen.getByRole("button", { name: /copy ticket/i });
    fireEvent.click(btn);
    expect(writeText).toHaveBeenCalledWith("INC-2026-0002");
    expect(await screen.findByText("Copied INC-2026-0002")).toBeInTheDocument();
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });
});

describe("IncidentList & tracking badges", () => {
  it("renders ticket number links, state badges, and progress steps", () => {
    const incidents = demoIncidents(Date.UTC(2026, 10, 11, 8, 0, 0));
    const { container } = render(<IncidentList incidents={incidents} />);

    for (const inc of incidents) {
      const item = container.querySelector(`li[data-ticket="${inc.ticketNo}"]`);
      expect(item).not.toBeNull();
      const link = screen.getByRole("link", {
        name: new RegExp(inc.ticketNo),
      });
      expect(link).toHaveAttribute("href", `/status/incidents/${inc.ticketNo}`);
    }

    render(<IncidentStateBadge state="monitoring" />);
    expect(screen.getAllByText("Monitoring").length).toBeGreaterThan(0);

    render(<IncidentProgressSteps state="investigating" />);
    const active = screen.getByText("Investigating", {
      selector: '[aria-current="step"] *',
    });
    expect(active).toBeInTheDocument();
  });
});
