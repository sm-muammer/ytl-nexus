# YTL Nexus security model

> **Purpose:** define the threats, trust boundaries, mandatory controls, destructive-action gates and release evidence for YTL Nexus.
> **Audience:** everyone changing authentication, data, APIs, host services, deployment or administration. Detailed contracts remain in the linked module specs.

## Security objective

YTL Nexus is a controlled internal pilot on one Rocky Linux server. It also has public portfolio routes. A compromise of a public page, user account or backing service must not grant shell access, root access, another user's files or mailbox, internal content, secrets, or unrestricted service control.

## Data classes

| Class      | Examples                                                                                     | Rule                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Public     | Portfolio pages, Yes Experience, public Library items, sanitized Status                      | May reach unauthenticated visitors; contains no hostnames, IPs, logs or internal claims |
| Internal   | Live metrics, service inventory, runbooks, incidents, AI conversations                       | Viewer-or-higher access; never cached publicly                                          |
| Restricted | Mail, SFTP files, account metadata, audit records, Shield findings, Continuity details       | Resource ownership plus role checks on every request                                    |
| Secret     | Password hashes, session secrets, API keys, application passwords, HMAC keys, CA private key | Environment or protected service storage only; never returned, logged or committed      |

## Threats and controls

| Threat                             | Required controls                                                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication bypass              | Better Auth; server-side `requireRole()` in every protected page, Route Handler and Server Function; TOTP for Operator and Administrator; step-up for Control |
| IDOR across users                  | Derive resource owner from the session; check ownership and role in the server data layer; test another user's identifiers                                    |
| Privilege escalation               | Fixed role hierarchy; Administrator-only role changes; no impersonation; audit every change                                                                   |
| Command injection or host takeover | No shell endpoint. `nexus-ops` accepts only three typed operations and fixed units; HMAC, nonce, timestamp and polkit enforce the boundary                    |
| Secret disclosure                  | `/etc/ytl-nexus/*.env` with least-readable permissions; no `NEXT_PUBLIC_` secret; server-only adapters; sanitized logs and errors; gitleaks locally and in CI |
| SQL injection                      | Zod validation plus parameterized Kysely queries; separate least-privilege database users                                                                     |
| CSRF and origin abuse              | Secure, HttpOnly, SameSite cookies; Next.js origin checks; signed webhooks; state-changing requests require authentication and confirmation                   |
| XSS and unsafe content             | React escaping; sanitize WordPress rich text with an explicit allowlist; CSP; no raw untrusted HTML                                                           |
| Brute force                        | Per-account and per-IP rate limits; TOTP; SFTPGo defender; fail2ban for SSH, SFTP and mail                                                                    |
| Data crossover in AI               | Retrieval filters by audience before ranking; retrieved text is untrusted data; no tools; prompt-injection and audience-leak tests                            |
| Public cache leak                  | Dynamic authenticated responses use private/no-store behaviour; public and internal WordPress content are fetched separately                                  |
| File escape                        | SFTPGo homes and virtual permissions; `sdb` mounted `nosuid,nodev,noexec`; remove chmod/chown; path-escape tests                                              |
| Mail relay abuse                   | Virtual users; submission auth; `mynetworks` loopback; external recipients rejected; open-relay test                                                          |
| Destructive operator action        | Named target, confirmation, fresh authorization, allowlist, audit event and bounded blast radius                                                              |
| Supply-chain compromise            | Lockfile, checksum/signature verification for downloaded releases, minimal dependencies, dependency review, no unapproved third-party skills                  |

## Trust boundaries

[`tech.md`](tech.md#2-trust-boundaries) is the canonical runtime diagram. In summary:

1. Apache terminates TLS and is the only public web entry point.
2. Next.js and every backing API listen on loopback or a Unix socket.
3. Browser requests authenticate, authorize and validate at the handler.
4. Server adapters use one least-privilege credential per service.
5. Operating-system changes pass through `nexus-ops` and polkit.
6. Root timers write reports; the web application only reads them.

## Role controls

The canonical role matrix is in [`product.md`](product.md#3-roles). WordPress, mail and SFTP credentials remain separate from Nexus accounts. Root remains SSH-only.

Hidden paths (`/control`, WordPress admin, SFTPGo WebAdmin) reduce discovery only. Authentication, authorization, network binding and source-IP policy provide protection.

## Infrastructure baseline

- Public firewall allowlist: 22, 80, 443, 2022, 587 and 993 only.
- MariaDB, Ollama, Prometheus, node_exporter and SFTPGo administration bind to loopback.
- TLS protects web, submission and IMAPS. HSTS starts only after every intended HTTPS name works.
- systemd units use `NoNewPrivileges`, `ProtectSystem=strict`, `PrivateTmp` and minimal `ReadWritePaths` where compatible.
- SELinux remains disabled for the pilot and is a tracked residual risk. Root SSH and password SSH remain unchanged to avoid lockout; Shield reports them.

## Destructive-action gate

Before deleting old server content, formatting `sdb`, enabling firewalld or changing the hostname:

1. Verify host IP, hostname and machine ID.
2. Create the specified backup and copy it off the server.
3. Verify checksums and test that the archive opens.
4. Show the owner the exact target list and expected effect.
5. Receive explicit approval for that list.
6. Keep a tested rollback path. For firewall work, schedule an automatic rollback before enabling it.

OS user accounts and `sssd` configuration are never deletion targets.

## Verification gates

| Gate                      | Evidence                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------- |
| Every change              | `npm run check`; task-specific unit/integration tests; docs updated                                |
| Every protected endpoint  | Role-matrix tests including no session, wrong role and direct HTTP calls                           |
| Every restricted resource | IDOR tests using another user's identifier                                                         |
| Every mutation            | Matching `audit_events` row for success and refusal                                                |
| Before deployment         | gitleaks over history; production build; end-to-end tests; dependency review                       |
| Server hardening          | External port scan, TLS checks, header checks, loopback binding checks, `systemd-analyze security` |
| Mail                      | Open-relay failure, external-recipient rejection, TLS verification                                 |
| SFTP                      | Password and key login, path escape failure, quota and defender tests                              |
| AI                        | Audience-leak, prompt-injection, rate-limit and stream-abort tests                                 |
| Release                   | Threat model updated; residual risks listed; GPT 5.6 Sol final review in Task 21                   |

## Incident basics

If a secret may have leaked: revoke or rotate it first, then remove it from the repository and logs, scan full history, and record the incident without the secret value. If authorization fails open, disable the affected route or service until tests prove the fix. Preserve logs and audit records before cleanup.

## Detailed security contracts

- [Identity and access](spec/10-identity-and-access.md) and how it is built and operated: [Authentication, roles and audit](security/auth.md)
- [Status and operations agent](spec/12-nexus-status-and-operations.md)
- [Nexus Transfer](spec/16-nexus-transfer.md)
- [Nexus Mail](spec/17-nexus-mail.md)
- [Nexus AI](spec/18-nexus-ai.md)
- [Nexus Continuity](spec/20-nexus-continuity.md)
- [Nexus Shield](spec/21-nexus-shield.md)
- [Nexus Control](spec/23-nexus-control.md)
