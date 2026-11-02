import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACTION_POLICY,
  HANDLER_POLICY,
  PAGE_POLICY,
  policyForPage,
} from "@/lib/server/policy";

// Requirement 6.3 says every protected page, layout, Route Handler and Server
// Function calls the guard. These tests read the source files and fail when a
// new one is added without it, so the rule does not depend on remembering it.

const ROOT = path.resolve(import.meta.dirname, "../..");

function walk(dir: string, accept: (file: string) => boolean): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return walk(full, accept);
    return accept(full) ? [full] : [];
  });
}

const read = (file: string) => readFileSync(file, "utf8");

/** app/(workspace)/command/atlas/page.tsx becomes /command/atlas. */
function routeOf(file: string): string {
  const rel = path
    .relative(path.join(ROOT, "app"), path.dirname(file))
    .split(path.sep)
    .filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")))
    .join("/");
  return "/" + rel;
}

describe("pages", () => {
  const pages = walk(path.join(ROOT, "app"), (f) => /\/page\.tsx$/.test(f));

  it("finds the pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20);
  });

  it("have a policy row, and every protected one calls requirePage with its own path", () => {
    for (const file of pages) {
      const route = routeOf(file);
      const policy = policyForPage(route);
      if (policy.minRole === null) continue;
      expect(
        read(file),
        `${path.relative(ROOT, file)} must call requirePage("${route}")`,
      ).toContain(`requirePage("${route}")`);
    }
  });

  it("are all listed in the policy table, and the table lists nothing that does not exist", () => {
    const routes = new Set(pages.map(routeOf));
    for (const row of PAGE_POLICY) {
      // /studio is served by Apache in production but has a Next.js fallback page.
      expect(routes.has(row.path), `${row.path} has no page file`).toBe(true);
    }
    for (const route of routes) {
      expect(
        PAGE_POLICY.some((p) => p.path === route),
        `${route} has no policy row`,
      ).toBe(true);
    }
  });
});

describe("pages below /control", () => {
  it("export no static metadata, which would show the area's title in the 404", () => {
    const control = walk(path.join(ROOT, "app/control"), (f) =>
      /\/page\.tsx$/.test(f),
    );
    expect(control.length).toBeGreaterThan(0);
    for (const file of control) {
      const src = read(file);
      expect(src, path.relative(ROOT, file)).not.toMatch(
        /export const metadata\b/,
      );
      expect(src, path.relative(ROOT, file)).toContain("controlMetadata(");
      // The guard must come before the shell, or the shell would render for everyone.
      expect(
        src.indexOf("requirePage("),
        path.relative(ROOT, file),
      ).toBeLessThan(src.indexOf("<ControlShell"));
    }
  });
});

describe("layouts", () => {
  it("guard the groups that hold protected pages, and give /control none", () => {
    expect(read(path.join(ROOT, "app/(workspace)/layout.tsx"))).toMatch(
      /requireRole\("viewer"/,
    );
    // /control has no layout on purpose: a layout that answers 404 is rendered as an
    // error shell, which differs from an unknown path. Each page guards itself and
    // wraps its content in ControlShell after the guard (components/layout/control-shell.tsx).
    expect(existsSync(path.join(ROOT, "app/control/layout.tsx"))).toBe(false);
  });
});

describe("Route Handlers", () => {
  const routes = walk(path.join(ROOT, "app"), (f) => /\/route\.ts$/.test(f));

  it("are all in the handler policy table", () => {
    expect(routes.length).toBeGreaterThanOrEqual(3);
    const known = HANDLER_POLICY.map((h) => h.path);
    for (const file of routes) {
      const p = routeOf(file);
      expect(known, `${p} has no handler policy`).toContain(p);
    }
  });

  it("only leave the policy table's public handlers open to a Visitor", () => {
    for (const h of HANDLER_POLICY.filter((h) => h.minRole === null)) {
      expect(h.note, `${h.id} needs a note on why it is public`).toBeTruthy();
    }
  });
});

describe("Server Functions", () => {
  const files = walk(ROOT, (f) => {
    if (
      f.includes("node_modules") ||
      f.includes(`${path.sep}.next${path.sep}`)
    ) {
      return false;
    }
    return /\.(ts|tsx)$/.test(f) && /^\s*["']use server["']/.test(read(f));
  });
  const exportsOf = (src: string) =>
    [...src.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);

  it("finds them", () => {
    expect(files.length).toBeGreaterThanOrEqual(3);
  });

  it("guard every exported function: one guardAction per export, or the demo-only check", () => {
    for (const file of files) {
      const src = read(file);
      const rel = path.relative(ROOT, file);
      if (rel === path.join("lib", "server", "demo-session-actions.ts")) {
        expect(src, rel).toContain('getMode() !== "demo"');
        continue;
      }
      const exported = exportsOf(src);
      const guarded = [...src.matchAll(/guardAction\(\s*\{\s*id:/g)].length;
      expect(guarded, `${rel}: ${exported.join(", ")}`).toBeGreaterThanOrEqual(
        exported.length,
      );
    }
  });

  it("use only ids that are in the action policy table, and every id is used", () => {
    const used = new Set<string>(["demo.set-session"]);
    for (const file of files) {
      for (const m of read(file).matchAll(
        /guardAction\(\s*\{\s*id:\s*"([^"]+)"/g,
      )) {
        used.add(m[1] as string);
      }
    }
    const known = ACTION_POLICY.map((a) => a.id);
    for (const id of used) expect(known, id).toContain(id);
    for (const id of known)
      expect([...used], `${id} is never used`).toContain(id);
  });
});

describe("secrets", () => {
  it("never put a secret in a NEXT_PUBLIC_ variable", () => {
    const files = walk(
      ROOT,
      (f) =>
        /\.(ts|tsx|md|example)$/.test(f) &&
        !f.includes("node_modules") &&
        !f.includes(`${path.sep}.next${path.sep}`) &&
        !f.includes(`${path.sep}reference${path.sep}`) &&
        !f.includes("yes-website-redesign") &&
        !f.endsWith("guard-coverage.test.ts"),
    );
    for (const f of files) {
      expect(read(f), path.relative(ROOT, f)).not.toMatch(
        /NEXT_PUBLIC_\w*(SECRET|PASSWORD|TOKEN|KEY)/,
      );
    }
  });
});
