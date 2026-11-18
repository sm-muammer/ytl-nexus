"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generatePassword, findUserEmail } from "@/lib/server/auth/service";
import { getAuthRuntime } from "@/lib/server/auth/runtime";
import { guardAction } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import {
  createSftpgoClient,
  readSftpgoConfig,
  SftpgoError,
} from "@/lib/server/sftpgo";
import {
  TRANSFER_MESSAGES as M,
  type TransferActionState,
} from "@/lib/transfer/form-state";
import {
  addKeyInput,
  createAccountInput,
  removeKeyInput,
  setEnabledInput,
  setQuotaInput,
  usernameInput,
  usernameSchema,
} from "@/lib/transfer/validation";

// Nexus Control, file transfer accounts (requirement 12.16): create, disable and
// delete accounts, set quotas, add and remove public keys, reset passwords. Each
// is an Administrator-only Server Function (policy rows `transfer.*`) that needs
// a fresh Step_Up, validates its input with Zod and writes one audit event with
// the account name as target. Nothing here returns a hash, a home directory or
// the SFTPGo key. A new password is shown once and stored nowhere by Nexus.

const MB = 1024 * 1024;

type Failure = { ok: false; error: keyof typeof ERROR_MESSAGE };
const ERROR_MESSAGE = {
  demo: M.demo,
  unavailable: M.unavailable,
  rejected: M.rejected,
  failed: M.failed,
  "no-account": M.notFound,
  conflict: M.nameTaken,
  invalid: M.invalidInput,
  "user-not-found": M.userNotFound,
  "user-has-account": M.userHasAccount,
  "key-invalid": M.keyInvalid,
  "key-duplicate": M.keyDuplicate,
  "key-limit": M.keyLimit,
  "key-missing": M.keyMissing,
  mismatch: M.confirmMismatch,
} as const;

const fail = (error: Failure["error"]): Failure => ({ ok: false, error });

/** Runs the SFTPGo calls of one action and turns client errors into a result. */
async function withClient<T extends { ok: true }>(
  run: (client: ReturnType<typeof createSftpgoClient>) => Promise<T | Failure>,
): Promise<T | Failure> {
  if (getMode() === "demo") return fail("demo");
  const config = readSftpgoConfig();
  if (!config) return fail("unavailable");
  try {
    return await run(createSftpgoClient(config));
  } catch (error) {
    if (error instanceof SftpgoError) {
      // "not-found" is the guard's word for a hidden area; this is a missing account.
      return fail(error.kind === "not-found" ? "no-account" : error.kind);
    }
    return fail("failed");
  }
}

// ---- create --------------------------------------------------------------------------

const create = guardAction(
  {
    id: "transfer.account.create",
    schema: createAccountInput,
    target: (i) => `sftpgo:${i.username} for user:${i.userId}`,
  },
  (input) =>
    withClient(async (client) => {
      const email = await findUserEmail(getAuthRuntime(), input.userId);
      if (!email) return fail("user-not-found");
      const accounts = await client.listAccounts();
      if (accounts.some((a) => a.nexusUserId === input.userId)) {
        return fail("user-has-account");
      }
      const password = generatePassword();
      await client.createAccount({
        username: input.username,
        password,
        nexusUserId: input.userId,
        quotaBytes: input.quotaMb * MB,
        email,
      });
      return { ok: true as const, username: input.username, password };
    }),
);

// ---- change --------------------------------------------------------------------------

const setEnabled = guardAction(
  {
    id: "transfer.account.set-enabled",
    schema: setEnabledInput,
    target: (i) => `sftpgo:${i.username} ${i.enabled ? "enable" : "disable"}`,
  },
  (input) =>
    withClient(async (client) => {
      await client.setEnabled(input.username, input.enabled);
      return {
        ok: true as const,
        username: input.username,
        enabled: input.enabled,
      };
    }),
);

const setQuota = guardAction(
  {
    id: "transfer.account.set-quota",
    schema: setQuotaInput,
    target: (i) => `sftpgo:${i.username} quota ${i.quotaMb} MB`,
  },
  (input) =>
    withClient(async (client) => {
      await client.setQuota(input.username, input.quotaMb * MB);
      return { ok: true as const, username: input.username };
    }),
);

const resetPassword = guardAction(
  {
    id: "transfer.account.reset-password",
    schema: usernameInput,
    target: (i) => `sftpgo:${i.username}`,
  },
  (input) =>
    withClient(async (client) => {
      const password = generatePassword();
      await client.setPassword(input.username, password);
      return { ok: true as const, username: input.username, password };
    }),
);

const deleteInput = z
  .object({ username: usernameSchema, confirm: z.string().max(64) })
  .superRefine((value, ctx) => {
    if (value.confirm !== value.username) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "mismatch" });
    }
  });

const remove = guardAction(
  {
    id: "transfer.account.delete",
    schema: deleteInput,
    target: (i) => `sftpgo:${i.username}`,
  },
  (input) =>
    withClient(async (client) => {
      await client.deleteAccount(input.username);
      return { ok: true as const, username: input.username };
    }),
);

const addKey = guardAction(
  {
    id: "transfer.key.add",
    schema: addKeyInput,
    target: (i) => `sftpgo:${i.username} key add`,
  },
  (input) =>
    withClient(async (client) => {
      const result = await client.addKey(input.username, input.publicKey);
      if (result === "invalid") return fail("key-invalid");
      if (result === "duplicate") return fail("key-duplicate");
      if (result === "limit") return fail("key-limit");
      return { ok: true as const, username: input.username };
    }),
);

const removeKey = guardAction(
  {
    id: "transfer.key.remove",
    schema: removeKeyInput,
    target: (i) =>
      `sftpgo:${i.username} key remove ${i.fingerprint.slice(0, 20)}`,
  },
  (input) =>
    withClient(async (client) => {
      const result = await client.removeKey(input.username, input.fingerprint);
      if (result === "not-found") return fail("key-missing");
      return { ok: true as const, username: input.username };
    }),
);

// ---- form adapters ------------------------------------------------------------------------

type Outcome =
  | { ok: true; username: string; password?: string }
  | { ok: false; error: string };

function field(data: FormData, name: string): string | undefined {
  const value = data.get(name);
  return typeof value === "string" ? value : undefined;
}

/** Messages for the refusals the guard itself returns. */
function guardMessage(error: string): string {
  switch (error) {
    case "step-up-required":
      return M.stepUp;
    case "forbidden":
    case "unauthenticated":
    case "not-found":
    case "enrolment-required":
      return M.forbidden;
    case "invalid-input":
      return M.invalidInput;
    default:
      return (ERROR_MESSAGE as Record<string, string>)[error] ?? M.failed;
  }
}

function toState(
  result: Outcome,
  done: Extract<TransferActionState, { done: string }>["done"],
): TransferActionState {
  if (!result.ok) return { error: guardMessage(result.error) };
  revalidatePath("/control");
  revalidatePath("/control/users");
  return {
    done,
    username: result.username,
    ...(result.password ? { password: result.password } : {}),
  };
}

export async function createAccountAction(
  _previous: TransferActionState,
  data: FormData,
): Promise<TransferActionState> {
  return toState(
    await create({
      userId: field(data, "userId"),
      username: field(data, "username"),
      quotaMb: field(data, "quotaMb"),
    }),
    "created",
  );
}

export async function setEnabledAction(
  _previous: TransferActionState,
  data: FormData,
): Promise<TransferActionState> {
  const enabled = field(data, "enabled") === "true";
  return toState(
    await setEnabled({ username: field(data, "username"), enabled }),
    enabled ? "enabled" : "disabled",
  );
}

export async function setQuotaAction(
  _previous: TransferActionState,
  data: FormData,
): Promise<TransferActionState> {
  return toState(
    await setQuota({
      username: field(data, "username"),
      quotaMb: field(data, "quotaMb"),
    }),
    "quota",
  );
}

export async function resetPasswordAction(
  _previous: TransferActionState,
  data: FormData,
): Promise<TransferActionState> {
  return toState(
    await resetPassword({ username: field(data, "username") }),
    "password",
  );
}

export async function deleteAccountAction(
  _previous: TransferActionState,
  data: FormData,
): Promise<TransferActionState> {
  const result = await remove({
    username: field(data, "username"),
    confirm: field(data, "confirm") ?? "",
  });
  if (!result.ok && result.error === "invalid-input" && "fields" in result) {
    if (result.fields?.includes("confirm")) return { error: M.confirmMismatch };
  }
  return toState(result, "deleted");
}

export async function addKeyAction(
  _previous: TransferActionState,
  data: FormData,
): Promise<TransferActionState> {
  const result = await addKey({
    username: field(data, "username"),
    publicKey: field(data, "publicKey"),
  });
  if (
    !result.ok &&
    "fields" in result &&
    result.fields?.includes("publicKey")
  ) {
    return { error: M.keyInvalid };
  }
  return toState(result, "key-added");
}

export async function removeKeyAction(
  _previous: TransferActionState,
  data: FormData,
): Promise<TransferActionState> {
  return toState(
    await removeKey({
      username: field(data, "username"),
      fingerprint: field(data, "fingerprint"),
    }),
    "key-removed",
  );
}
