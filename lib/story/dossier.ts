import type { ContentItem } from "@/lib/content/types";
import { BACKUP_COMPONENTS } from "@/lib/continuity/model";
import { MODULES } from "@/lib/navigation/modules";
import { ADAPTER_NAMES } from "@/lib/server/adapters/types";
import { SHIELD_CHECKS } from "@/lib/shield/model";

// Static case-study metadata derived from codebase registries and verified docs
// (docs/product.md, docs/tech.md, docs/handover/handover-guide.md). Pure data,
// safe on public pages: no internal hostnames, IPs, or hidden route paths.

export interface DossierFact {
  value: string;
  label: string;
  note: string;
}

export const PROJECT_DOSSIER_FACTS: readonly DossierFact[] = [
  {
    value: String(MODULES.length + 1),
    label: "Platform modules",
    note: "Explore, Operate, Services, and Govern on Nexus Core 01",
  },
  {
    value: String(ADAPTER_NAMES.length),
    label: "Dual-mode adapters",
    note: "Live daemon probes paired with deterministic demo fixtures",
  },
  {
    value: String(SHIELD_CHECKS.length),
    label: "Nexus Shield checks",
    note: "Read-only host security posture benchmarks via root timer",
  },
  {
    value: String(BACKUP_COMPONENTS.length),
    label: "Verified backup targets",
    note: "5 MariaDB databases, config archive, and 3 storage trees",
  },
] as const;

export interface ComparisonColumn {
  heading: string;
  subtitle: string;
  items: readonly string[];
}

export const BEFORE_AFTER_COMPARISON: readonly [
  ComparisonColumn,
  ComparisonColumn,
] = [
  {
    heading: "Legacy Prototype State",
    subtitle: "Disconnected test drafts audited on Nexus Core 01",
    items: [
      "HTTP-only custom PHP webmail with directory listings and plaintext session passwords",
      "Downloadable admin JSON/PHP files paired with a passwordless root sudoers helper",
      "Legacy ftpadmin/vsftpd, old WordPress site, and an unused Podman container",
      "MariaDB exposed on all network interfaces alongside an inactive firewall and disabled NTP",
    ],
  },
  {
    heading: "YTL Nexus v1.0.0",
    subtitle: "Greenfield single-host platform on Rocky Linux 9",
    items: [
      "Apache 2.4 TLS termination, per-request CSP nonces, and 6-port firewalld allowlist",
      "Privilege-separated nexus-ops Unix socket with HMAC signatures and polkit allowlists",
      "5 isolated MariaDB schemas, Better Auth 4-tier RBAC, self-service /account, and TOTP 2FA",
      "Daily backups, weekly scratch-DB restore drills, 11 Shield checks, and offline Demo Mode",
    ],
  },
] as const;

export interface ChapterMeta {
  tag: string;
  takeaway: string;
}

export const CHAPTER_META: Record<string, ChapterMeta> = {
  "01-the-starting-point": {
    tag: "Origin & Audit",
    takeaway:
      "Clean-slate greenfield architecture chosen after auditing insecure prototype drafts on Nexus Core 01.",
  },
  "02-architecture-decisions": {
    tag: "System Design",
    takeaway:
      "One Next.js 16.3.5 + React 19 application paired with isolated MariaDB schemas, Apache TLS routing, and 8 dual-mode adapters.",
  },
  "03-engineering-challenges": {
    tag: "Trade-offs",
    takeaway:
      "Solving rootless ops IPC, non-AVX CPU AI inference, unified service provisioning, and 140k-particle 3D WebGL budgets.",
  },
  "04-security-lessons": {
    tag: "Hardening",
    takeaway:
      "Server-authoritative RBAC, hidden 404 governance, brute-force lockouts, and honest posture reporting without risky auto-remediation.",
  },
  "05-skills-gained": {
    tag: "Engineering Craft",
    takeaway:
      "Bridging Linux systems administration, strict TypeScript TDD, multi-theme accessibility, and automated continuity drills.",
  },
  "06-team-thanks": {
    tag: "Handover",
    takeaway:
      "Transferred cleanly to YTL Communications IT Infrastructure owners with complete operational documentation and zero intern-only dependencies.",
  },
};

export function getChapterMeta(slug: string): ChapterMeta {
  return (
    CHAPTER_META[slug] ?? {
      tag: "Case Study",
      takeaway: "Published through Nexus Studio headless WordPress.",
    }
  );
}

export interface HandoverMember {
  name: string;
  role: string;
  focus: string;
  status: string;
}

export const HANDOVER_TEAM: readonly HandoverMember[] = [
  {
    name: "Logesh",
    role: "Lead Infrastructure Engineer",
    focus:
      "Server baseline, network routing, DNS coordination, hardware compute, and hypervisor settings",
    status: "Owner · Admin ready",
  },
  {
    name: "Azlin",
    role: "Systems & Storage Administrator",
    focus:
      "Backup retention verification, off-box sync drills, SFTPGo quotas, and virtual mailbox administration",
    status: "Owner · Admin ready",
  },
  {
    name: "Sonu",
    role: "Operations & Application Lead",
    focus:
      "Nexus Studio WordPress governance, Status incident response, and local Ollama AI performance",
    status: "Owner · Admin ready",
  },
  {
    name: "Muammer",
    role: "Intern · BSc IT Cloud Engineering (APU Malaysia)",
    focus:
      "Greenfield architecture, Next.js & TypeScript implementation, test suites, deploy scripts, and handover docs",
    status: "Author · Handover lead",
  },
] as const;

export interface ContinueLink {
  href: string;
  title: string;
  description: string;
}

export const CONTINUE_LINKS: readonly ContinueLink[] = [
  {
    href: "/tour",
    title: "Nexus Tour",
    description:
      "Step through all 16 guided slides with presenter mode and interactive stage visuals.",
  },
  {
    href: "/platform",
    title: "Platform",
    description:
      "Inspect the 3-tier ingress topology, 6 trust boundaries, and live runtime services.",
  },
  {
    href: "/library",
    title: "Nexus Library",
    description:
      "Browse public runbooks, FAQs, and operational guides synced from Nexus Studio.",
  },
  {
    href: "/yes",
    title: "Yes Experience",
    description:
      "Explore the Yes 5G brand showcase, coverage checker, and cherry-blossom design.",
  },
] as const;

export function estimateReadingMinutes(
  chapters: readonly Pick<ContentItem, "html">[],
): number {
  const words = chapters.reduce((total, chapter) => {
    const plain = chapter.html
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!plain) return total;
    return total + plain.split(" ").length;
  }, 0);
  return Math.max(1, Math.ceil(words / 200));
}
