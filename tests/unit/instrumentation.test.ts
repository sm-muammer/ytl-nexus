import { afterEach, describe, expect, it, vi } from "vitest";
import { register } from "@/instrumentation";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("instrumentation register (start-up check)", () => {
  it("lets the server start with a valid NEXUS_MODE", () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit called");
    }) as never);
    expect(() => register()).not.toThrow();
    expect(exit).not.toHaveBeenCalled();
  });

  it("stops the server at start when NEXUS_MODE is invalid, naming the variable", () => {
    vi.stubEnv("NEXUS_MODE", "staging");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit called");
    }) as never);

    expect(() => register()).toThrowError("exit called");
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(error.mock.calls[0]?.[0])).toMatch(/NEXUS_MODE/);
  });

  it("fails the build with the same message instead of exiting", () => {
    vi.stubEnv("NEXUS_MODE", "");
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    const exit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("exit called");
    }) as never);

    expect(() => register()).toThrowError(/NEXUS_MODE/);
    expect(exit).not.toHaveBeenCalled();
  });
});
