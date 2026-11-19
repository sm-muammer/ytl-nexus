// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import type { AuditEventInput } from "@/lib/server/db/audit";
import type { Identity } from "@/lib/server/policy";

// Requirements 12.16 to 12.18: every Control action on a file transfer account
// is Administrator-only with a fresh Step_Up, validated, and writes exactly one
// audit event (Property 5). Nothing reaches SFTPGo when the guard refuses or the
// input is hostile, and Demo_Mode changes nothing.

const events: AuditEventInput[] = [];
let identity: Identity;

vi.mock("@/lib/server/auth/runtime", () => ({
  getAuthRuntime: () => ({ audit: async () => {} }),
}));

vi.mock("@/lib/server/auth/service", () => ({
  generatePassword: () => "generated-password-0123456789",
  findUserEmail: async (_rt: unknown, id: string) =>
    id === "user-1" || id === "user-2" ? `${id}@example.com` : null,
}));

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

vi.mock("@/lib/server/guards", async () => {
  const { createGuards } = await import("@/lib/server/guards-core");
  const nav = {
    redirect: () => {
      throw new Error("redirect");
    },
    notFound: () => {
      throw new Error("notFound");
    },
    forbidden: () => {
      throw new Error("forbidden");
    },
  };
  return createGuards({
    now: () => Date.now(),
    identity: async () => identity,
    sourceIp: async () => "10.26.1.20",
    audit: async (e) => {
      if (process.env.NEXUS_MODE === "demo") return;
      events.push(e);
    },
    nav,
  });
});

const actions = await import("@/lib/server/transfer-actions");

type Call = { url: string; method: string; body: unknown };
let calls: Call[];
let users: Record<string, unknown>[];
let sftpgoDown = false;

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
  return `ssh-ed25519 ${blob.toString("base64")} t`;
}

const sftpgoUser = (over: Record<string, unknown> = {}) => ({
  status: 1,
  username: "amira",
  additional_info: "nexus-user:user-1",
  public_keys: [],
  quota_size: 1024,
  ...over,
});

beforeEach(() => {
  events.length = 0;
  calls = [];
  users = [sftpgoUser()];
  sftpgoDown = false;
  vi.stubEnv("NEXUS_MODE", "live");
  vi.stubEnv("NEXUS_SFTPGO_URL", "http://127.0.0.1:8091/api/v2");
  vi.stubEnv("NEXUS_SFTPGO_API_KEY", "KEYID.never-shown");
  vi.stubGlobal(
    "fetch",
    async (input: RequestInfo | URL, init?: RequestInit) => {
      if (sftpgoDown) throw new TypeError("connect ECONNREFUSED");
      const url = String(input);
      const method = init?.method ?? "GET";
      calls.push({
        url,
        method,
        body:
          typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      });
      const json = (status: number, body: unknown) =>
        new Response(JSON.stringify(body), { status });
      if (method === "GET" && url.includes("/users?")) return json(200, users);
      if (method === "GET") {
        const name = decodeURIComponent(
          url.split("/users/")[1]!.split("?")[0]!,
        );
        const found = users.find((u) => u.username === name);
        return found ? json(200, found) : json(404, { message: "no" });
      }
      return json(200, { message: "ok" });
    },
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const admin = (stepUpAt: number | null = Date.now()): Identity => ({
  kind: "user",
  userId: "u-admin",
  role: "admin",
  twoFactorEnabled: true,
  stepUpAt,
});
const user = (role: "viewer" | "member" | "operator"): Identity => ({
  kind: "user",
  userId: `u-${role}`,
  role,
  twoFactorEnabled: true,
  stepUpAt: Date.now(),
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

const writes = () => calls.filter((c) => c.method !== "GET");

describe("create", () => {
  it("creates the account, returns the new password once and audits one success", async () => {
    identity = admin();
    const state = await actions.createAccountAction(
      null,
      form({ userId: "user-2", username: "bilal", quotaMb: "512" }),
    );
    expect(state).toEqual({
      done: "created",
      username: "bilal",
      password: "generated-password-0123456789",
    });
    const post = writes()[0];
    expect(post?.method).toBe("POST");
    expect((post?.body as Record<string, unknown>).additional_info).toBe(
      "nexus-user:user-2",
    );
    expect((post?.body as Record<string, unknown>).quota_size).toBe(
      512 * 1024 * 1024,
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      actorId: "u-admin",
      role: "admin",
      action: "transfer.account.create",
      result: "success",
    });
    expect(events[0]?.target).toContain("sftpgo:bilal");
    // The password is not in the audit trail.
    expect(JSON.stringify(events)).not.toContain("generated-password");
  });

  it("does not grant a second account to the same person, or one to a person who does not exist", async () => {
    identity = admin();
    const second = await actions.createAccountAction(
      null,
      form({ userId: "user-1", username: "amira2", quotaMb: "100" }),
    );
    expect(second).toEqual({ error: expect.stringContaining("already has") });
    const ghost = await actions.createAccountAction(
      null,
      form({ userId: "nobody", username: "ghost", quotaMb: "100" }),
    );
    expect(ghost).toEqual({
      error: expect.stringContaining("no longer exists"),
    });
    expect(writes()).toHaveLength(0);
    expect(events.map((e) => e.result)).toEqual(["failure", "failure"]);
  });
});

describe("changes", () => {
  it("disable, enable, quota, password reset, key add and key remove each write one audit event", async () => {
    identity = admin();
    const key = sshKey();
    const run: [string, () => Promise<unknown>][] = [
      [
        "transfer.account.set-enabled",
        () =>
          actions.setEnabledAction(
            null,
            form({ username: "amira", enabled: "false" }),
          ),
      ],
      [
        "transfer.account.set-quota",
        () =>
          actions.setQuotaAction(
            null,
            form({ username: "amira", quotaMb: "300" }),
          ),
      ],
      [
        "transfer.account.reset-password",
        () => actions.resetPasswordAction(null, form({ username: "amira" })),
      ],
      [
        "transfer.key.add",
        () =>
          actions.addKeyAction(
            null,
            form({ username: "amira", publicKey: key }),
          ),
      ],
    ];
    for (const [action, go] of run) {
      events.length = 0;
      const state = await go();
      expect(state, action).not.toHaveProperty("error");
      expect(events, action).toHaveLength(1);
      expect(events[0], action).toMatchObject({ action, result: "success" });
      expect(events[0]?.target, action).toContain("sftpgo:amira");
    }
  });

  it("shows the reset password once and never audits it", async () => {
    identity = admin();
    const state = await actions.resetPasswordAction(
      null,
      form({ username: "amira" }),
    );
    expect(state).toMatchObject({
      done: "password",
      password: "generated-password-0123456789",
    });
    expect(JSON.stringify(events)).not.toContain("generated-password");
  });

  it("reports a bad key without touching SFTPGo", async () => {
    identity = admin();
    const state = await actions.addKeyAction(
      null,
      form({
        username: "amira",
        publicKey: "-----BEGIN OPENSSH PRIVATE KEY-----",
      }),
    );
    expect(state).toEqual({
      error: expect.stringContaining("OpenSSH public key"),
    });
    expect(writes()).toHaveLength(0);
  });

  it("reports an unknown account", async () => {
    identity = admin();
    const state = await actions.setQuotaAction(
      null,
      form({ username: "ghost", quotaMb: "100" }),
    );
    expect(state).toEqual({
      error: expect.stringContaining("no longer exists"),
    });
    expect(events[0]?.result).toBe("failure");
  });
});

describe("delete", () => {
  it("needs the name typed again", async () => {
    identity = admin();
    const wrong = await actions.deleteAccountAction(
      null,
      form({ username: "amira", confirm: "amir" }),
    );
    expect(wrong).toEqual({ error: expect.stringContaining("exactly") });
    expect(writes()).toHaveLength(0);

    const right = await actions.deleteAccountAction(
      null,
      form({ username: "amira", confirm: "amira" }),
    );
    expect(right).toEqual({ done: "deleted", username: "amira" });
    expect(writes()[0]).toMatchObject({ method: "DELETE" });
  });
});

describe("who may use them", () => {
  const all: [string, () => Promise<unknown>][] = [
    [
      "create",
      () =>
        actions.createAccountAction(
          null,
          form({ userId: "user-2", username: "bilal", quotaMb: "100" }),
        ),
    ],
    [
      "enable",
      () =>
        actions.setEnabledAction(
          null,
          form({ username: "amira", enabled: "true" }),
        ),
    ],
    [
      "quota",
      () =>
        actions.setQuotaAction(
          null,
          form({ username: "amira", quotaMb: "100" }),
        ),
    ],
    [
      "password",
      () => actions.resetPasswordAction(null, form({ username: "amira" })),
    ],
    [
      "delete",
      () =>
        actions.deleteAccountAction(
          null,
          form({ username: "amira", confirm: "amira" }),
        ),
    ],
    [
      "key add",
      () =>
        actions.addKeyAction(
          null,
          form({ username: "amira", publicKey: sshKey() }),
        ),
    ],
    [
      "key remove",
      () =>
        actions.removeKeyAction(
          null,
          form({ username: "amira", fingerprint: `SHA256:${"A".repeat(43)}` }),
        ),
    ],
  ];

  it("refuse a Visitor, a Viewer, a Member and an Operator before SFTPGo is called, each audited", async () => {
    for (const who of [
      { kind: "visitor" } as Identity,
      user("viewer"),
      user("member"),
      user("operator"),
    ]) {
      for (const [name, go] of all) {
        identity = who;
        events.length = 0;
        calls.length = 0;
        const state = await go();
        expect(state, name).toHaveProperty("error");
        expect(calls, name).toHaveLength(0);
        expect(events, name).toHaveLength(1);
        expect(events[0]?.result, name).toBe("refused");
      }
    }
  });

  it("allows an Administrator without needing additional Step_Up", async () => {
    const firstAction = all[0];
    expect(firstAction).toBeDefined();
    if (!firstAction) return;
    for (const stale of [null, Date.now() - 11 * 60_000]) {
      identity = admin(stale);
      calls.length = 0;
      const state = await firstAction[1]();
      expect(state).toHaveProperty("done", "created");
      expect(calls.length).toBeGreaterThan(0);
    }
  });
});

describe("hostile input", () => {
  it("never reaches SFTPGo", async () => {
    identity = admin();
    const hostile = [
      form({ username: "../etc", quotaMb: "100" }),
      form({ username: "a b", quotaMb: "100" }),
      form({ username: "amira", quotaMb: "-1" }),
      form({ username: "amira\u0000", quotaMb: "100" }),
      form({ username: "amira/../../x", quotaMb: "100" }),
      form({ quotaMb: "100" }),
    ];
    for (const data of hostile) {
      const state = await actions.setQuotaAction(null, data);
      expect(state).toEqual({
        error: expect.stringContaining("Check the highlighted"),
      });
    }
    expect(calls).toHaveLength(0);
  });

  it("keeps a name with SQL or shell text out of the request", async () => {
    identity = admin();
    const state = await actions.createAccountAction(
      null,
      form({
        userId: "user-2",
        username: "x'; drop table users;--",
        quotaMb: "100",
      }),
    );
    expect(state).toHaveProperty("error");
    expect(calls).toHaveLength(0);
  });
});

describe("failures", () => {
  it("say the service does not answer and audit a failure", async () => {
    identity = admin();
    sftpgoDown = true;
    const state = await actions.setQuotaAction(
      null,
      form({ username: "amira", quotaMb: "100" }),
    );
    expect(state).toEqual({
      error: expect.stringContaining("does not answer"),
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.result).toBe("failure");
    expect(JSON.stringify(state)).not.toContain("127.0.0.1");
    expect(JSON.stringify(state)).not.toContain("never-shown");
  });
});

describe("Demo_Mode", () => {
  it("changes nothing, says so, and writes no audit event", async () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    identity = admin();
    const state = await actions.setQuotaAction(
      null,
      form({ username: "amira", quotaMb: "100" }),
    );
    expect(state).toEqual({ error: expect.stringContaining("demo session") });
    expect(calls).toHaveLength(0);
    expect(events).toHaveLength(0);
  });
});
