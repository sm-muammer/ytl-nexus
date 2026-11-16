// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditEventInput } from "@/lib/server/db/audit";
import type { Identity } from "@/lib/server/policy";

// Requirements MAIL-10: every Control action on a virtual mailbox is
// Administrator-only with a fresh Step_Up, validated with Zod, and writes
// exactly one audit event with the mailbox address as target.
// Passwords are generated once, returned once, and never audited.

const events: AuditEventInput[] = [];
let identity: Identity;

vi.mock("@/lib/server/auth/runtime", () => ({
  getAuthRuntime: () => ({ audit: async () => {} }),
}));

vi.mock("@/lib/server/auth/service", () => ({
  generatePassword: () => "mock-password-12345",
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

type VirtualUser = {
  id: number;
  domain_id: number;
  local_part: string;
  email: string;
  password: string;
  quota_bytes: number;
  enabled: number;
  nexus_user_id: string | null;
};

let users: VirtualUser[] = [];
let nextUserId = 1;

vi.mock("@/lib/server/mail-db", () => ({
  readMailDbConfig: () => ({
    host: "127.0.0.1",
    port: 3306,
    database: "nexus_mail",
    user: "nexus_mail_app",
    password: "secret",
  }),
  createMailDb: () => ({
    selectFrom: (table: string) => ({
      select: () => ({
        where: (col1: string, _op: string, val1: unknown) => ({
          where: (col2: string, _op2: string, val2: unknown) => ({
            executeTakeFirst: async () => {
              const found = users.find(
                (u) =>
                  (u as Record<string, unknown>)[col1] === val1 &&
                  (u as Record<string, unknown>)[col2] === val2,
              );
              return found ? { id: found.id } : undefined;
            },
          }),
          executeTakeFirst: async () => {
            if (table === "virtual_domains") return { id: 1 };
            const found = users.find(
              (u) => (u as Record<string, unknown>)[col1] === val1,
            );
            return found ? { id: found.id } : undefined;
          },
        }),
      }),
    }),
    insertInto: () => ({
      values: (val: Record<string, unknown>) => ({
        execute: async () => {
          users.push({
            id: nextUserId++,
            domain_id: val.domain_id as number,
            local_part: val.local_part as string,
            email: val.email as string,
            password: val.password as string,
            quota_bytes: val.quota_bytes as number,
            enabled: val.enabled as number,
            nexus_user_id: (val.nexus_user_id as string) ?? null,
          });
        },
      }),
    }),
    updateTable: () => ({
      set: (updateVal: Record<string, unknown>) => ({
        where: (_col: string, _op: string, emailVal: string) => ({
          executeTakeFirst: async () => {
            const user = users.find((u) => u.email === emailVal);
            if (!user) return { numUpdatedRows: 0n };
            Object.assign(user, updateVal);
            return { numUpdatedRows: 1n };
          },
        }),
      }),
    }),
    deleteFrom: () => ({
      where: (_col: string, _op: string, idVal: number) => ({
        execute: async () => {
          users = users.filter((u) => u.id !== idVal);
        },
      }),
    }),
    destroy: async () => {},
  }),
}));

const actions = await import("@/lib/server/mail-actions");

beforeEach(() => {
  events.length = 0;
  nextUserId = 1;
  users = [
    {
      id: nextUserId++,
      domain_id: 1,
      local_part: "amira",
      email: "amira@ytl-nexus.internal",
      password: "{SHA512-CRYPT}$6$mock$hash",
      quota_bytes: 512 * 1024 * 1024,
      enabled: 1,
      nexus_user_id: "user-1",
    },
  ];
  vi.stubEnv("NEXUS_MODE", "live");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

const admin = (stepUpAt: number | null = Date.now()): Identity => ({
  kind: "user",
  userId: "u-admin",
  role: "admin",
  twoFactorEnabled: true,
  stepUpAt,
});

const operator = (): Identity => ({
  kind: "user",
  userId: "u-operator",
  role: "operator",
  twoFactorEnabled: true,
  stepUpAt: Date.now(),
});

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

describe("Nexus Mail actions - Authorization & Guards", () => {
  it("refuses actions when the user is not an administrator", async () => {
    identity = operator();
    const result = await actions.createMailboxAction(
      null,
      form({ localPart: "newuser", quotaMb: "512" }),
    );
    expect(result).toEqual({
      error: expect.stringContaining("could not be completed"),
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "mail.account.create",
      result: "refused",
      actorId: "u-operator",
    });
  });

  it("refuses actions when Step_Up is missing or stale", async () => {
    identity = admin(null); // No Step_Up
    const result = await actions.createMailboxAction(
      null,
      form({ localPart: "newuser", quotaMb: "512" }),
    );
    expect(result).toEqual({
      error: expect.stringContaining(
        "Confirm your password and authenticator code",
      ),
    });
    expect(events[0]).toMatchObject({
      action: "mail.account.create",
      result: "refused",
    });
  });

  it("refuses actions in demo mode", async () => {
    vi.stubEnv("NEXUS_MODE", "demo");
    identity = admin();
    const result = await actions.createMailboxAction(
      null,
      form({ localPart: "newuser", quotaMb: "512" }),
    );
    expect(result).toEqual({ error: expect.stringContaining("Demo session") });
    // Demo mode does not write to the audit trail
    expect(events).toHaveLength(0);
  });
});

describe("createMailboxAction", () => {
  it("creates a mailbox, returns the password once, and writes an audit event", async () => {
    identity = admin();
    const result = await actions.createMailboxAction(
      null,
      form({ localPart: "bilal", quotaMb: "256", userId: "user-2" }),
    );
    expect(result).toEqual({
      done: "created",
      address: "bilal@ytl-nexus.internal",
      password: "mock-password-12345",
    });

    const created = users.find((u) => u.local_part === "bilal");
    expect(created).toBeDefined();
    expect(created?.password).toMatch(/^\{SHA512-CRYPT\}\$6\$/);
    expect(created?.quota_bytes).toBe(256 * 1024 * 1024);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "mail.account.create",
      actorId: "u-admin",
      result: "success",
      target: "bilal@ytl-nexus.internal",
    });
    // Password never appears in audit events
    expect(JSON.stringify(events)).not.toContain("mock-password");
  });

  it("refuses duplicate local parts", async () => {
    identity = admin();
    const result = await actions.createMailboxAction(
      null,
      form({ localPart: "amira", quotaMb: "256" }),
    );
    expect(result).toEqual({
      error: expect.stringContaining("already exists"),
    });
  });

  it("refuses assigning a mailbox to a person who already has one", async () => {
    identity = admin();
    const result = await actions.createMailboxAction(
      null,
      form({ localPart: "amira2", quotaMb: "256", userId: "user-1" }),
    );
    expect(result).toEqual({
      error: expect.stringContaining("already has a mailbox"),
    });
  });
});

describe("mailbox modification actions", () => {
  it("enables and disables a mailbox and audits the change", async () => {
    identity = admin();
    const resDisable = await actions.setMailboxEnabledAction(
      null,
      form({ address: "amira@ytl-nexus.internal", enabled: "false" }),
    );
    expect(resDisable).toEqual({
      done: "disabled",
      address: "amira@ytl-nexus.internal",
    });
    expect(users.find((u) => u.local_part === "amira")?.enabled).toBe(0);

    const resEnable = await actions.setMailboxEnabledAction(
      null,
      form({ address: "amira@ytl-nexus.internal", enabled: "true" }),
    );
    expect(resEnable).toEqual({
      done: "enabled",
      address: "amira@ytl-nexus.internal",
    });
    expect(users.find((u) => u.local_part === "amira")?.enabled).toBe(1);

    expect(events.map((e) => e.action)).toEqual([
      "mail.account.set-enabled",
      "mail.account.set-enabled",
    ]);
  });

  it("updates quota and audits the event", async () => {
    identity = admin();
    const result = await actions.setMailboxQuotaAction(
      null,
      form({ address: "amira@ytl-nexus.internal", quotaMb: "1024" }),
    );
    expect(result).toEqual({
      done: "quota",
      address: "amira@ytl-nexus.internal",
    });
    expect(users.find((u) => u.local_part === "amira")?.quota_bytes).toBe(
      1024 * 1024 * 1024,
    );
    expect(events[0]).toMatchObject({
      action: "mail.account.set-quota",
      result: "success",
    });
  });

  it("resets password, returns it once and audits the action", async () => {
    identity = admin();
    const result = await actions.resetMailboxPasswordAction(
      null,
      form({ address: "amira@ytl-nexus.internal" }),
    );
    expect(result).toEqual({
      done: "password",
      address: "amira@ytl-nexus.internal",
      password: "mock-password-12345",
    });
    expect(events[0]).toMatchObject({
      action: "mail.account.reset-password",
      result: "success",
    });
    expect(JSON.stringify(events)).not.toContain("mock-password");
  });

  it("deletes a mailbox when confirm matches", async () => {
    identity = admin();
    const result = await actions.deleteMailboxAction(
      null,
      form({
        address: "amira@ytl-nexus.internal",
        confirm: "amira@ytl-nexus.internal",
      }),
    );
    expect(result).toEqual({
      done: "deleted",
      address: "amira@ytl-nexus.internal",
    });
    expect(users.find((u) => u.local_part === "amira")).toBeUndefined();
    expect(events[0]).toMatchObject({
      action: "mail.account.delete",
      result: "success",
    });
  });
});
