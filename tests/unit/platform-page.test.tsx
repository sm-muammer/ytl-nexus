import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Ambient particle canvas is mocked in JSDOM unit tests
vi.mock("@/components/motion/ambient-field", () => ({
  AmbientField: () => null,
}));

import PlatformPage from "@/app/(public)/platform/page";

describe("Platform page (/platform)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXUS_MODE", "demo");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });
  it("renders the primary heading and subtitle", async () => {
    const jsx = await PlatformPage();
    render(jsx);

    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Platform");
    expect(screen.getByText("How YTL Nexus fits together")).toBeInTheDocument();
  });

  it("does not render any 'Not available yet' stub notice", async () => {
    const jsx = await PlatformPage();
    render(jsx);

    expect(screen.queryByText(/Not available yet/i)).toBeNull();
    expect(screen.queryByText(/task \d+ of 22 in the build plan/i)).toBeNull();
    expect(document.querySelector("[data-stub-notice]")).toBeNull();
  });

  it("describes the single-host architecture and Apache ingress topology", async () => {
    const jsx = await PlatformPage();
    render(jsx);

    // Mentions the single host Nexus Core 01
    expect(screen.getAllByText(/Nexus Core 01/i).length).toBeGreaterThan(0);
    // Mentions Apache reverse proxy
    expect(screen.getAllByText(/Apache/i).length).toBeGreaterThan(0);
    // Mentions loopback isolation
    expect(
      screen.getAllByText(/127\.0\.0\.1|loopback/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders the 6 core trust boundaries", async () => {
    const jsx = await PlatformPage();
    render(jsx);

    const boundarySection = screen.getByRole("region", {
      name: /the six core trust boundaries/i,
    });
    expect(boundarySection).toBeInTheDocument();

    // Verify key boundaries mentioned
    expect(
      within(boundarySection).getByText(/Network & Ingress/i),
    ).toBeInTheDocument();
    expect(
      within(boundarySection).getByText(/Reverse Proxy & Gateway/i),
    ).toBeInTheDocument();
    expect(
      within(boundarySection).getByText(/Application Authorization/i),
    ).toBeInTheDocument();
    expect(
      within(boundarySection).getByText(/System Operations/i),
    ).toBeInTheDocument();
    expect(
      within(boundarySection).getByText(/Data Isolation/i),
    ).toBeInTheDocument();
    expect(
      within(boundarySection).getByText(/Root Timers & Scans/i),
    ).toBeInTheDocument();
  });

  it("renders the runtime services inventory", async () => {
    const jsx = await PlatformPage();
    render(jsx);

    const servicesSection = screen.getByRole("region", {
      name: /runtime services inventory/i,
    });
    expect(servicesSection).toBeInTheDocument();

    // Key services must be listed
    expect(
      within(servicesSection).getAllByText(/nexus-web/i).length,
    ).toBeGreaterThan(0);
    expect(
      within(servicesSection).getAllByText(/MariaDB/i).length,
    ).toBeGreaterThan(0);
    expect(
      within(servicesSection).getAllByText(/Prometheus & Exporters/i).length,
    ).toBeGreaterThan(0);
    expect(
      within(servicesSection).getAllByText(/Ollama Local AI/i).length,
    ).toBeGreaterThan(0);
    expect(
      within(servicesSection).getAllByText(/SFTPGo/i).length,
    ).toBeGreaterThan(0);
    expect(
      within(servicesSection).getAllByText(/nexus-ops/i).length,
    ).toBeGreaterThan(0);
  });

  it("renders subsystem health statuses with live/demo labels", async () => {
    const jsx = await PlatformPage();
    render(jsx);

    const healthSection = screen.getByRole("region", {
      name: /subsystem health/i,
    });
    expect(healthSection).toBeInTheDocument();
    expect(
      document.querySelectorAll("[data-live-demo]").length,
    ).toBeGreaterThan(0);
  });

  it("renders the 16 platform modules categorized with access badges", async () => {
    const jsx = await PlatformPage();
    render(jsx);

    const modulesSection = screen.getByRole("region", {
      name: /16 unified platform modules/i,
    });
    expect(modulesSection).toBeInTheDocument();

    // Contains links to key modules
    expect(
      within(modulesSection).getByRole("link", { name: /Nexus Tour/i }),
    ).toHaveAttribute("href", "/tour");
    expect(
      within(modulesSection).getByRole("link", { name: /Nexus Atlas/i }),
    ).toHaveAttribute("href", "/command/atlas");
    expect(
      within(modulesSection).getByRole("link", { name: /Nexus Status/i }),
    ).toHaveAttribute("href", "/status");
    expect(
      within(modulesSection).getByRole("link", { name: /Nexus Shield/i }),
    ).toHaveAttribute("href", "/shield");
  });
});
