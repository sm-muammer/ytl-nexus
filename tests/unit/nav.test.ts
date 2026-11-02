import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FOOTER_LINKS,
  MODULES,
  NAV_ITEMS,
  visibleNav,
  type NavItem,
} from "@/lib/navigation/modules";
import {
  ROLES,
  ROLE_RANK,
  meetsRole,
  type Actor,
  type Role,
} from "@/lib/roles";

const actor = (role: Role): Actor => ({ userId: `u-${role}`, role });
const labels = (items: readonly NavItem[]) => items.map((i) => i.label);

describe("roles", () => {
  it("ranks viewer < member < operator < admin", () => {
    expect(ROLES.map((r) => ROLE_RANK[r])).toEqual([1, 2, 3, 4]);
  });

  it("meetsRole: Visitors only meet items with no minimum role", () => {
    expect(meetsRole(null, null)).toBe(true);
    expect(meetsRole(null, "viewer")).toBe(false);
    expect(meetsRole(actor("viewer"), "viewer")).toBe(true);
    expect(meetsRole(actor("viewer"), "member")).toBe(false);
    expect(meetsRole(actor("admin"), "operator")).toBe(true);
  });
});

describe("visibleNav (role-aware menu)", () => {
  it("shows a Visitor only the public items", () => {
    const visible = visibleNav(NAV_ITEMS, null);
    expect(visible.length).toBeGreaterThan(0);
    for (const item of visible) expect(item.minRole).toBeNull();
    expect(labels(visible)).toEqual(
      expect.arrayContaining([
        "Platform",
        "Nexus Tour",
        "Project Story",
        "Nexus Status",
        "Nexus Library",
        "Yes Experience",
      ]),
    );
    expect(labels(visible)).not.toContain("Nexus Command");
    expect(labels(visible)).not.toContain("Nexus Control");
  });

  it("adds modules as the role rises, and never shows one above the role", () => {
    const names = (r: Role) => labels(visibleNav(NAV_ITEMS, actor(r)));

    expect(names("viewer")).toEqual(
      expect.arrayContaining(["Nexus Command", "Nexus Atlas", "Nexus Data"]),
    );
    expect(names("viewer")).not.toContain("Nexus AI");

    expect(names("member")).toEqual(
      expect.arrayContaining(["Nexus AI", "Nexus Transfer", "Nexus Mail"]),
    );
    expect(names("member")).not.toContain("Nexus Shield");

    expect(names("operator")).toEqual(
      expect.arrayContaining([
        "Nexus Continuity",
        "Nexus Shield",
        "Nexus Studio",
      ]),
    );
    expect(names("operator")).not.toContain("Nexus Control");

    expect(names("admin")).toContain("Nexus Control");
  });

  it("is monotonic: a higher role sees everything a lower role sees", () => {
    for (let i = 1; i < ROLES.length; i++) {
      const lower = labels(visibleNav(NAV_ITEMS, actor(ROLES[i - 1]!)));
      const higher = labels(visibleNav(NAV_ITEMS, actor(ROLES[i]!)));
      for (const name of lower) expect(higher).toContain(name);
    }
  });

  it("filters child items by the same rule", () => {
    const tree: NavItem[] = [
      {
        label: "Parent",
        href: "/p",
        subtitle: "s",
        minRole: null,
        group: "explore",
        children: [
          {
            label: "Open",
            href: "/p/a",
            subtitle: "s",
            minRole: null,
            group: "explore",
          },
          {
            label: "Closed",
            href: "/p/b",
            subtitle: "s",
            minRole: "operator",
            group: "explore",
          },
        ],
      },
    ];
    expect(visibleNav(tree, null)[0]?.children?.map((c) => c.label)).toEqual([
      "Open",
    ]);
    expect(
      visibleNav(tree, actor("operator"))[0]?.children?.map((c) => c.label),
    ).toEqual(["Open", "Closed"]);
  });
});

describe("navigation completeness", () => {
  it("links every module named in docs/product.md", () => {
    const product = readFileSync(
      path.join(process.cwd(), "docs/product.md"),
      "utf8",
    );
    const names = [...product.matchAll(/^\| \*\*([^*]+)\*\*\s+\|/gm)].map(
      (m) => m[1]!,
    );
    expect(names).toHaveLength(15);
    const navNames = labels(NAV_ITEMS);
    for (const name of names) expect(navNames).toContain(name);
  });

  it("gives every item a real target: no empty href and no '#'", () => {
    const all = [...NAV_ITEMS, ...NAV_ITEMS.flatMap((i) => i.children ?? [])];
    for (const item of all) {
      expect(item.href, item.label).toMatch(/^\/[a-z0-9\-/]*$/);
    }
  });

  it("every module has a unique slug and a plain subtitle", () => {
    const slugs = MODULES.map((m) => m.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const m of MODULES) expect(m.subtitle.length).toBeGreaterThan(5);
  });

  it("only relates modules that exist", () => {
    const slugs = new Set(MODULES.map((m) => m.slug));
    for (const m of MODULES) {
      for (const r of m.related)
        expect(slugs.has(r), `${m.slug} → ${r}`).toBe(true);
    }
  });

  it("gives Nexus Command its contextual sub-navigation", () => {
    const command = MODULES.find((m) => m.slug === "command");
    expect(command?.subNav?.map((s) => s.href)).toEqual([
      "/command",
      "/command/core-01",
      "/command/atlas",
      "/command/metrics",
      "/command/services",
    ]);
  });
});

describe("footer links", () => {
  it("never uses '#' or an empty target", () => {
    for (const link of FOOTER_LINKS) {
      expect(link.href).not.toBe("");
      expect(link.href).not.toBe("#");
      expect(link.href.startsWith("#")).toBe(false);
    }
  });

  it("uses an absolute path or an https URL", () => {
    for (const link of FOOTER_LINKS) {
      expect(link.href).toMatch(/^(\/[a-z0-9\-/]*|https:\/\/[^\s]+)$/);
    }
  });
});
