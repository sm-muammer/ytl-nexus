import { z } from "zod";

// Input rules for the Control actions of Nexus Mail. The local part of the
// address becomes a column in the virtual_users table; keeping it narrow
// prevents injection and makes the address safe in email headers.

export const LOCAL_PART_PATTERN = /^[a-z][a-z0-9._-]{1,62}[a-z0-9]$/;

const RESERVED_LOCAL_PARTS = new Set([
  "root",
  "admin",
  "administrator",
  "postmaster",
  "abuse",
  "noreply",
  "no-reply",
  "mailer-daemon",
  "hostmaster",
  "webmaster",
]);

export const localPartSchema = z
  .string()
  .min(3, "Must be at least 3 characters.")
  .max(64, "Must be at most 64 characters.")
  .regex(
    LOCAL_PART_PATTERN,
    "Use lowercase letters, digits, dots, hyphens and underscores. Must start and end with a letter or digit.",
  )
  .refine((s) => !RESERVED_LOCAL_PARTS.has(s), "That name is reserved.");

export const QUOTA_MB_MIN = 10;
/** Server data disk is limited; cap individual mailboxes at 2 GB. */
export const QUOTA_MB_MAX = 2048;

export const quotaMbSchema = z.coerce
  .number()
  .int()
  .min(QUOTA_MB_MIN, `Minimum quota is ${QUOTA_MB_MIN} MB.`)
  .max(QUOTA_MB_MAX, `Maximum quota is ${QUOTA_MB_MAX} MB.`);

/** A Nexus user id as Better Auth issues it. */
export const nexusUserIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Not a valid account id.")
  .optional();

export const createMailboxInput = z.object({
  localPart: localPartSchema,
  userId: nexusUserIdSchema,
  quotaMb: quotaMbSchema,
});

export const addressInput = z.object({ address: z.string().email() });

export const setMailboxEnabledInput = z.object({
  address: z.string().email(),
  enabled: z.boolean(),
});

export const setMailboxQuotaInput = z.object({
  address: z.string().email(),
  quotaMb: quotaMbSchema,
});

/** Messages shown to the user. Keep them short and free of system detail. */
export const MAIL_MESSAGES = {
  demo: "Demo session: mail account changes are disabled.",
  unavailable: "The mail service is not reachable. Try again later.",
  failed: "The action could not be completed. Try again.",
  invalid: "The input is invalid. Check the form and try again.",
  conflict: "A mailbox with that address already exists.",
  notFound: "The mailbox was not found.",
  inUse: "The mailbox has mail and cannot be deleted. Disable it instead.",
  created: "Mailbox created.",
  deleted: "Mailbox deleted.",
  disabled: "Mailbox disabled.",
  enabled: "Mailbox enabled.",
  quotaChanged: "Quota updated.",
  passwordReset: "Password reset.",
} as const;
