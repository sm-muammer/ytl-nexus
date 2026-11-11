import "server-only";
import { MAX_KEYS, parsePublicKey } from "@/lib/transfer/keys";
import type { TransferAccount, TransferKey } from "@/lib/transfer/types";
import { USERNAME_PATTERN } from "@/lib/transfer/validation";

// The server-only SFTPGo client (TRF-08). It talks to the REST API on
// 127.0.0.1:8091 with an API key from the environment file. The key travels in a
// header, is never put in a URL, and no error carries it, the address or SFTPGo's
// own message. Pages never see a raw SFTPGo user: everything leaves this file as
// a TransferAccount (no home directory, no hash, no key text).

export type SftpgoErrorKind =
  "unavailable" | "rejected" | "not-found" | "conflict" | "invalid" | "failed";

const MESSAGES: Record<SftpgoErrorKind, string> = {
  unavailable: "The file transfer service does not answer.",
  rejected: "The file transfer service refused the request.",
  "not-found": "The account does not exist.",
  conflict: "An account with that name already exists.",
  invalid: "The file transfer service did not accept the values.",
  failed: "The file transfer service reported an error.",
};

export class SftpgoError extends Error {
  readonly kind: SftpgoErrorKind;
  constructor(kind: SftpgoErrorKind) {
    super(MESSAGES[kind]);
    this.name = "SftpgoError";
    this.kind = kind;
  }
}

export type SftpgoConfig = {
  /** For example `http://127.0.0.1:8091/api/v2`, without a trailing slash. */
  baseUrl: string;
  apiKey: string;
  /** Parent folder of the account homes. */
  homeBase: string;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]", "::1"]);
const DEFAULT_HOME_BASE = "/srv/nexus-transfer";
const LINK_PREFIX = "nexus-user:";
const LINK_PATTERN = /^nexus-user:([A-Za-z0-9_-]{1,64})$/;
const PAGE = 500;
const MAX_PAGES = 20;
const TIMEOUT_MS = 5000;

/**
 * Reads the URL and the key. The URL must point at this machine: a typo or a
 * changed environment file can then never send the key to another host.
 */
export function readSftpgoConfig(
  env: Record<string, string | undefined> = process.env,
): SftpgoConfig | null {
  const url = env.NEXUS_SFTPGO_URL;
  const apiKey = env.NEXUS_SFTPGO_API_KEY;
  if (!url || !apiKey) return null;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) return null;
  return {
    baseUrl: url.replace(/\/+$/, ""),
    apiKey,
    homeBase: (env.NEXUS_SFTPGO_HOME_BASE ?? DEFAULT_HOME_BASE).replace(
      /\/+$/,
      "",
    ),
  };
}

// ---- SFTPGo's own shapes (only what is read) ---------------------------------------

type RawUser = {
  status?: number;
  username?: string;
  additional_info?: string;
  public_keys?: string[];
  quota_size?: number;
  used_quota_size?: number;
  used_quota_files?: number;
  last_login?: number;
  created_at?: number;
  [field: string]: unknown;
};

/** Everything except chmod, chown and symlinks (requirement 12.5). */
const USER_PERMISSIONS = [
  "list",
  "download",
  "upload",
  "overwrite",
  "delete",
  "rename",
  "create_dirs",
  "chtimes",
  "copy",
] as const;

/** Options that keep keys and sharing under the Administrator's control. */
const WEB_CLIENT_OPTIONS = [
  "publickey-change-disabled",
  "tls-cert-change-disabled",
  "api-key-auth-change-disabled",
  "info-change-disabled",
  "shares-disabled",
] as const;

function isoOrNull(ms: unknown): string | null {
  return typeof ms === "number" && Number.isFinite(ms) && ms > 0
    ? new Date(ms).toISOString()
    : null;
}

function toKey(line: string): TransferKey {
  const parsed = parsePublicKey(line);
  return parsed
    ? {
        fingerprint: parsed.fingerprint,
        type: parsed.type,
        comment: parsed.comment,
      }
    : { fingerprint: "unreadable", type: "unknown", comment: "" };
}

function toAccount(raw: RawUser): TransferAccount {
  const link = LINK_PATTERN.exec(raw.additional_info ?? "");
  return {
    username: String(raw.username ?? ""),
    enabled: raw.status === 1,
    nexusUserId: link ? (link[1] as string) : null,
    quotaBytes: Number(raw.quota_size ?? 0),
    usedBytes: Number(raw.used_quota_size ?? 0),
    usedFiles: Number(raw.used_quota_files ?? 0),
    keys: (raw.public_keys ?? []).map(toKey),
    lastLoginAt: isoOrNull(raw.last_login),
    createdAt: isoOrNull(raw.created_at),
  };
}

function kindOf(status: number): SftpgoErrorKind {
  if (status === 401 || status === 403) return "rejected";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status === 400 || status === 422) return "invalid";
  return "failed";
}

export type NewAccount = {
  username: string;
  /** Set once; SFTPGo stores only a hash. */
  password: string;
  nexusUserId: string;
  quotaBytes: number;
  email?: string;
};

export type KeyAddResult = "added" | "duplicate" | "limit" | "invalid";
export type KeyRemoveResult = "removed" | "not-found";
export type SftpgoHealth = "ok" | "degraded" | "down";

export type SftpgoClient = ReturnType<typeof createSftpgoClient>;

export function createSftpgoClient(
  config: SftpgoConfig,
  fetchImpl: typeof fetch = fetch,
) {
  async function call(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${config.baseUrl}${path}`, {
        method,
        headers: {
          "X-SFTPGO-API-KEY": config.apiKey,
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new SftpgoError("unavailable");
    }
    if (!response.ok) throw new SftpgoError(kindOf(response.status));
    try {
      const text = await response.text();
      return text ? (JSON.parse(text) as unknown) : null;
    } catch {
      throw new SftpgoError("failed");
    }
  }

  /** Every route builds its path from a name that passed the same pattern as Control's input. */
  function userPath(username: string): string {
    if (!USERNAME_PATTERN.test(username)) throw new SftpgoError("invalid");
    return `/users/${encodeURIComponent(username)}`;
  }

  async function readRaw(username: string): Promise<RawUser> {
    const raw = await call("GET", userPath(username));
    if (typeof raw !== "object" || raw === null)
      throw new SftpgoError("failed");
    return raw as RawUser;
  }

  /** SFTPGo replaces the whole user on PUT, so read it, change it, write it back. */
  async function change(
    username: string,
    mutate: (user: RawUser) => void,
    options: { disconnect?: boolean } = {},
  ): Promise<void> {
    const user = await readRaw(username);
    mutate(user);
    const query = options.disconnect ? "?disconnect=1" : "";
    await call("PUT", `${userPath(username)}${query}`, user);
  }

  return {
    async listAccounts(): Promise<TransferAccount[]> {
      const accounts: TransferAccount[] = [];
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const rows = await call(
          "GET",
          `/users?limit=${PAGE}&offset=${page * PAGE}&order=ASC`,
        );
        if (!Array.isArray(rows)) throw new SftpgoError("failed");
        for (const row of rows) accounts.push(toAccount(row as RawUser));
        if (rows.length < PAGE) break;
      }
      return accounts;
    },

    async getAccount(username: string): Promise<TransferAccount | null> {
      try {
        return toAccount(await readRaw(username));
      } catch (error) {
        if (error instanceof SftpgoError && error.kind === "not-found") {
          return null;
        }
        throw error;
      }
    },

    async createAccount(input: NewAccount): Promise<void> {
      if (!USERNAME_PATTERN.test(input.username))
        throw new SftpgoError("invalid");
      await call("POST", "/users", {
        status: 1,
        username: input.username,
        password: input.password,
        email: input.email ?? "",
        description: "Nexus Transfer account",
        additional_info: `${LINK_PREFIX}${input.nexusUserId}`,
        public_keys: [],
        home_dir: `${config.homeBase}/${input.username}`,
        uid: 0,
        gid: 0,
        max_sessions: 10,
        quota_size: input.quotaBytes,
        quota_files: 0,
        permissions: { "/": [...USER_PERMISSIONS] },
        filters: {
          denied_protocols: ["FTP", "DAV"],
          web_client: [...WEB_CLIENT_OPTIONS],
        },
        filesystem: { provider: 0 },
      });
    },

    async setEnabled(username: string, enabled: boolean): Promise<void> {
      await change(
        username,
        (user) => {
          user.status = enabled ? 1 : 0;
        },
        { disconnect: !enabled },
      );
    },

    async setQuota(username: string, quotaBytes: number): Promise<void> {
      await change(username, (user) => {
        user.quota_size = quotaBytes;
      });
    },

    async setPassword(username: string, password: string): Promise<void> {
      await change(
        username,
        (user) => {
          user.password = password;
        },
        { disconnect: true },
      );
    },

    async addKey(username: string, text: string): Promise<KeyAddResult> {
      const parsed = parsePublicKey(text);
      if (!parsed) return "invalid";
      const user = await readRaw(username);
      const keys = user.public_keys ?? [];
      if (
        keys.some((k) => parsePublicKey(k)?.fingerprint === parsed.fingerprint)
      ) {
        return "duplicate";
      }
      if (keys.length >= MAX_KEYS) return "limit";
      user.public_keys = [...keys, parsed.normalized];
      await call("PUT", userPath(username), user);
      return "added";
    },

    async removeKey(
      username: string,
      fingerprint: string,
    ): Promise<KeyRemoveResult> {
      const user = await readRaw(username);
      const keys = user.public_keys ?? [];
      const kept = keys.filter(
        (k) => parsePublicKey(k)?.fingerprint !== fingerprint,
      );
      if (kept.length === keys.length) return "not-found";
      user.public_keys = kept;
      // Disconnect: a session opened with the removed key must not stay.
      await call("PUT", `${userPath(username)}?disconnect=1`, user);
      return "removed";
    },

    async deleteAccount(username: string): Promise<void> {
      await call("DELETE", userPath(username));
    },

    /** ok: SFTP listens and the database answers. Never throws. */
    async health(): Promise<SftpgoHealth> {
      try {
        const status = (await call("GET", "/status")) as {
          ssh?: { is_active?: boolean };
          data_provider?: { is_active?: boolean };
        } | null;
        return status?.ssh?.is_active && status.data_provider?.is_active
          ? "ok"
          : "degraded";
      } catch {
        return "down";
      }
    },
  };
}
