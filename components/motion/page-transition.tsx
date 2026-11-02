import { ViewTransition, type ReactNode } from "react";

/**
 * Cross-fades page content between routes with the browser View Transitions
 * API (opacity plus a 6 px rise, see globals.css). Next.js navigations are
 * React transitions, so no configuration is needed. Place it in the page, not
 * the layout: layouts persist across navigations, so enter and exit would never
 * fire there. Browsers without support, and the plain React used by unit
 * tests, simply swap the content.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  if (!ViewTransition) return <>{children}</>;
  return (
    <ViewTransition enter="nx-page-enter" exit="nx-page-exit" default="none">
      {children}
    </ViewTransition>
  );
}
