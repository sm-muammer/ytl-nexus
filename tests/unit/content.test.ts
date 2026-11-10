// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canSeeItem, filterForActor } from "@/lib/content/audience";
import { contentFixtures } from "@/lib/fixtures/content";
import { mapWpPost, wpQueryFor } from "@/lib/content/wp";
import type { Actor } from "@/lib/roles";
import { ROLES } from "@/lib/roles";

const wpPost = {
  id: 12,
  slug: "restart-apache",
  modified_gmt: "2026-11-09T10:00:00",
  title: { rendered: "Restart Apache" },
  excerpt: { rendered: "<p>Short.</p>" },
  content: {
    rendered:
      '<p>Steps</p><script>alert(1)</script><a href="javascript:x()">x</a>',
  },
  menu_order: 3,
  nexus: {
    audience: "internal",
    business_unit: "ytl-comms",
    related_service: "apache",
    source_url: "",
  },
};

describe("mapWpPost (contract with the nexus-content plugin)", () => {
  it("maps the WordPress JSON to a content item", () => {
    const item = mapWpPost("runbook", wpPost);
    expect(item).toMatchObject({
      id: 12,
      type: "runbook",
      slug: "restart-apache",
      title: "Restart Apache",
      audience: "internal",
      businessUnit: "ytl-comms",
      relatedService: "apache",
      sourceUrl: null,
      order: 3,
    });
  });

  it("removes scripts and javascript: links from the HTML", () => {
    const item = mapWpPost("runbook", wpPost);
    expect(item?.html).not.toMatch(/script|javascript:/i);
    expect(item?.html).toContain("Steps");
  });

  it("treats a missing or unknown audience as internal (fail closed)", () => {
    const bare = { ...wpPost, nexus: undefined };
    expect(mapWpPost("faq", bare)?.audience).toBe("internal");
    expect(
      mapWpPost("faq", { ...wpPost, nexus: { audience: "everyone" } })
        ?.audience,
    ).toBe("internal");
  });

  it("returns null for JSON that is not a post", () => {
    expect(mapWpPost("faq", { nope: true })).toBeNull();
    expect(mapWpPost("faq", null)).toBeNull();
  });

  it("builds a read query that asks for published items only", () => {
    const q = wpQueryFor("runbook");
    expect(q).toContain("status=publish");
    expect(q).toContain("per_page=100");
    expect(q).toContain("orderby=menu_order");
  });
});

describe("audience filtering", () => {
  const visitor: Actor = null;
  const items = contentFixtures.filter((i) => i.type === "runbook");

  it("fixtures contain both audiences, so the tests below mean something", () => {
    expect(items.some((i) => i.audience === "internal")).toBe(true);
    expect(items.some((i) => i.audience === "public")).toBe(true);
  });

  it("a visitor never receives an internal item", () => {
    const seen = filterForActor(contentFixtures, visitor);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((i) => i.audience === "public")).toBe(true);
    for (const i of contentFixtures.filter((i) => i.audience === "internal")) {
      expect(canSeeItem(visitor, i)).toBe(false);
    }
  });

  it.each(ROLES)("a %s sees public and internal items", (role) => {
    const actor: Actor = { userId: "u1", role };
    expect(filterForActor(contentFixtures, actor)).toHaveLength(
      contentFixtures.length,
    );
  });
});

describe("images (LIB-08)", () => {
  it("keeps images from the Studio uploads folder and drops others", () => {
    const html =
      '<img src="https://ytl-nexus.ytlcomms.my/studio/wp-content/uploads/a.png" alt="a">' +
      '<img src="https://evil.example/x.png" alt="x">';
    const item = mapWpPost("faq", {
      ...wpPost,
      content: { rendered: html },
    });
    expect(item?.html).toContain("uploads/a.png");
    expect(item?.html).not.toContain("evil.example");
  });
});
