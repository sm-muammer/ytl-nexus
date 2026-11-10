import sanitizeHtml from "sanitize-html";
import { z } from "zod";
import type { Audience, ContentItem, ContentType } from "./types.ts";

// Maps WordPress REST JSON (as served by the nexus-content plugin) to a
// ContentItem. Anything unexpected fails closed: unknown audience is internal.

const rendered = z.object({ rendered: z.string() });

const wpPost = z.object({
  id: z.number().int(),
  slug: z.string().min(1),
  modified_gmt: z.string().optional(),
  title: rendered,
  excerpt: rendered.optional(),
  content: rendered.optional(),
  menu_order: z.number().int().optional(),
  nexus: z
    .object({
      audience: z.string().optional(),
      business_unit: z.string().nullish(),
      related_service: z.string().nullish(),
      source_url: z.string().nullish(),
    })
    .optional(),
});

const SANITIZE: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "hr",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "strong",
    "em",
    "b",
    "i",
    "code",
    "pre",
    "blockquote",
    "a",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "img",
    "figure",
    "figcaption",
  ],
  allowedAttributes: {
    a: ["href", "title"],
    img: ["src", "alt", "width", "height"],
    th: ["scope"],
  },
  allowedSchemes: ["https", "http", "mailto"],
  allowedSchemesByTag: { img: ["https", "http"] },
  // Images only from the WordPress uploads folder (LIB-08).
  exclusiveFilter: (frame) =>
    frame.tag === "img" &&
    !/^(https:\/\/[a-z0-9.-]+)?\/studio\/wp-content\/uploads\//i.test(
      frame.attribs.src ?? "",
    ),
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
  },
};

export function sanitizeContentHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE);
}

function plain(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

function toAudience(value: string | undefined): Audience {
  return value === "public" ? "public" : "internal";
}

function emptyToNull(value: string | null | undefined): string | null {
  return value && value.trim() ? value.trim() : null;
}

export function mapWpPost(
  type: ContentType,
  json: unknown,
): ContentItem | null {
  const parsed = wpPost.safeParse(json);
  if (!parsed.success) return null;
  const p = parsed.data;
  const modified = p.modified_gmt
    ? new Date(`${p.modified_gmt}Z`).toISOString()
    : new Date(0).toISOString();
  return {
    id: p.id,
    type,
    slug: p.slug,
    title: plain(p.title.rendered),
    excerpt: plain(p.excerpt?.rendered ?? ""),
    html: sanitizeContentHtml(p.content?.rendered ?? ""),
    audience: toAudience(p.nexus?.audience),
    businessUnit: emptyToNull(p.nexus?.business_unit),
    relatedService: emptyToNull(p.nexus?.related_service),
    sourceUrl: emptyToNull(p.nexus?.source_url),
    order: p.menu_order ?? 0,
    modified,
  };
}

/** Query string for the list request of one post type. */
export function wpQueryFor(type: ContentType): string {
  void type; // every type uses the same query today
  return "status=publish&per_page=100&orderby=menu_order&order=asc";
}
