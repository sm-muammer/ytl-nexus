import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { PAGES, ROUTE_PATHS, pageInfo } from "@/lib/navigation/modules";

const root = process.cwd();

// URL path of every page.tsx under app/, with route groups removed.
function appRoutes(): string[] {
  const appDir = path.join(root, "app");
  return readdirSync(appDir, { recursive: true, encoding: "utf8" })
    .filter((f) => f.endsWith(`${path.sep}page.tsx`) || f === "page.tsx")
    .map((f) => {
      const segments = f
        .split(path.sep)
        .slice(0, -1)
        .filter((s) => !(s.startsWith("(") && s.endsWith(")")));
      return "/" + segments.join("/");
    })
    .sort();
}

/** Routes the Next.js app owns, read from docs/product.md section 4. */
function documentedRoutes(): string[] {
  const product = readFileSync(path.join(root, "docs/product.md"), "utf8");
  const section = product.split("## 4. Routes")[1]!.split("\n## ")[0]!;
  const rows = section
    .split("\n")
    .filter((l) =>
      /^\| Next\.js (public|internal reference|workspace|hidden) /.test(l),
    );
  const found = new Set<string>();
  for (const row of rows) {
    for (const m of row.matchAll(/`(\/[a-z0-9\-/*]*)`/g)) {
      found.add(m[1]!.replace(/\/\*$/, "") || "/");
    }
  }
  return [...found].sort();
}

describe("route registry", () => {
  it("has a page file for every registered route and no unregistered page", () => {
    expect(appRoutes()).toEqual([...ROUTE_PATHS].sort());
  });

  it("covers every Next.js route listed in docs/product.md", () => {
    const documented = documentedRoutes();
    expect(documented.length).toBeGreaterThanOrEqual(20);
    for (const route of documented) {
      expect(ROUTE_PATHS, route).toContain(route);
    }
  });

  it("describes every stub page with a title, subtitle and delivery task", () => {
    expect(PAGES.length).toBeGreaterThan(10);
    for (const page of PAGES) {
      expect(page.title.length, page.path).toBeGreaterThan(1);
      expect(page.subtitle.length, page.path).toBeGreaterThan(5);
      expect(page.summary.length, page.path).toBeGreaterThan(20);
      expect(page.task, page.path).toBeGreaterThanOrEqual(4);
      expect(page.task, page.path).toBeLessThanOrEqual(22);
    }
  });

  it("looks pages up by path and fails loudly for an unknown one", () => {
    expect(pageInfo("/command/core-01").title).toBe("Core 01");
    expect(pageInfo("/ai").title).toBe("Nexus AI");
    expect(() => pageInfo("/nope")).toThrowError(/\/nope/);
  });

  it("registers each path once", () => {
    expect(new Set(ROUTE_PATHS).size).toBe(ROUTE_PATHS.length);
  });
});
