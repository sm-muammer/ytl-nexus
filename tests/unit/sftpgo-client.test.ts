// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import {
  createSftpgoClient,
  readSftpgoConfig,
  SftpgoError,
  type SftpgoConfig,
} from "@/lib/server/sftpgo";

// The server-only SFTPGo client (TRF-08): it sends the API key as a header, never
// leaks the key or the address in an error, maps SFTPGo users to the minimal DTO
// and creates accounts with the permissions the spec asks for (no chmod, no chown).

const CONFIG: SftpgoConfig = {
  baseUrl: "http://127.0.0.1:8091/api/v2",
  apiKey: "KEYID.super-secret-value",
  homeBase: "/srv/nexus-transfer",
};

type Call = { url: string; method: string; headers: Headers; body: unknown };

function fakeFetch(
  respond: (call: Call) => { status: number; body?: unknown } | "throw",
) {
  const calls: Call[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      headers: new Headers(init?.headers),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const result = respond(call);
    if (result === "throw")
      throw new TypeError("connect ECONNREFUSED 127.0.0.1:8091");
    return new Response(
      result.body === undefined ? null : JSON.stringify(result.body),
      {
        status: result.status,
        headers: { "content-type": "application/json" },
      },
    );
  }) as typeof fetch;
  return { impl, calls };
}

function sshKey(): string {
  const { publicKey } = generateKeyPairSync("ed25519");
  const der = publicKey.export({ format: "der", type: "spki" });
  const name = Buffer.from("ssh-ed25519");
  const blob = Buffer.concat([
    Buffer.from([0, 0, 0, name.length]),
    name,
    Buffer.from([0, 0, 0, 32]),
    der.subarray(der.length - 32),
  ]);
  return `ssh-ed25519 ${blob.toString("base64")} test`;
}

const rawUser = (over: Record<string, unknown> = {}) => ({
  id: 4,
  status: 1,
  username: "amira",
  description: "Nexus Transfer account",
  additional_info: "nexus-user:user-1",
  public_keys: [],
  home_dir: "/srv/nexus-transfer/amira",
  permissions: { "/": ["list", "download"] },
  quota_size: 1_048_576,
  quota_files: 0,
  used_quota_size: 2048,
  used_quota_files: 3,
  last_login: 1_794_380_000_000,
  created_at: 1_794_000_000_000,
  filters: { web_client: ["shares-disabled"] },
  ...over,
});

describe("configuration", () => {
  it("needs both the URL and the key", () => {
    expect(readSftpgoConfig({})).toBeNull();
    expect(
      readSftpgoConfig({ NEXUS_SFTPGO_URL: "http://x/api/v2" }),
    ).toBeNull();
    expect(
      readSftpgoConfig({
        NEXUS_SFTPGO_URL: "http://127.0.0.1:8091/api/v2/",
        NEXUS_SFTPGO_API_KEY: "k",
      }),
    ).toEqual({
      baseUrl: "http://127.0.0.1:8091/api/v2",
      apiKey: "k",
      homeBase: "/srv/nexus-transfer",
    });
  });

  it("accepts loopback addresses only, so a mistake cannot send the key elsewhere", () => {
    for (const url of [
      "http://example.com/api/v2",
      "http://10.26.64.164:8091/api/v2",
      "https://127.0.0.1.evil.test/api/v2",
      "file:///etc/passwd",
    ]) {
      expect(
        readSftpgoConfig({ NEXUS_SFTPGO_URL: url, NEXUS_SFTPGO_API_KEY: "k" }),
        url,
      ).toBeNull();
    }
  });
});

describe("listing and reading", () => {
  it("sends the key in a header, never in the URL, and maps users to the minimal shape", async () => {
    const { impl, calls } = fakeFetch(() => ({
      status: 200,
      body: [rawUser()],
    }));
    const client = createSftpgoClient(CONFIG, impl);
    const accounts = await client.listAccounts();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "http://127.0.0.1:8091/api/v2/users?limit=500&offset=0&order=ASC",
    );
    expect(calls[0]?.url).not.toContain("secret");
    expect(calls[0]?.headers.get("x-sftpgo-api-key")).toBe(CONFIG.apiKey);
    expect(accounts).toEqual([
      {
        username: "amira",
        enabled: true,
        nexusUserId: "user-1",
        quotaBytes: 1_048_576,
        usedBytes: 2048,
        usedFiles: 3,
        keys: [],
        lastLoginAt: new Date(1_794_380_000_000).toISOString(),
        createdAt: new Date(1_794_000_000_000).toISOString(),
      },
    ]);
    // Nothing that SFTPGo returned beyond the DTO is passed on.
    expect(JSON.stringify(accounts)).not.toContain("home_dir");
    expect(JSON.stringify(accounts)).not.toContain("/srv/");
  });

  it("shows keys as fingerprints, never the key text", async () => {
    const line = sshKey();
    const { impl } = fakeFetch(() => ({
      status: 200,
      body: [rawUser({ public_keys: [line, "garbage that is not a key"] })],
    }));
    const [account] = await createSftpgoClient(CONFIG, impl).listAccounts();
    expect(account?.keys).toHaveLength(2);
    expect(account?.keys[0]?.fingerprint).toMatch(/^SHA256:[A-Za-z0-9+/]{43}$/);
    expect(account?.keys[0]?.type).toBe("ssh-ed25519");
    expect(account?.keys[1]?.fingerprint).toBe("unreadable");
    expect(JSON.stringify(account)).not.toContain(line.split(" ")[1]);
  });

  it("treats a user without the Nexus link as unlinked", async () => {
    const { impl } = fakeFetch(() => ({
      status: 200,
      body: [
        rawUser({ additional_info: "" }),
        rawUser({ username: "b", additional_info: "other" }),
      ],
    }));
    const accounts = await createSftpgoClient(CONFIG, impl).listAccounts();
    expect(accounts.map((a) => a.nexusUserId)).toEqual([null, null]);
  });

  it("reads further pages until one is short", async () => {
    let page = 0;
    const { impl, calls } = fakeFetch(() => {
      page += 1;
      return {
        status: 200,
        body:
          page === 1
            ? Array.from({ length: 500 }, (_, i) =>
                rawUser({ username: `u${i}` }),
              )
            : [rawUser({ username: "last" })],
      };
    });
    const accounts = await createSftpgoClient(CONFIG, impl).listAccounts();
    expect(accounts).toHaveLength(501);
    expect(calls[1]?.url).toContain("offset=500");
  });

  it("returns null for an unknown account and refuses odd names before any request", async () => {
    const { impl, calls } = fakeFetch(() => ({
      status: 404,
      body: { message: "x" },
    }));
    const client = createSftpgoClient(CONFIG, impl);
    expect(await client.getAccount("nobody")).toBeNull();
    await expect(client.getAccount("../admins")).rejects.toMatchObject({
      kind: "invalid",
    });
    expect(calls).toHaveLength(1);
  });
});

describe("errors", () => {
  it("never carry the key, the address or SFTPGo's own message", async () => {
    const { impl } = fakeFetch(() => "throw");
    const failure = await createSftpgoClient(CONFIG, impl)
      .listAccounts()
      .catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(SftpgoError);
    expect((failure as SftpgoError).kind).toBe("unavailable");
    const text = `${(failure as Error).message} ${JSON.stringify(failure)} ${(failure as Error).stack}`;
    expect(text).not.toContain("super-secret");
    expect(text).not.toContain("127.0.0.1");
    expect(text).not.toContain("ECONNREFUSED");
  });

  it("maps statuses to a small set of kinds", async () => {
    const kinds: Record<number, string> = {
      401: "rejected",
      403: "rejected",
      404: "not-found",
      409: "conflict",
      400: "invalid",
      500: "failed",
    };
    for (const [status, kind] of Object.entries(kinds)) {
      const { impl } = fakeFetch(() => ({
        status: Number(status),
        body: {
          message: "a detail with 127.0.0.1 and KEYID.super-secret-value",
        },
      }));
      const failure = await createSftpgoClient(CONFIG, impl)
        .deleteAccount("amira")
        .catch((e: unknown) => e);
      expect((failure as SftpgoError).kind, status).toBe(kind);
      expect(String((failure as Error).message)).not.toContain("super-secret");
    }
  });
});

describe("creating an account", () => {
  it("sets the home under the base, the quota, the link and safe permissions", async () => {
    const { impl, calls } = fakeFetch(() => ({ status: 201, body: rawUser() }));
    await createSftpgoClient(CONFIG, impl).createAccount({
      username: "amira",
      password: "pw-pw-pw-pw-pw-pw-pw-pw",
      nexusUserId: "user-1",
      quotaBytes: 500 * 1024 * 1024,
      email: "amira@example.com",
    });
    const call = calls[0];
    expect(call?.method).toBe("POST");
    expect(call?.url).toBe("http://127.0.0.1:8091/api/v2/users");
    const body = call?.body as Record<string, unknown>;
    expect(body.username).toBe("amira");
    expect(body.home_dir).toBe("/srv/nexus-transfer/amira");
    expect(body.status).toBe(1);
    expect(body.quota_size).toBe(500 * 1024 * 1024);
    expect(body.additional_info).toBe("nexus-user:user-1");
    expect(body.public_keys).toEqual([]);

    const permissions = (body.permissions as Record<string, string[]>)["/"];
    expect(permissions).toContain("list");
    expect(permissions).toContain("upload");
    for (const forbidden of ["*", "chmod", "chown", "create_symlinks"]) {
      expect(permissions, forbidden).not.toContain(forbidden);
    }
    const filters = body.filters as Record<string, string[]>;
    expect(filters.denied_protocols).toEqual(["FTP", "DAV"]);
    expect(filters.web_client).toContain("publickey-change-disabled");
    expect(filters.web_client).toContain("shares-disabled");
  });

  it("returns a conflict when the name is taken", async () => {
    const { impl } = fakeFetch(() => ({
      status: 409,
      body: { message: "exists" },
    }));
    await expect(
      createSftpgoClient(CONFIG, impl).createAccount({
        username: "amira",
        password: "pw-pw-pw-pw-pw-pw-pw-pw",
        nexusUserId: "user-1",
        quotaBytes: 100,
      }),
    ).rejects.toMatchObject({ kind: "conflict" });
  });
});

describe("changing an account", () => {
  /** SFTPGo replaces the whole user on PUT, so the client reads, changes, writes. */
  function server() {
    let user = rawUser();
    return fakeFetch((call) => {
      if (call.method === "GET") return { status: 200, body: user };
      if (call.method === "PUT") {
        user = { ...(call.body as typeof user) };
        return { status: 200, body: { message: "User updated" } };
      }
      return { status: 200, body: {} };
    });
  }

  it("disables an account and disconnects it", async () => {
    const { impl, calls } = server();
    await createSftpgoClient(CONFIG, impl).setEnabled("amira", false);
    const put = calls.find((c) => c.method === "PUT");
    expect(put?.url).toBe(
      "http://127.0.0.1:8091/api/v2/users/amira?disconnect=1",
    );
    const body = put?.body as Record<string, unknown>;
    expect(body.status).toBe(0);
    // The rest of the user is carried over, not reset.
    expect(body.home_dir).toBe("/srv/nexus-transfer/amira");
    expect(body.additional_info).toBe("nexus-user:user-1");
    expect(body.quota_size).toBe(1_048_576);
    expect(body.password).toBeUndefined();
  });

  it("sets a quota", async () => {
    const { impl, calls } = server();
    await createSftpgoClient(CONFIG, impl).setQuota("amira", 7 * 1024 * 1024);
    const body = calls.find((c) => c.method === "PUT")?.body as Record<
      string,
      unknown
    >;
    expect(body.quota_size).toBe(7 * 1024 * 1024);
    expect(calls.find((c) => c.method === "PUT")?.url).not.toContain(
      "disconnect=1",
    );
  });

  it("resets a password and disconnects the user", async () => {
    const { impl, calls } = server();
    await createSftpgoClient(CONFIG, impl).setPassword(
      "amira",
      "new-new-new-new-new-new",
    );
    const put = calls.find((c) => c.method === "PUT");
    expect((put?.body as Record<string, unknown>).password).toBe(
      "new-new-new-new-new-new",
    );
    expect(put?.url).toContain("disconnect=1");
  });

  it("adds a key, refuses a duplicate and refuses an eleventh", async () => {
    const line = sshKey();
    const { impl, calls } = server();
    const client = createSftpgoClient(CONFIG, impl);
    expect(await client.addKey("amira", line)).toBe("added");
    const put = calls.find((c) => c.method === "PUT");
    expect((put?.body as { public_keys: string[] }).public_keys).toEqual([
      line,
    ]);

    const dup = fakeFetch((call) =>
      call.method === "GET"
        ? { status: 200, body: rawUser({ public_keys: [line] }) }
        : { status: 200 },
    );
    expect(
      await createSftpgoClient(CONFIG, dup.impl).addKey("amira", line),
    ).toBe("duplicate");
    expect(dup.calls.some((c) => c.method === "PUT")).toBe(false);

    const full = fakeFetch((call) =>
      call.method === "GET"
        ? {
            status: 200,
            body: rawUser({ public_keys: Array.from({ length: 10 }, sshKey) }),
          }
        : { status: 200 },
    );
    expect(
      await createSftpgoClient(CONFIG, full.impl).addKey("amira", sshKey()),
    ).toBe("limit");
    expect(full.calls.some((c) => c.method === "PUT")).toBe(false);
  });

  it("refuses text that is not a public key", async () => {
    const { impl, calls } = server();
    expect(
      await createSftpgoClient(CONFIG, impl).addKey(
        "amira",
        'command="x" ssh-ed25519 AAAA',
      ),
    ).toBe("invalid");
    expect(calls).toHaveLength(0);
  });

  it("removes a key by fingerprint and reports a fingerprint it does not hold", async () => {
    const keep = sshKey();
    const drop = sshKey();
    const { parsePublicKey } = await import("@/lib/transfer/keys");
    let user = rawUser({ public_keys: [keep, drop] });
    const { impl, calls } = fakeFetch((call) => {
      if (call.method === "GET") return { status: 200, body: user };
      user = call.body as typeof user;
      return { status: 200 };
    });
    const client = createSftpgoClient(CONFIG, impl);
    const missing = `SHA256:${"A".repeat(43)}`;
    expect(await client.removeKey("amira", missing)).toBe("not-found");
    expect(calls.some((c) => c.method === "PUT")).toBe(false);

    expect(
      await client.removeKey("amira", parsePublicKey(drop)!.fingerprint),
    ).toBe("removed");
    const put = calls.find((c) => c.method === "PUT");
    expect((put?.body as { public_keys: string[] }).public_keys).toEqual([
      keep,
    ]);
  });

  it("reports a missing account instead of creating one", async () => {
    const { impl } = fakeFetch(() => ({ status: 404 }));
    await expect(
      createSftpgoClient(CONFIG, impl).setQuota("ghost", 1),
    ).rejects.toMatchObject({
      kind: "not-found",
    });
  });
});

describe("deleting", () => {
  it("calls DELETE on the one user", async () => {
    const { impl, calls } = fakeFetch(() => ({
      status: 200,
      body: { message: "ok" },
    }));
    await createSftpgoClient(CONFIG, impl).deleteAccount("amira");
    expect(calls[0]?.method).toBe("DELETE");
    expect(calls[0]?.url).toBe("http://127.0.0.1:8091/api/v2/users/amira");
  });
});

describe("status", () => {
  it("reports ok when SFTP is listening and the database answers", async () => {
    const { impl, calls } = fakeFetch(() => ({
      status: 200,
      body: {
        ssh: { is_active: true },
        data_provider: { is_active: true },
        ftp: { is_active: false },
        webdav: { is_active: false },
      },
    }));
    expect(await createSftpgoClient(CONFIG, impl).health()).toBe("ok");
    expect(calls[0]?.url).toBe("http://127.0.0.1:8091/api/v2/status");
  });

  it("reports down when it cannot be reached and degraded when SFTP is off", async () => {
    expect(
      await createSftpgoClient(CONFIG, fakeFetch(() => "throw").impl).health(),
    ).toBe("down");
    const off = fakeFetch(() => ({
      status: 200,
      body: { ssh: { is_active: false }, data_provider: { is_active: true } },
    }));
    expect(await createSftpgoClient(CONFIG, off.impl).health()).toBe(
      "degraded",
    );
  });
});
