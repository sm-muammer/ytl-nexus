import type { ReactNode } from "react";
import { AppShell } from "./app-shell";

/**
 * The frame of every page under /control. It is used by the page itself, after
 * its guard, and not by a layout: a layout that answered 404 would be rendered
 * as an error shell, which differs from the 404 of an unknown path. Because the
 * page throws notFound() before it returns this, a non-administrator gets
 * exactly the root layout and app/not-found.tsx (requirement 6.11).
 */
export function ControlShell({ children }: { children: ReactNode }) {
  return <AppShell register="workspace">{children}</AppShell>;
}
