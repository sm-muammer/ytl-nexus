// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import {
  ContentUnavailableError,
  fetchContentType,
  readWordPressConfig,
} from "@/lib/server/wordpress";

const config = {
  baseUrl: "http://127.0.0.1:8081/studio",
  user: "reader",
  appPassword: "abcd efgh",
};

const post = {
  id: 1,
  slug: "a",
  title: { rendered: "A" },
  nexus: { audience: "public" },
};

describe("WordPress reader contract", () => {
  it("calls the plugin's REST base with basic auth, tags and ISR", async () => {
    const f = vi.fn(async () => Response.json([post, { junk: true }]));
    const items = await fetchContentType("faq", config, f as never);
    expect(items).toHaveLength(1);
    const [url, init] = f.mock.calls[0] as unknown as [
      string,
      RequestInit & { next: unknown },
    ];
    expect(url).toContain("rest_route=/wp/v2/nexus-faqs");
    expect(url).toContain("status=publish");
    expect((init.headers as Record<string, string>).Authorization).toMatch(
      /^Basic /,
    );
    expect(init.next).toEqual({
      revalidate: 300,
      tags: ["content", "content:faq"],
    });
  });

  it("raises ContentUnavailableError on network failure, non-200 and non-array", async () => {
    const failing = [
      async () => {
        throw new Error("boom");
      },
      async () => new Response("no", { status: 500 }),
      async () => Response.json({ not: "a list" }),
    ];
    for (const f of failing) {
      await expect(
        fetchContentType("faq", config, f as never),
      ).rejects.toBeInstanceOf(ContentUnavailableError);
    }
  });

  it("does not leak the password in the error", async () => {
    const f = async () => {
      throw new Error("failed for abcd efgh");
    };
    const err = await fetchContentType("faq", config, f as never).catch(
      (e: Error) => e,
    );
    expect(String((err as Error).message)).not.toContain("abcd");
  });

  it("reads config only when all three variables are set", () => {
    expect(readWordPressConfig({})).toBeNull();
    expect(
      readWordPressConfig({
        NEXUS_WP_URL: "http://x/studio/",
        NEXUS_WP_USER: "u",
        NEXUS_WP_APP_PASSWORD: "p",
      }),
    ).toEqual({ baseUrl: "http://x/studio", user: "u", appPassword: "p" });
  });
});
