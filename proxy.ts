import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_ROLE_COOKIE } from "@/lib/fixtures/session";
import { PAGE_POLICY } from "@/lib/server/policy";

// The Next.js Proxy (requirement 6.7). It does three small things before a page
// renders and nothing else:
//
//   1. A request for a protected page with no session cookie goes to the
//      sign-in page, with the page to come back to.
//   2. It records the path in a request header, which layouts (told no path)
//      use for redirects and the audit trail. It replaces any value the client
//      sent.
//   3. A request for a hidden area (/control) with no session cookie is
//      rewritten to a path that does not exist, so it receives exactly the page
//      and status of any unknown address (requirement 6.11). It is not
//      redirected to sign-in, which would show the area exists.
//
// It checks only that a cookie exists. It does not prove the cookie is valid, so
// it is never the authorization check (requirement 6.8); every page, handler and
// Server Function runs its own guard. A signed-in person who is not an
// Administrator is answered by the page guard (docs/security/auth.md, "The
// hidden area").

const PROTECTED_ENTRIES = PAGE_POLICY.filter(
  (p) => p.minRole !== null && !p.hidden && p.path !== "/",
);

const PROTECTED = new Set(
  PROTECTED_ENTRIES.filter((p) => !p.path.includes("[")).map((p) => p.path),
);

const PROTECTED_PATTERNS = PROTECTED_ENTRIES.filter((p) =>
  p.path.includes("["),
).map((p) => {
  const escaped = p.path
    .split("/")
    .map((seg) =>
      seg.startsWith("[") && seg.endsWith("]")
        ? "[^/]+"
        : seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("/");
  return new RegExp(`^${escaped}$`);
});

const HIDDEN = PAGE_POLICY.filter((p) => p.hidden).map((p) => p.path);

/** A path that is not a route, so the rewrite gets the ordinary 404. */
const UNKNOWN_PATH = "/not-a-route";

function normalise(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

function isProtectedPath(pathname: string): boolean {
  const path = normalise(pathname);
  return PROTECTED.has(path) || PROTECTED_PATTERNS.some((re) => re.test(path));
}

function isHiddenPath(pathname: string): boolean {
  const path = normalise(pathname);
  return HIDDEN.some((p) => path === p || path.startsWith(`${p}/`));
}

function generateCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data: https://ytl-nexus.ytlcomms.my",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

function applySecurityHeaders(headers: Headers, csp: string) {
  headers.set("Content-Security-Policy", csp);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
}

/**
 * A rewrite to the unknown path, on the origin Next.js recognises as its own.
 *
 * NextResponse.rewrite() takes an absolute URL, and Next.js treats a rewrite to
 * any other origin as an external request to fetch. Behind Apache the request
 * carries `X-Forwarded-Proto: https`, so `request.url` says https while the Node
 * server itself listens on plain http (loopback); a URL built from `request.url`
 * then names an origin Next.js does not own and it tries to fetch the page over
 * TLS (a 500 on Nexus Core 01). The server always listens on http, so the
 * rewrite is given that scheme. The smoke test and the local reproduction in
 * docs/security/auth.md catch a change.
 */
function rewriteToUnknownPath(
  request: NextRequest,
  requestHeaders: Headers,
  csp: string,
): NextResponse {
  const url = new URL(UNKNOWN_PATH, request.url);
  url.protocol = "http:";
  const response = NextResponse.rewrite(url, {
    request: { headers: requestHeaders },
  });
  applySecurityHeaders(response.headers, csp);
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const live = process.env.NEXUS_MODE === "live";
  // Demo_Mode has no Better Auth cookie; its "session" is the presenter's role cookie.
  const hasSession = live
    ? Boolean(getSessionCookie(request, { cookiePrefix: "nexus" }))
    : request.cookies.has(DEMO_ROLE_COOKIE);

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const csp = generateCsp(nonce, isDev);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  requestHeaders.set("x-nexus-path", pathname);

  if (isHiddenPath(pathname) && !hasSession) {
    return rewriteToUnknownPath(request, requestHeaders, csp);
  }

  if (live && isProtectedPath(pathname) && !hasSession) {
    const url = new URL("/signin", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  applySecurityHeaders(response.headers, csp);
  return response;
}

export const config = {
  // Pages only: skip the framework's assets, brand files and the API.
  matcher: [
    "/((?!api|_next/static|_next/image|brand/|fonts/|favicon.ico|robots.txt).*)",
  ],
};
