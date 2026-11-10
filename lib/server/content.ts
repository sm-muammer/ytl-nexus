import "server-only";
import { filterForActor } from "@/lib/content/audience";
import type { ContentItem, ContentType } from "@/lib/content/types";
import { contentFixtures } from "@/lib/fixtures/content";
import type { Actor } from "@/lib/roles";
import { getMode } from "@/lib/server/mode";
import {
  ContentUnavailableError,
  fetchContentType,
  readWordPressConfig,
} from "@/lib/server/wordpress";

// The only way pages read content. Every result is filtered for the actor
// here, so a page cannot forget to (LIB-07).

export type ContentResult =
  | { ok: true; source: "live" | "demo"; items: ContentItem[] }
  | { ok: false; source: "live" };

export async function listContent(
  type: ContentType,
  actor: Actor,
): Promise<ContentResult> {
  if (getMode() === "demo") {
    const items = contentFixtures.filter((i) => i.type === type);
    return { ok: true, source: "demo", items: filterForActor(items, actor) };
  }
  const config = readWordPressConfig();
  if (!config) return { ok: false, source: "live" };
  try {
    const items = await fetchContentType(type, config);
    return { ok: true, source: "live", items: filterForActor(items, actor) };
  } catch (error) {
    if (!(error instanceof ContentUnavailableError)) throw error;
    return { ok: false, source: "live" };
  }
}

export async function getContentItem(
  type: ContentType,
  slug: string,
  actor: Actor,
): Promise<ContentResult & { item?: ContentItem }> {
  const result = await listContent(type, actor);
  if (!result.ok) return result;
  const item = result.items.find((i) => i.slug === slug);
  return item ? { ...result, item } : { ...result, items: [] };
}
