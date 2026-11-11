import { z } from "zod";
import { parsePublicKey } from "./keys.ts";

// Input rules for the Control actions of Nexus Transfer. The user name becomes
// a folder name under /srv/nexus-transfer, so it is deliberately narrow: no
// slash, dot or space can occur, which rules out path tricks by construction.

export const USERNAME_PATTERN = /^[a-z][a-z0-9_-]{2,31}$/;

const RESERVED = new Set([
  "root",
  "admin",
  "administrator",
  "sftpgo",
  "nexus",
  "nexus-admin",
  "nexus-api",
  "anonymous",
  "ftp",
  "guest",
  "nobody",
  "system",
]);

export const usernameSchema = z
  .string()
  .regex(
    USERNAME_PATTERN,
    "Use 3 to 32 characters: lowercase letters, digits, - and _, starting with a letter.",
  )
  .refine((name) => !RESERVED.has(name), "That name is reserved.");

export const QUOTA_MB_MIN = 10;
/** The transfer volume is 20 GB, so a larger quota could never be used. */
export const QUOTA_MB_MAX = 20480;

export const quotaMbSchema = z.coerce
  .number()
  .int()
  .min(QUOTA_MB_MIN)
  .max(QUOTA_MB_MAX);

/** A Nexus user id as Better Auth issues it. */
export const nexusUserIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Not a valid account id.");

const keyText = z
  .string()
  .max(8192)
  .refine((text) => parsePublicKey(text) !== null, {
    message: "Not a valid OpenSSH public key.",
  });

export const createAccountInput = z.object({
  userId: nexusUserIdSchema,
  username: usernameSchema,
  quotaMb: quotaMbSchema,
});

export const usernameInput = z.object({ username: usernameSchema });

export const setEnabledInput = z.object({
  username: usernameSchema,
  enabled: z.boolean(),
});

export const setQuotaInput = z.object({
  username: usernameSchema,
  quotaMb: quotaMbSchema,
});

export const addKeyInput = z.object({
  username: usernameSchema,
  publicKey: keyText,
});

export const removeKeyInput = z.object({
  username: usernameSchema,
  fingerprint: z.string().regex(/^SHA256:[A-Za-z0-9+/]{43}$/),
});
