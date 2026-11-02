import { afterEach, describe, expect, it, vi } from "vitest";
import { getMode, readMode } from "@/lib/server/mode";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("readMode", () => {
  it.each(["live", "demo"] as const)("accepts %s", (value) => {
    expect(readMode({ NEXUS_MODE: value })).toBe(value);
  });

  it.each([
    undefined,
    "",
    " demo",
    "demo ",
    "Demo",
    "LIVE",
    "production",
    "true",
    "0",
  ])("rejects %j with an error that names NEXUS_MODE and both values", (v) => {
    const run = () => readMode({ NEXUS_MODE: v });
    expect(run).toThrowError(/NEXUS_MODE/);
    expect(run).toThrowError(/"live"/);
    expect(run).toThrowError(/"demo"/);
  });

  it("does not echo the rejected value into the error message", () => {
    expect(() => readMode({ NEXUS_MODE: "s3cr3t-value" })).not.toThrowError(
      /s3cr3t-value/,
    );
  });
});

describe("getMode", () => {
  it("reads NEXUS_MODE from the process environment", () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    expect(getMode()).toBe("demo");
    vi.stubEnv("NEXUS_MODE", "live");
    expect(getMode()).toBe("live");
  });

  it("refuses to run when NEXUS_MODE is unset", () => {
    vi.stubEnv("NEXUS_MODE", "");
    expect(() => getMode()).toThrowError(/NEXUS_MODE/);
  });
});
