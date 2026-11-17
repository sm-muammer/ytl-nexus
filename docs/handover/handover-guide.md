# YTL Nexus handover and operations roadmap

> **Purpose:** document ownership, account inventories, credential rotation procedures, known operational constraints, and the platform release checklist for handing YTL Nexus over to the IT Infrastructure team.
> **Audience:** the YTL IT Infrastructure team (Logesh, Azlin, Sonu) and system administrators.

## 1. System Ownership & Roles

| Name        | Role                            | Responsibilities                                                                                  | Handover Status                |
| ----------- | ------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------ |
| **Logesh**  | Lead Infrastructure Engineer    | Server baseline, network routing, DNS coordination, hardware compute, hypervisor settings         | Administrator account prepared |
| **Azlin**   | Systems & Storage Administrator | Backup retention verification, off-box sync drills, SFTPGo and virtual mailbox management         | Administrator account prepared |
| **Sonu**    | Operations & Application Lead   | WordPress Studio content governance, status incidents management, AI model performance monitoring | Administrator account prepared |
| **Muammer** | Intern / Core Developer         | Initial architecture, development, automated test suites, deployment scripts, handover docs       | Author & Handover Lead         |

---

## 2. Platform Account Inventory (Non-Secret)

All service accounts operate with minimal required privileges:

| Service / Subsystem | Account / Username | Purpose                                                   | Storage / Binding Location                 |
| ------------------- | ------------------ | --------------------------------------------------------- | ------------------------------------------ |
| **OS Host**         | `root`             | System maintenance, backup timer, and restore test runner | `/root/` on `10.26.64.164`                 |
| **Next.js Web**     | `nexus-web`        | Runs the Next.js production web server (`:3000`)          | Unprivileged system user                   |
| **Worker Engine**   | `nexus-web`        | Ingests shield scans, metrics, and background jobs        | Unprivileged system user                   |
| **Ops Agent**       | `nexus-ops`        | Controlled service restarts and bounded log inspection    | Systemd daemon (`/run/ytl-nexus/ops.sock`) |
| **File Transfer**   | `sftpgo`           | Manages SFTP transfers and browser file portal            | Port 2022 and loopback                     |
| **Mail Storage**    | `vmail` (UID 978)  | Virtual Maildir owner for Postfix / Dovecot               | `/var/mail/vmail/`                         |
| **Web Server**      | `apache`           | HTTPS reverse proxy, static assets, TLS termination       | Ports 80 & 443                             |
| **Database**        | `nexus_web`        | MariaDB user for Next.js web application (`ytl_nexus`)    | Parameterized SQL access                   |
| **Database**        | `nexus_ingest`     | MariaDB user with INSERT-only permissions for backup logs | System scripts                             |
| **Database**        | `nexus_mail`       | MariaDB user for Dovecot / Postfix virtual mailboxes      | Localhost                                  |
| **Database**        | `nexus_roundcube`  | MariaDB user for Roundcube webmail data                   | Localhost                                  |
| **Database**        | `nexus_sftpgo`     | MariaDB user for SFTPGo database                          | Localhost                                  |
| **Database**        | `nexus_wordpress`  | MariaDB user for WordPress CMS                            | Localhost                                  |

---

## 3. Credential Rotation Checklist

Whenever an administrator leaves the team or periodic rotation is scheduled, rotate credentials following this sequence:

1. **Better Auth Secret (`BETTER_AUTH_SECRET`):**
   - Location: `/etc/ytl-nexus/web.env`
   - Impact: Invalidates active web sessions and encrypts stored 2FA secrets.
   - Command: `openssl rand -hex 32` -> update file -> `systemctl restart nexus-web`.
2. **Operations HMAC Secret (`NEXUS_OPS_SECRET`):**
   - Location: `/etc/ytl-nexus/ops.env` & `/etc/ytl-nexus/web.env`
   - Command: `openssl rand -hex 32` -> update both files -> `systemctl restart nexus-ops nexus-web`.
3. **Database Passwords:**
   - Update password in MariaDB: `ALTER USER 'nexus_web'@'localhost' IDENTIFIED BY '<new-password>'; FLUSH PRIVILEGES;`
   - Update corresponding environment file (`/etc/ytl-nexus/database.env`) -> `systemctl restart nexus-web nexus-worker`.
4. **SFTPGo API Key:**
   - Generate new API key in SFTPGo Admin -> update `/etc/ytl-nexus/web.env` (`SFTPGO_API_KEY`) -> `systemctl restart nexus-web`.
5. **Internal CA & Server TLS Certificates:**
   - Follow renewal steps in `docs/operations/server-baseline.md`. Existing certificate is valid until **2027-12-04**.

---

## 4. Known Operational Risks & Mitigations

1. **Single Host Deployment (Nexus Core 01):**
   - _Risk:_ No automatic high-availability failover if the virtual machine fails.
   - _Mitigation:_ Daily root backups run at 02:00 UTC with automated weekly restore drills. Off-box backups can be synced to any external workstation via `rsync -avz -e ssh root@10.26.64.164:/var/backups/nexus/ <destination>/`.
2. **Hypervisor Virtual CPU without AVX2:**
   - _Risk:_ Ollama running on virtual Intel Xeon Westmere without AVX/AVX2 extensions limits local inference speed.
   - _Mitigation:_ We selected `gemma3:1b-it-qat` (8.3 tok/s), which runs reliably within CPU capabilities.
   - _Recommendation:_ Enable host CPU passthrough (`host-passthrough`) in Proxmox / KVM hypervisor settings to unlock modern vector instructions and run larger models (e.g. `gemma3:4b`).
3. **Internal Private CA:**
   - _Risk:_ Browsers show security warnings unless `nexus-internal-ca.crt` is installed.
   - _Mitigation:_ Installation instructions provided in `docs/handover/ca-install.md`.

---

## 5. Operations Roadmap & Future Enhancements

- [ ] **SELinux Hardening:** Build custom targeted SELinux policy modules to move from permissive/disabled to Enforcing mode.
- [ ] **Corporate SSO Federation:** Integrate Better Auth with corporate Active Directory / SAML / OIDC.
- [ ] **External Mail Delivery:** Add MX records, SPF, DKIM, and DMARC if external internet mail delivery is needed beyond internal virtual domains.
- [ ] **Automated Off-site Cloud Backup:** Push encrypted daily snapshots to S3-compatible cloud storage.

---

## 6. Handover Rehearsal Script

When conducting the final walkthrough with the team:

1. **Nexus Tour (`/tour`):** Press `P` for Presenter Mode; step through all 16 modules highlighting the architectural integration.
2. **Nexus Control (`/control`):** Demonstrate creating a user account, assigning roles, setting storage quotas, and managing services.
3. **Nexus Continuity (`/continuity`):** Show the verified backup logs and the one-command off-box synchronization.
4. **Nexus Shield (`/shield`):** Review real-time security posture scanning and residual risk explanations.
5. **Nexus AI (`/ai`):** Run a sample prompt asking for deployment procedures to demonstrate real-time RAG streaming.
