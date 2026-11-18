"use server";

import { revalidatePath } from "next/cache";
import { findUserEmail, generatePassword } from "@/lib/server/auth/service";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { createMailDb, readMailDbConfig } from "@/lib/server/mail-db";
import { hashMailPassword } from "@/lib/mail/sha512-crypt";
import {
  MAIL_DOMAIN,
  createMailboxInput,
  setMailboxEnabledInput,
  setMailboxQuotaInput,
  addressInput,
  deleteMailboxInput,
  MAIL_MESSAGES,
  type MailActionState,
} from "@/lib/mail";

// Nexus Mail Control actions (requirement MAIL-10): create, enable/disable,
// reset password, set quota and delete mailboxes. Each is an Administrator-only
// Server Function that needs a fresh Step_Up, validates its input with Zod,
// writes one audit event with the mailbox address as target, and never returns
// a password hash. A new password is shown once on create or reset and stored
// nowhere by Nexus in readable form — Dovecot verifies the SHA512-CRYPT hash.

const MB = 1024 * 1024;

type Failure = { ok: false; error: keyof typeof ERROR_MESSAGE };
const ERROR_MESSAGE = {
  demo: MAIL_MESSAGES.demo,
  unavailable: MAIL_MESSAGES.unavailable,
  rejected: MAIL_MESSAGES.failed,
  failed: MAIL_MESSAGES.failed,
  "no-account": MAIL_MESSAGES.notFound,
  conflict: MAIL_MESSAGES.conflict,
  invalid: MAIL_MESSAGES.invalid,
  "user-not-found": MAIL_MESSAGES.userNotFound,
  "user-has-mailbox": MAIL_MESSAGES.userHasMailbox,
  mismatch: MAIL_MESSAGES.confirmMismatch,
} as const;

const fail = (error: Failure["error"]): Failure => ({ ok: false, error });

/** Runs the mail DB calls of one action and turns errors into a result. */
async function withDb<T extends { ok: true }>(
  run: (db: ReturnType<typeof createMailDb>) => Promise<T | Failure>,
): Promise<T | Failure> {
  if (getMode() === "demo") return fail("demo");
  const config = readMailDbConfig();
  if (!config) return fail("unavailable");
  const db = createMailDb(config);
  try {
    return await run(db);
  } catch {
    return fail("failed");
  } finally {
    await db.destroy().catch(() => {});
  }
}

async function getDomainId(
  db: ReturnType<typeof createMailDb>,
): Promise<number | null> {
  const row = await db
    .selectFrom("virtual_domains")
    .select("id")
    .where("name", "=", MAIL_DOMAIN)
    .executeTakeFirst();
  return row?.id ?? null;
}

// ---- create ----------------------------------------------------------------------

const create = guardAction(
  {
    id: "mail.account.create",
    schema: createMailboxInput,
    target: (i) => `${i.localPart}@${MAIL_DOMAIN}`,
  },
  async (input) =>
    withDb(async (db) => {
      const domain = await getDomainId(db);
      if (!domain) return fail("failed");

      const existing = await db
        .selectFrom("virtual_users")
        .select("id")
        .where("domain_id", "=", domain)
        .where("local_part", "=", input.localPart)
        .executeTakeFirst();
      if (existing) return fail("conflict");

      if (input.userId) {
        const email = await findUserEmail(getAuthRuntime(), input.userId);
        if (!email) return fail("user-not-found");
        const userHas = await db
          .selectFrom("virtual_users")
          .select("id")
          .where("nexus_user_id", "=", input.userId)
          .executeTakeFirst();
        if (userHas) return fail("user-has-mailbox");
      }

      const password = generatePassword();
      await db
        .insertInto("virtual_users")
        .values({
          domain_id: domain,
          local_part: input.localPart,
          email: `${input.localPart}@${MAIL_DOMAIN}`,
          password: hashMailPassword(password),
          quota_bytes: input.quotaMb * MB,
          enabled: 1,
          nexus_user_id: input.userId ?? null,
        })
        .execute();

      return {
        ok: true as const,
        address: `${input.localPart}@${MAIL_DOMAIN}`,
        password,
      };
    }),
);

// ---- change ----------------------------------------------------------------------

const setEnabled = guardAction(
  {
    id: "mail.account.set-enabled",
    schema: setMailboxEnabledInput,
    target: (i) => `${i.address} ${i.enabled ? "enable" : "disable"}`,
  },
  async (input) =>
    withDb(async (db) => {
      const updated = await db
        .updateTable("virtual_users")
        .set({ enabled: input.enabled ? 1 : 0 })
        .where("email", "=", input.address)
        .executeTakeFirst();
      if (!updated || Number(updated.numUpdatedRows) === 0) {
        return fail("no-account");
      }
      return {
        ok: true as const,
        address: input.address,
        enabled: input.enabled,
      };
    }),
);

const setQuota = guardAction(
  {
    id: "mail.account.set-quota",
    schema: setMailboxQuotaInput,
    target: (i) => `${i.address} quota ${i.quotaMb} MB`,
  },
  async (input) =>
    withDb(async (db) => {
      const updated = await db
        .updateTable("virtual_users")
        .set({ quota_bytes: input.quotaMb * MB })
        .where("email", "=", input.address)
        .executeTakeFirst();
      if (!updated || Number(updated.numUpdatedRows) === 0) {
        return fail("no-account");
      }
      return { ok: true as const, address: input.address };
    }),
);

const resetPassword = guardAction(
  {
    id: "mail.account.reset-password",
    schema: addressInput,
    target: (i) => i.address,
  },
  async (input) =>
    withDb(async (db) => {
      const password = generatePassword();
      const updated = await db
        .updateTable("virtual_users")
        .set({ password: hashMailPassword(password) })
        .where("email", "=", input.address)
        .executeTakeFirst();
      if (!updated || Number(updated.numUpdatedRows) === 0) {
        return fail("no-account");
      }
      return { ok: true as const, address: input.address, password };
    }),
);

const remove = guardAction(
  {
    id: "mail.account.delete",
    schema: deleteMailboxInput,
    target: (i) => i.address,
  },
  async (input) =>
    withDb(async (db) => {
      const row = await db
        .selectFrom("virtual_users")
        .select("id")
        .where("email", "=", input.address)
        .executeTakeFirst();
      if (!row) return fail("no-account");

      await db.deleteFrom("virtual_users").where("id", "=", row.id).execute();
      return { ok: true as const, address: input.address };
    }),
);

// ---- form adapters -----------------------------------------------------------------

type Outcome =
  | { ok: true; address: string; password?: string; enabled?: boolean }
  | { ok: false; error: string; fields?: string[] };

function field(data: FormData, name: string): string | undefined {
  const value = data.get(name);
  return typeof value === "string" ? value : undefined;
}

function guardMessage(error: string): string {
  switch (error) {
    case "step-up-required":
      return MAIL_MESSAGES.stepUp;
    case "forbidden":
    case "unauthenticated":
    case "not-found":
    case "enrolment-required":
      return MAIL_MESSAGES.failed;
    case "invalid-input":
      return MAIL_MESSAGES.invalid;
    default:
      return (
        (ERROR_MESSAGE as Record<string, string>)[error] ?? MAIL_MESSAGES.failed
      );
  }
}

function toState(
  result: Outcome,
  done: Extract<MailActionState, { done: string }>["done"],
): MailActionState {
  if (!result.ok) return { error: guardMessage(result.error) };
  revalidatePath("/control");
  revalidatePath("/control/users");
  revalidatePath("/mail");
  return {
    done,
    address: result.address,
    ...(result.password ? { password: result.password } : {}),
  };
}

export async function createMailboxAction(
  _previous: MailActionState,
  data: FormData,
): Promise<MailActionState> {
  return toState(
    await create({
      localPart: field(data, "localPart") ?? "",
      userId: field(data, "userId"),
      quotaMb: Number(field(data, "quotaMb")),
    }),
    "created",
  );
}

export async function setMailboxEnabledAction(
  _previous: MailActionState,
  data: FormData,
): Promise<MailActionState> {
  const enabled = field(data, "enabled") === "true";
  return toState(
    await setEnabled({
      address: field(data, "address") ?? "",
      enabled,
    }),
    enabled ? "enabled" : "disabled",
  );
}

export async function setMailboxQuotaAction(
  _previous: MailActionState,
  data: FormData,
): Promise<MailActionState> {
  return toState(
    await setQuota({
      address: field(data, "address") ?? "",
      quotaMb: Number(field(data, "quotaMb")),
    }),
    "quota",
  );
}

export async function resetMailboxPasswordAction(
  _previous: MailActionState,
  data: FormData,
): Promise<MailActionState> {
  return toState(
    await resetPassword({ address: field(data, "address") ?? "" }),
    "password",
  );
}

export async function deleteMailboxAction(
  _previous: MailActionState,
  data: FormData,
): Promise<MailActionState> {
  const result = await remove({
    address: field(data, "address") ?? "",
    confirm: field(data, "confirm") ?? "",
  });
  if (!result.ok && result.error === "invalid-input" && "fields" in result) {
    if (result.fields?.includes("confirm")) {
      return { error: MAIL_MESSAGES.confirmMismatch };
    }
  }
  return toState(result, "deleted");
}
