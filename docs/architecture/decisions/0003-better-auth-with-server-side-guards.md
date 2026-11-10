# ADR 0003: Better Auth, with authorization in server-side guards

- **Status:** accepted
- **Date:** 2026-11-02
- **Supersedes:** nothing. Refines the "Auth" decision in [`tech.md`](../../tech.md#4-key-design-decisions).

## Context

YTL Nexus needs one sign-in with four roles, mandatory TOTP for Operators and Administrators, a hidden administration area, and an audit trail, on MariaDB, behind Apache, with no outbound email. Next.js 16 pages and Server Functions are public HTTP endpoints, and Better Auth's sessions can only set cookies in Server Functions and Route Handlers, not while a page renders.

## Decision

1. **Better Auth** (1.7) with the admin and two-factor plugins and `nextCookies()` last. Its tables are created by our own migration, and a test asks Better Auth's planner whether anything is missing.
2. **Authorization is a policy table plus guards**, not middleware. `lib/server/policy.ts` has one `decide()` function and a row for every page, handler and Server Function. Every one calls a guard. Tests read the source tree and fail when one does not. The Proxy only redirects requests without a session cookie.
3. **Server Functions are the sign-in path.** Forms post to Server Functions that call `auth.api` directly. The Better Auth HTTP handler is mounted for its rate limiter and origin check, with sign-up, email flows, impersonation and all account administration switched off. Lockout and audit sit in Better Auth hooks, which run for both doors.
4. **Idle expiry is ours.** Better Auth sessions last 12 hours and are never refreshed. A page render cannot write cookies, so refreshing in the library would silently not happen. We record activity in `session.updatedAt` (at most once a minute) and end sessions idle for 30 minutes.
5. **Step_Up** is a timestamp on the session, set after the password and a TOTP code are checked together. It is not Better Auth's "fresh session" feature, which counts from sign-in and knows nothing of TOTP.
6. **The sign-in lockout is a pure rule** (`lockedUntil`) over rows in `auth_failures`, keyed by account and source address, and not Better Auth's request counter, which counts successes and has fixed windows.
7. **`/control` answers a non-administrator with the unknown-path 404.** The Proxy rewrites cookie-less requests to a non-route, so outsiders get the identical page. Signed-in non-administrators get it from the page guard (same status, title and visible page). There is no layout and no static metadata below `/control`, because a thrown `notFound()` in a layout or page renders an error shell in Next.js 16.3.
8. **`X-Real-IP`, set by Apache, is the source address.** `X-Forwarded-For` is not used.

## Alternatives considered

- **Auth.js / hand-rolled sessions.** More code to own and no TOTP or admin tooling. Rejected.
- **Middleware as the authorization layer.** It cannot see the user's role without a database call, runs before Server Functions' own validation, and a single matcher mistake fails open. Kept only as a redirect.
- **Better Auth's cookie cache and its session refresh.** Faster, but a revoked session would stay valid until the cache expires, and refresh does not run during renders. Rejected for requirement 6.17.
- **Better Auth's own rate limiter for lockout.** Its window counts requests and starts afresh, and in memory it resets on restart. Kept as a general limiter only.
- **All auth over the HTTP handler and a browser client.** Larger client bundle, and the account-administration routes would need to be guarded one by one instead of switched off.

## Consequences

- Every new page, handler or action costs one policy row and one guard call, and forgetting either fails a test.
- Each page render of a signed-in user reads the session from MariaDB, and writes at most once a minute.
- `BETTER_AUTH_SECRET` encrypts the TOTP secrets, so it must be backed up with `web.env`, and changing it forces everyone to enrol again.
- Demo_Mode enforces the same matrix on a fixture session but cannot write an audit trail.
- The Better Auth upgrade path matters: its table layout and `auth.api` signatures are part of what the migration and the tests pin.
