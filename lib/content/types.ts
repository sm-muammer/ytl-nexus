// Content shapes shared by the WordPress reader, the demo fixtures and the
// pages. Pure types and constants, no I/O.

export const CONTENT_TYPES = [
  "runbook",
  "faq",
  "announcement",
  "story_chapter",
  "tour_step",
  "business_unit",
  "mail_help",
  "service_note",
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export type Audience = "public" | "internal";

export type ContentItem = {
  id: number;
  type: ContentType;
  slug: string;
  title: string;
  /** Plain text. */
  excerpt: string;
  /** Sanitized HTML, safe to render. */
  html: string;
  audience: Audience;
  businessUnit: string | null;
  relatedService: string | null;
  /** Official page a company claim comes from. */
  sourceUrl: string | null;
  order: number;
  /** ISO 8601, UTC. */
  modified: string;
};

export function isContentType(value: unknown): value is ContentType {
  return (
    typeof value === "string" &&
    (CONTENT_TYPES as readonly string[]).includes(value)
  );
}

/** The REST base each post type is registered under by the nexus-content plugin. */
export const REST_BASE: Record<ContentType, string> = {
  runbook: "nexus-runbooks",
  faq: "nexus-faqs",
  announcement: "nexus-announcements",
  story_chapter: "nexus-story-chapters",
  tour_step: "nexus-tour-steps",
  business_unit: "nexus-business-units",
  mail_help: "nexus-mail-help",
  service_note: "nexus-service-notes",
};
