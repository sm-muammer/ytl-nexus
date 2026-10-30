# Identity and access

> **Purpose:** how people sign in, which roles exist, how authorization is enforced and how actions are audited.
> **Audience:** anyone writing a page, Route Handler or Server Function. Built in Task 6; extended in Task 19; reviewed in Task 21.

## Summary

One central Nexus login with role-based access. Authorization runs on the server for every request. Hidden URLs reduce discovery but never provide protection.

## Requirements

| ID     | Requirement                                                                                                                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| IAM-01 | Authentication uses Better Auth with MariaDB storage: email and password, admin plugin with custom roles, two-factor TOTP, built-in rate limiting, `nextCookies()` as the last plugin                   |
| IAM-02 | Roles: Visitor (signed out), Viewer, Member, Operator, Administrator. The capability matrix is in [00 overview, section 3](00-overview.md#3-roles)                                                      |
| IAM-03 | Operator and Administrator must enrol TOTP on first sign-in before reaching any protected page                                                                                                          |
| IAM-04 | One `requireRole(minRole)` guard is called in every protected page, layout, Route Handler and Server Function. Proxy-level checks only redirect on missing session cookies                              |
| IAM-05 | `requireStepUp()` requires password plus TOTP within the last 10 minutes. `/control/*` requires it                                                                                                      |
| IAM-06 | `/control/*` returns `notFound()` to everyone except Administrators. It is unlinked from public navigation and marked `noindex`                                                                         |
| IAM-07 | Administrator impersonation is disabled                                                                                                                                                                 |
| IAM-08 | Password resets are performed by an Administrator (no outbound email). A first-admin CLI script creates the initial Administrator on the server                                                         |
| IAM-09 | Cookies are `Secure`, `HttpOnly` and `SameSite=Lax`; sessions expire and can be revoked by an Administrator                                                                                             |
| IAM-10 | Every authentication event (sign-in, failure, lockout, 2FA enrol, step-up, sign-out) and every modifying action writes an `audit_events` row: actor, role, action, target, result, source IP, timestamp |
| IAM-11 | The account model allows corporate SSO to replace local accounts later without changing module code                                                                                                     |
| IAM-12 | WordPress Editor, mail and SFTP credentials stay separate from Nexus credentials                                                                                                                        |

## Security requirements

- Server Functions and Route Handlers are public HTTP endpoints. Each one validates input with Zod and re-checks the role, even when the calling page already did.
- Data access goes through a `server-only` data layer that returns minimal DTOs. Client Components never receive raw database rows, tokens or internal errors.
- Failed sign-ins are rate limited per account and per IP.
- No secret appears in `NEXT_PUBLIC_` variables, logs or error responses.

## Demo mode

`NEXUS_MODE=demo` uses a fixture session switcher (Viewer, Member, Operator, Administrator) clearly labelled "Demo session". It never connects to the auth database.

## Acceptance criteria

- Table-driven tests cover every page, Route Handler and Server Function for every role, including direct POSTs with no session and with the wrong role.
- Brute-force attempts trigger lockout; TOTP enrolment and step-up expiry behave as specified; cookie flags are verified.
- A Member requesting `/control` receives 404 and the attempt is audited.

## Related

[23 Nexus Control](23-nexus-control.md) · [Architecture decision 2](../architecture/overview.md#4-key-design-decisions)
