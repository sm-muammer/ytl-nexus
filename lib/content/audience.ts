import { meetsRole, type Actor } from "../roles.ts";
import type { ContentItem } from "./types.ts";

// The one audience rule. Public items are for everyone; internal items need a
// signed-in Viewer or above. A Visitor (null actor) never sees internal items.

export function canSeeItem(actor: Actor, item: Pick<ContentItem, "audience">) {
  return item.audience === "public" || meetsRole(actor, "viewer");
}

export function filterForActor<T extends Pick<ContentItem, "audience">>(
  items: readonly T[],
  actor: Actor,
): T[] {
  return items.filter((item) => canSeeItem(actor, item));
}
