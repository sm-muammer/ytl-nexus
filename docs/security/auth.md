# Authentication, roles and audit

> **Purpose:** how people sign in to YTL Nexus, how every request is authorized on the server, what is written to the audit trail, and how to operate and extend all of it.
> **Audience:** developers adding a page, Route Handler or Server Function, and the IT Infrastructure team running accounts on Nexus Core 01. The requirements are in [Identity and access](../spec/10-identity-and-access.md) and [Nexus Control](../spec/23-nexus-control.md); the decision is [ADR 0003](../architecture/decisions/0003-better-auth-with-server-side-guards.md).

## How it fits together

| Piece              | Where                                                                              | What it does                                                                                                                                 |
| ------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Better Auth        | `lib/server/auth/create-auth.ts`                                                   | Accounts, passwords, TOTP, sessions. Admin plugin with four roles. `nextCookies()` is the last plugin                                        |
| Policy table       | `lib/server/policy.ts`                                                             | One row per page, Route Handler and Server Function: the lowest role, and whether it is hidden or needs Step_Up. `decide()` is the only rule |
| Guards             | `lib/server/guards.ts` (logic in `guards-core.ts`)                                 | `requirePage`, `requireRole`, `requireStepUp`, `guardAction`, `guardHandler`. Each decides, audits a refusal once, and answers               |
| Proxy              | `proxy.ts`                                                                         | Sends a request with no session cookie to `/signin`. Checks only that the cookie exists, so it is never the authorization check              |
| Session rules      | `lib/server/auth/rules.ts`, `lib/server/auth/service.ts`, `lib/server/identity.ts` | 30 minutes idle, 12 hours absolute, Step_Up for 10 minutes, five failures lock for 15 minutes                                                |
| Server Functions   | `lib/server/auth/actions.ts`, `lib/server/control-actions.ts`                      | Sign in, second step, sign out, enrolment, Step_Up, and the Control actions                                                                  |
| First-admin script | `scripts/auth/create-user.ts`                                                      | Creates an account on the server without a session                                                                                           |
| Demo sessions      | `lib/fixtures/session.ts`, `lib/server/adapters/demo.ts`                           | Fixture roles for the portfolio. The guards enforce the same matrix; nothing touches a database                                              |

## Roles

`viewer`, `member`, `operator`, `admin`, in that order. A Visitor is nobody signed in. The matrix of what each role may open is in [Product, roles](../product.md#3-roles) and is written out by hand in `tests/helpers/role-matrix.ts`, which the unit and end-to-end tests check every page against.

Operators and Administrators must enrol TOTP before they can open any protected page. A Viewer or Member never has to.

## Sessions

| Rule              | Value                 | Enforced by                                                                                                                                                                                     |
| ----------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Absolute lifetime | 12 hours from sign-in | Better Auth `session.expiresIn`, never extended (`disableSessionRefresh`)                                                                                                                       |
| Idle limit        | 30 minutes            | `resolveIdentity()` ends the session when `updatedAt` is older, and records activity at most once a minute. Page renders cannot write cookies, so this lives in the database, not in the cookie |
| Revocation        | Immediate             | The cookie cache is off. Every request reads the session row                                                                                                                                    |
| Cookie            | `nexus.session_token` | `HttpOnly`, `SameSite=Lax`, and `Secure` with the `__Secure-` prefix when `BETTER_AUTH_URL` is `https`. Plain `http` (local development) cannot carry `Secure`                                  |
| Step_Up           | 10 minutes            | `session.stepUpAt`, set after password plus TOTP. Control pages ask again when it is older                                                                                                      |

## Sign-in lockout

Five failed sign-ins inside 15 minutes for one account (by email) or one source address lock that account or address for 15 minutes, counted from the fifth failure. The check runs in a Better Auth hook, so the HTTP handler and the Server Functions are covered alike. Unknown emails count too, so the answer never reveals whether an account exists. A successful sign-in does not clear the count: otherwise someone with one valid account could reset the counter for their address.

Step_Up and TOTP enrolment have the same limit, per user. Sign-in with a second factor also has Better Auth's own lockout (five wrong codes end the challenge).

Rows live in `auth_failures` and are pruned on later sign-ins. The rule is the pure function `lockedUntil()` in `rules.ts`, tested against an independent model.

## Source address

Apache sets `X-Real-IP` from the connecting address with `RequestHeader set`, which replaces anything a client sent. The application reads only that header (`lib/server/auth/ip.ts`). It ignores `X-Forwarded-For` because Apache appends to it and its first entry is client-controlled. Without Apache (local development, tests) every request is `0.0.0.0` unless the test sets the header.

## Writing a protected page, handler or action

1. **Page:** add its path to the module registry (`lib/navigation/modules.ts`) with `minRole`, and put `await requirePage("/your/path")` first in the page. `tests/unit/guard-coverage.test.ts` fails if a protected page lacks the call or the path has no policy row.
2. **Layout:** layouts do not run again on navigation, so a layout is a floor only. The `(workspace)` layout requires Viewer; `/control` answers 404 from its layout so no part of the shell renders.
3. **Server Function:** add a row to `ACTION_POLICY`, then wrap the logic in `guardAction({ id, schema, target }, handler)`. The wrapper authorizes, validates with Zod, runs the handler, and writes exactly one audit event. Return `{ ok: true, ... }` or `{ ok: false, error }`; never throw for expected failures. A handler cannot call `redirect()`; return the destination and redirect in the exported function.
4. **Route Handler:** add a row to `HANDLER_POLICY` and wrap it in `guardHandler`. A public handler needs a note saying why it is safe.
5. **Data owned by a user:** compare with `ctx.owns(ownerId)`. No role, Administrator included, owns another user's data through ordinary routes.
6. **Under `/control`:** export `generateMetadata = () => controlMetadata(path)`, never a static `metadata`. A static title would show in the 404 that other people get.

A refused request never runs the handler and writes one `refused` event. Validation failures write `refused` too, and the response names the failing fields, never their values. If the audit store is down the refusal still stands.

## The hidden area

`/control` and everything below it answer anyone who is not an Administrator with the 404 of a path that does not exist.

- **No session cookie** (an outsider guessing the address): the Proxy rewrites the request to a path that is not a route. The response is byte for byte the ordinary 404 page, which the smoke test and an end-to-end test compare with the scripts removed. The Proxy does not redirect to sign-in, which would show the area exists. Nothing is audited, because there is no identity.
- **Signed in but not an Administrator:** the page guard calls `notFound()` and writes a `refused` event. The status, the title and the page the person sees are identical to an unknown path. Next.js 16.3 sends the first bytes of a thrown `notFound()` as an error shell and lets the browser draw the page, so a person running `curl` with a valid session cookie can still tell the two apart. That is a known limit, accepted because the caller is already an authenticated colleague and the page guard, not secrecy, is the protection.

`/control` has no layout on purpose (a layout that answers 404 is rendered as an error shell) and its pages wrap their content in `ControlShell` after the guard. `controlMetadata()` keeps the tab title identical.

Rewrite and proxies: behind Apache the request says `X-Forwarded-Proto: https` while the Node server listens on plain http. A rewrite to an https URL is fetched as an external request and fails with a 500, so `proxy.ts` gives the rewrite the `http:` scheme. To reproduce locally, run `.next/standalone/server.js` with `HOSTNAME=127.0.0.1` and request it with `-H 'Host: ytl-nexus.internal' -H 'X-Forwarded-Proto: https'`.

Administrators then pass Step_Up before Control shows anything. The Task 6 tools are the account list, **password reset** and **end sessions**. Reset creates a random 24-character password, shows it once to the Administrator, ends the user's sessions and sends no email. Task 19 adds the rest.

Credential separation (requirement 6.24): WordPress, mail and SFTP accounts live in their own services and databases (`nexus_wordpress`, `nexus_mail`, `nexus_sftpgo`, each with a single-database user). No Nexus password hash is copied there and the reverse.

## Creating accounts (first administrator)

On Nexus Core 01, once `setup-auth` has run (see [Configuration](../operations/configuration.md#authentication)):

```bash
ssh root@10.26.64.164
sudo -u nexus bash -c 'cd /opt/ytl-nexus/current && set -a && . /etc/ytl-nexus/web.env && set +a && \
  npm run auth:create-user -- --email logesh@ytlcomms.my --name "Logesh" --role admin'
```

It prints a random password once. Pass it on privately; the person sets up two-factor at the first sign-in. `--password-stdin` reads a chosen password instead (12 to 128 characters). `--role` is `admin` (default), `operator`, `member` or `viewer`. An existing email is refused. Each run writes one `admin.create-user` audit event with `cli:<unix user>` as the actor.

Self-service password change is not built yet: use **Reset password** in Control, or run the script for a new account.

## Lost authenticator

Backup codes (shown once at enrolment) work in place of the code at sign-in, one time each. If both are lost, an Administrator cannot yet reset two-factor from Control (Task 19). On the server, with the migrate user:

```bash
sudo -u nexus bash -c 'set -a && . /etc/ytl-nexus/migrate.env && set +a && \
  mariadb -h 127.0.0.1 -u "$NEXUS_DB_USER" -p"$NEXUS_DB_PASSWORD" "$NEXUS_DB_NAME" -e \
  "DELETE FROM session WHERE userId = (SELECT id FROM user WHERE email = \"a@b.my\"); \
   DELETE FROM twoFactor WHERE userId = (SELECT id FROM user WHERE email = \"a@b.my\"); \
   UPDATE user SET twoFactorEnabled = 0 WHERE email = \"a@b.my\";"'
```

The person signs in with their password and enrols again. Record why in the handover log.

## The secret

`BETTER_AUTH_SECRET` signs sessions and **encrypts the stored TOTP secrets**. Back it up with `web.env`. If it changes, every enrolled authenticator stops working and everyone with two-factor must be reset as above. Sessions end too. `setup-auth` never overwrites an existing value.

## What the audit trail records

Every row has actor id, role, action, target, result (`success`, `failure`, `refused`, `denied`), source address and time. The app's database user can insert and read but not change or delete rows.

| Action                                                    | Written by         | When                                                                   |
| --------------------------------------------------------- | ------------------ | ---------------------------------------------------------------------- |
| `auth.sign-in.email`                                      | Better Auth hook   | Every sign-in: `success` or `failure`                                  |
| `auth.sign-in`                                            | Better Auth hook   | `denied`: a sign-in refused because the account or address is locked   |
| `auth.two-factor.*`, `auth.change-password`               | Better Auth hook   | Enable, verify TOTP or backup code, and so on                          |
| `auth.sign-out`                                           | Better Auth hook   | Sign-out, with the person who left                                     |
| `auth.step-up`                                            | `performStepUp()`  | `success`, `failure` or `denied`                                       |
| `access.page`, `access.handler`                           | Guards             | `refused`: no session, role too low, enrolment missing, hidden area    |
| `<action id>` (for example `control.user.reset-password`) | `guardAction`      | One event per call: `success`, `failure`, or `refused` (role or input) |
| `admin.create-user`                                       | First-admin script | `success` or `failure`                                                 |

A Visitor who has no session cookie is redirected or rewritten by the Proxy before any guard runs, so that is not an event: an anonymous crawler could otherwise fill the table. Reading the session (`get-session`) is not an event either. A request with an invalid or expired cookie reaches the guard and is recorded. Demo_Mode writes nothing, because it has no database.

Look at recent events on the server:

```bash
sudo -u nexus bash -c 'set -a && . /etc/ytl-nexus/migrate.env && set +a && \
  mariadb -h 127.0.0.1 -u "$NEXUS_DB_USER" -p"$NEXUS_DB_PASSWORD" "$NEXUS_DB_NAME" -e \
  "SELECT ts, actor_id, role, action, target, result, source_ip FROM audit_events ORDER BY id DESC LIMIT 30;"'
```

## What is not covered yet

- Self-service password change and reset of two-factor from Control (Task 19).
- Roles can be changed, accounts disabled or deleted, only by SQL or by Task 19's Control tools.
- The Better Auth rate limiter keeps its counters in memory, so a restart resets that one layer. The five-in-15 lockout is in the database and survives restarts.
- Corporate single sign-on. The account model (`user`, `account`) is Better Auth's standard one, so SSO can replace the password provider later without changing module code.
- Cross-site request protection for the HTTP handler is Better Auth's origin check (enabled explicitly, also under test). Server Functions rely on Next.js's own origin check.

## Tests

| Command                       | Covers                                                                                                                                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test`                | Policy and rules as properties (roles against minimums, session validity, lockout against an independent model), every page against every actor, guard coverage scan, proxy                            |
| `npm run test:integration`    | Real Better Auth on MariaDB: sign-in, cookies, lockout, idle and absolute expiry, revocation, TOTP enrolment, Step_Up, impersonation absent, admin routes off HTTP, audit rows, the first-admin script |
| `npm run test:e2e`            | Every page for the Visitor and each role over HTTP, the 404 equality, the 403 page, Control in a demo session                                                                                          |
| `tests/e2e/auth-live.spec.ts` | Browser, production build, live mode, real database: sign-in for each role, enrolment, Step_Up, reset, session end, lockout, audit. Opt-in; the header of the file lists the commands                  |
