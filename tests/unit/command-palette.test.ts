// @vitest-environment node
import { describe, expect, it } from "vitest";
import { MODULES } from "@/lib/navigation/modules";
import { meetsRole, type Actor } from "@/lib/roles";

function getSearchItems(actor: Actor) {
  const items = [];
  for (const m of MODULES) {
    if (m.hidden && !meetsRole(actor, "admin")) continue;
    if (m.minRole && !meetsRole(actor, m.minRole)) continue;

    items.push({
      id: m.slug,
      title: m.name,
      href: m.href,
      group: m.group,
    });

    if (m.pages) {
      for (const p of m.pages) {
        items.push({
          id: p.href,
          title: `${m.name}: ${p.title}`,
          href: p.href,
          group: m.group,
        });
      }
    }
  }
  return items;
}

describe("Command Palette Indexer & Concealment", () => {
  it("conceals Nexus Control and User Management from visitors and non-admins", () => {
    const visitorItems = getSearchItems(null);
    expect(visitorItems.some((i) => i.id === "control")).toBe(false);
    expect(visitorItems.some((i) => i.href === "/control/users")).toBe(false);

    const viewerItems = getSearchItems({ userId: "u1", role: "viewer" });
    expect(viewerItems.some((i) => i.id === "control")).toBe(false);
    expect(viewerItems.some((i) => i.href === "/control/users")).toBe(false);

    const operatorItems = getSearchItems({ userId: "u2", role: "operator" });
    expect(operatorItems.some((i) => i.id === "control")).toBe(false);
    expect(operatorItems.some((i) => i.href === "/control/users")).toBe(false);
  });

  it("exposes Nexus Control and User Management to Administrators only", () => {
    const adminItems = getSearchItems({ userId: "admin1", role: "admin" });
    expect(adminItems.some((i) => i.id === "control")).toBe(true);
    expect(adminItems.find((i) => i.id === "control")?.href).toBe("/control");
    expect(adminItems.some((i) => i.href === "/control/users")).toBe(true);
  });

  it("indexes sub-pages for multi-page modules", () => {
    const adminItems = getSearchItems({ userId: "admin1", role: "admin" });
    expect(adminItems.some((i) => i.href === "/command/core-01")).toBe(true);
    expect(adminItems.some((i) => i.href === "/command/metrics")).toBe(true);
    expect(adminItems.some((i) => i.href === "/command/services")).toBe(true);
    expect(adminItems.some((i) => i.href === "/yes/plans")).toBe(true);
  });

  it("filters items by title or group keyword", () => {
    const adminItems = getSearchItems({ userId: "admin1", role: "admin" });
    const query = "control";
    const filtered = adminItems.filter(
      (i) =>
        i.title.toLowerCase().includes(query.toLowerCase()) ||
        i.group.toLowerCase().includes(query.toLowerCase()),
    );
    expect(filtered.length).toBeGreaterThan(0);
    expect(filtered.some((i) => i.id === "control")).toBe(true);
  });
});
