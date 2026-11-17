# YTL Nexus threat model and security review

> **Purpose:** document the threat landscape, trust boundaries, mitigations, verification results, and residual risks for YTL Nexus.
> **Audience:** the YTL IT Infrastructure team, security auditors, and system maintainers.

## 1. System Overview & Trust Boundaries

YTL Nexus runs on a single Rocky Linux 9 server (`Nexus Core 01`, `10.26.64.164`) powering both web applications and underlying infrastructure subsystems.

```
 Internet / Corporate LAN (10.0.0.0/8)
                    │
                    ▼  (TCP 80/443, 587, 993, 2022)
┌─────────────────────────────────────────────────────────────┐
│ Rocky Linux 9 Host (Nexus Core 01)                          │
│                                                             │
│  Public Perimeter (Firewalld / Apache Reverse Proxy):       │
│  - Port 80 (HTTP -> 443 Redirect)                           │
│  - Port 443 (HTTPS with TLS & HSTS + Dynamic CSP Nonces)    │
│  - Port 587 (Postfix Submission with STARTTLS & SASL)       │
│  - Port 993 (Dovecot IMAPS with TLS)                        │
│  - Port 2022 (SFTPGo SFTP with Defender & Chroot)           │
│                                                             │
│  Loopback Boundaries (127.0.0.1 Only):                      │
│  - Next.js Web Application (:3000)                          │
│  - MariaDB Database Engine (:3306)                          │
│  - Ollama Local AI Engine (:11434)                          │
│  - Prometheus Time-Series Metrics (:9090)                   │
│  - Node Exporter (:9100)                                    │
│  - SFTPGo WebClient Portal (:8090)                          │
│  - SFTPGo WebAdmin & REST API (:8091)                       │
│  - SFTPGo Prometheus Metrics (:10000)                       │
│  - Nexus Ops Agent (/run/ytl-nexus/ops.sock)                │
└─────────────────────────────────────────────────────────────┘
```

### Trust Boundary Rules

1. **Public vs. Loopback:** Internal databases, monitoring metrics, AI engines, and administration endpoints never listen on public interfaces.
2. **Web to Host Operations:** The web process (`next-server` running under unprivileged user `nexus-web`) cannot execute arbitrary shell commands or access root subsystems. Administrative commands communicate with the isolated `nexus-ops` agent over a Unix domain socket using signed HMAC requests and a strict allowlist.
3. **Database Segregation:** Web application, Mail, Roundcube, SFTPGo, and WordPress use separate database users with restricted schema permissions.

---

## 2. Threat Analysis & Mitigations

| Threat ID  | Threat Vector                                        | Description                                                                                                                 | Implemented Mitigation                                                                                                                                                                                                                                     | Verification                                                                      |
| ---------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **THR-01** | **Unauthorized Access / Privilege Escalation**       | Attacker attempts to access administrative pages (`/control`, `/shield`, `/continuity`) or mutate configuration.            | Strict server-side authorization (`requireRole("admin")` or `requireRole("operator")`) backed by Zod input validation on every Server Function and Route Handler. Hidden routes return 404/403. Step-up reauthentication required for sensitive mutations. | Verified in `tests/e2e/security.spec.ts` & `tests/e2e/control.spec.ts`.           |
| **THR-02** | **XSS & Content Injection**                          | Malicious input injected into rendered views or markdown documents.                                                         | Strict Content Security Policy with dynamic cryptographically random nonces per request (`script-src 'self' 'nonce-...' 'strict-dynamic'`), disabling `unsafe-eval` and `unsafe-inline` in production. KaTeX and Markdown renderers sanitize HTML tags.    | Verified in `tests/e2e/security.spec.ts`.                                         |
| **THR-03** | **Credential Stuffing & Brute Force**                | Automated dictionary attacks against sign-in, mail, or SFTP.                                                                | Fail2ban active with jails for `sshd`, `postfix`, and `sftpgo`. SFTPGo built-in Defender automatically bans IPs after 5 failures. In-app rate limiting (`lib/server/rate-limit.ts`) guards `/api/auth`, `/api/library`, and `/api/ai/chat`.                | Verified via live fail2ban status on host and synthetic flood tests.              |
| **THR-04** | **Arbitrary Remote Code Execution via Ops**          | Compromised web application attempts to run malicious system commands.                                                      | `nexus-ops` agent accepts only allowlisted units (`nexus-web`, `nexus-worker`, `nexus-ai`) and bounded log lines. Requests must be signed with HMAC-SHA256, timestamped within 30s, and non-replayable.                                                    | Verified in `tests/unit/ops-client.test.ts` and `tests/unit/ops-actions.test.ts`. |
| **THR-05** | **Direct Database or Metrics Exposure**              | External actor queries MariaDB or Prometheus directly.                                                                      | MariaDB `bind-address = 127.0.0.1`, Prometheus `--web.listen-address=127.0.0.1:9090`, Ollama `OLLAMA_HOST=127.0.0.1:11434`. Firewalld rejects all non-whitelisted ports on `ens3`.                                                                         | Verified via `ss -tulpn` and live port scans.                                     |
| **THR-06** | **Credential / Secret Leakage in Code**              | Developer commits passwords, API keys, or certificates into git.                                                            | Pre-commit hook runs `gitleaks`. Zero production secrets exist in git; all live credentials reside in `/etc/ytl-nexus/*.env` with 0600 permissions.                                                                                                        | Verified via `gitleaks detect` scanning full history (61 commits, 0 leaks).       |
| **THR-07** | **Insecure Deserialization / CSV Formula Injection** | Attacker injects formula triggers (`=`, `@`, `+`, `-`) into audit logs or site tables to exploit admin spreadsheet viewers. | CSV export pipelines disarm formulas by prepending single quotes (`'`) to any cell starting with trigger characters.                                                                                                                                       | Verified in `tests/unit/audit-completeness.test.ts`.                              |
| **THR-08** | **Cross-Tenant IDOR on SFTP / Mail**                 | Authenticated user attempts to view or modify another user's files or mailboxes.                                            | All transfer and mailbox lookups bind explicitly to the authenticated user's session identifier or require administrative role step-up.                                                                                                                    | Verified in `tests/e2e/transfer.spec.ts` and `tests/e2e/mail.spec.ts`.            |

---

## 3. Host Sandbox Security (`systemd-analyze security`)

The platform's background systemd units have been hardened according to principle of least privilege:

```
UNIT                 EXPOSURE LEVEL    STATUS
nexus-web.service         1.7          OK (Low exposure)
nexus-worker.service      1.5          OK (Low exposure)
nexus-ops.service         1.6          OK (Low exposure)
```

**Key Sandboxing Directives Applied:**

- `NoNewPrivileges=yes`: Prevents gaining capabilities via setuid/setgid binaries.
- `ProtectSystem=strict`: Root file hierarchy is mounted read-only for the services.
- `ProtectHome=yes`: User home directories are invisible to the daemons.
- `PrivateTmp=yes`: Isolated `/tmp` and `/var/tmp` namespaces.
- `ProtectKernelTunables=yes` & `ProtectControlGroups=yes`: Kernel variables and cgroups are protected.
- `CapabilityBoundingSet=`: Dropped unnecessary Linux capabilities.

---

## 4. Residual Risks & Accepted Constraints

1. **SELinux Mode (`Permit` / Disabled):**
   - _Status:_ Currently disabled on Core 01 host image.
   - _Mitigation:_ Compensated by strict firewalld boundaries, systemd unit isolation (`ProtectSystem=strict`, `NoNewPrivileges=yes`), and unprivileged daemon users (`nexus-web`, `vmail`, `sftpgo`).
   - _Roadmap:_ Re-enable SELinux in Enforcing mode with custom policy modules for Nexus.

2. **Root SSH Access:**
   - _Status:_ `PermitRootLogin` is active over port 22 on the internal corporate subnet (10.x).
   - _Mitigation:_ Firewalld restricts port 22; Fail2ban bans brute-force attempts.
   - _Roadmap:_ Transition server administration to personal named accounts with `sudo` and SSH public keys, disabling direct root logins.

3. **Internal Private CA:**
   - _Status:_ HTTPS and mail use a self-signed root CA (`nexus-internal-ca.crt`).
   - _Mitigation:_ CA installed on internal client workstations.
   - _Roadmap:_ Transition public services to Let's Encrypt or corporate internal PKI once external DNS entries resolve.
