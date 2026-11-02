import "server-only";
import type { Metadata } from "next";
import { pageMetadata } from "@/components/layout/module-page";
import { getIdentity } from "@/lib/server/identity";
import { decide } from "@/lib/server/policy";

/**
 * The metadata of a page below /control.
 *
 * Next.js resolves a page's metadata even when its layout answers 404, so a
 * static title such as "Nexus Control" would show in the tab and the HTML of the
 * 404 that a non-administrator gets, and give the area away (requirement 6.11).
 * Pages under /control therefore never export a static `metadata`; they export
 * `generateMetadata` that returns this. Anyone who may not open Control gets
 * exactly the metadata of an unknown path (see app/not-found.tsx).
 */
export async function controlMetadata(path: string): Promise<Metadata> {
  const identity = await getIdentity();
  const allowed = decide(
    identity,
    { minRole: "admin", hidden: true },
    Date.now(),
  ).allow;
  return allowed ? pageMetadata(path) : { title: "Page not found" };
}
