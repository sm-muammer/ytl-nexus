import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { PAGE_POLICY } from "@/lib/server/policy";

// The Next.js Proxy (requirement 6.7). It does two small things before a page
// renders and nothing else:
//
//   1. A request for a protected page with no session cookie goes to the
//      sign-in page, with the page to come back to.
//   2. It records the path in a request header, which layouts (told no path)
//      use for redirects and the audit trail. It replaces any value the client
//      sent.
//
// It checks only that a cookie exists. It does not prove the cookie is valid, so
// it is never the authorization check (requirement 6.8); every page, handler and
// Server Function runs its own guard. /control is deliberately not redirected:
// a Visitor must see the same 404 as for a path that does not exist.

const PROTECTED = new Set(
  PAGE_POLICY.filter(
    (p) => p.minRole !== null && !p.hidden && p.path !== "/",
  ).map((p) => p.path),
);

function isProtectedPath(pathname: string): boolean {
  const normalised =
    pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PROTECTED.has(normalised);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const live = process.env.NEXUS_MODE === "live";

  // Demo_Mode has no session cookie; the guards read the presenter's fixture.
  if (
    live &&
    isProtectedPath(pathname) &&
    !getSessionCookie(request, { cookiePrefix: "nexus" })
  ) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nexus-path", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Pages only: skip the framework's assets, brand files and the API.
  matcher: [
    "/((?!api|_next/static|_next/image|brand/|fonts/|favicon.ico|robots.txt).*)",
  ],
};
