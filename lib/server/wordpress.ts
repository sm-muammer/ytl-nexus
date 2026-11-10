import "server-only";
import { mapWpPost, wpQueryFor } from "@/lib/content/wp";
import {
  REST_BASE,
  type ContentItem,
  type ContentType,
} from "@/lib/content/types";

// The server-only WordPress reader (LIB-04). It uses an Application Password
// and talks to WordPress over the loopback listener. It returns every
// published item, internal ones included: the caller filters by role with
// lib/content/audience.ts (see lib/server/content.ts, the only caller).

export class ContentUnavailableError extends Error {
  constructor() {
    super("content-unavailable");
    this.name = "ContentUnavailableError";
  }
}

export type WordPressConfig = {
  baseUrl: string;
  user: string;
  appPassword: string;
};

export function readWordPressConfig(
  env: Record<string, string | undefined> = process.env,
): WordPressConfig | null {
  const baseUrl = env.NEXUS_WP_URL;
  const user = env.NEXUS_WP_USER;
  const appPassword = env.NEXUS_WP_APP_PASSWORD;
  if (!baseUrl || !user || !appPassword) return null;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), user, appPassword };
}

export function wpSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  return env.NEXUS_WP_WEBHOOK_SECRET ?? "";
}

/** ISR: a safety net; the webhook revalidates within seconds of an edit. */
const REVALIDATE_SECONDS = 300;

export async function fetchContentType(
  type: ContentType,
  config: WordPressConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ContentItem[]> {
  const auth = Buffer.from(`${config.user}:${config.appPassword}`).toString(
    "base64",
  );
  const url = `${config.baseUrl}/index.php?rest_route=/wp/v2/${REST_BASE[type]}&${wpQueryFor(type)}`;
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      next: {
        revalidate: REVALIDATE_SECONDS,
        tags: ["content", `content:${type}`],
      },
    });
  } catch {
    throw new ContentUnavailableError();
  }
  if (!response.ok) throw new ContentUnavailableError();
  const json: unknown = await response.json().catch(() => null);
  if (!Array.isArray(json)) throw new ContentUnavailableError();
  return json
    .map((post) => mapWpPost(type, post))
    .filter((item): item is ContentItem => item !== null);
}

/** One draft or published item by id, for preview (LIB-06). */
export async function fetchPreview(
  type: ContentType,
  id: number,
  config: WordPressConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<ContentItem | null> {
  const auth = Buffer.from(`${config.user}:${config.appPassword}`).toString(
    "base64",
  );
  const url = `${config.baseUrl}/index.php?rest_route=/wp/v2/${REST_BASE[type]}/${id}&status=any`;
  try {
    const response = await fetchImpl(url, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    if (!response.ok) return null;
    return mapWpPost(type, await response.json());
  } catch {
    return null;
  }
}
