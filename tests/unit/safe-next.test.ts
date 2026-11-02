import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/server/auth/safe-next";

describe("safeNext", () => {
  it("keeps a plain site path, with its query", () => {
    expect(safeNext("/command")).toBe("/command");
    expect(safeNext("/command/services?x=1")).toBe("/command/services?x=1");
  });

  it("falls back to the home page for anything that could leave the site", () => {
    const bad = [
      undefined,
      null,
      "",
      "command",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "\\\\evil.example",
      "https://evil.example",
      "javascript:alert(1)",
      "/ok\r\nSet-Cookie: x=1",
      "/ok\u0000",
      "/" + "a".repeat(600),
      ["/command"],
      42,
    ];
    for (const value of bad) expect(safeNext(value)).toBe("/");
  });

  it("never sends someone back to the sign-in page", () => {
    expect(safeNext("/signin?step=totp")).toBe("/");
    expect(safeNext("/signin")).toBe("/");
  });

  it("uses a given fallback", () => {
    expect(safeNext("https://evil.example", "/command")).toBe("/command");
  });
});
