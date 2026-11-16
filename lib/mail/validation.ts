import { z } from "zod";
import { MAIL_DOMAIN } from "./types";

// Input rules for the Control actions of Nexus Mail. The local part becomes a
// column and, in Dovecot, a folder name; keeping it narrow prevents injection
// and keeps the address safe in mail headers. Addresses are always in the one
// virtual domain: an action cannot name an address anywhere else.

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
  "nobody",
  "daemon",
  "security",
]);

export const localPartSchema = z
  .string()
  .min(3, "Must be at least 3 characters.")
  .max(64, "Must be at most 64 characters.")
  .regex(
    LOCAL_PART_PATTERN,
    "Use lowercase letters, digits, dots, hyphens and underscores. Must start with a letter and end with a letter or digit.",
  )
  .refine((s) => !s.includes(".."), "No two dots in a row.")
  .refine((s) => !RESERVED_LOCAL_PARTS.has(s), "That name is reserved.");

export const QUOTA_MB_MIN = 10;
/** The data disk is shared with the system; one mailbox may use at most 2 GB. */
export const QUOTA_MB_MAX = 2048;
export const QUOTA_MB_DEFAULT = 512;

export const quotaMbSchema = z.coerce
  .number()
  .int()
  .min(QUOTA_MB_MIN, `Minimum quota is ${QUOTA_MB_MIN} MB.`)
  .max(QUOTA_MB_MAX, `Maximum quota is ${QUOTA_MB_MAX} MB.`);

/** A Nexus user id as Better Auth issues it. Blank means "no linked user". */
export const nexusUserIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/, "Not a valid account id.")
  .optional()
  .or(z.literal("").transform(() => undefined));

/** `local@ytl-nexus.internal`, nothing else. */
export const mailAddressSchema = z
  .string()
  .max(255)
  .refine((value) => {
    const at = value.lastIndexOf("@");
    if (at < 1) return false;
    const local = value.slice(0, at);
    const domain = value.slice(at + 1);
    if (domain !== MAIL_DOMAIN) return false;
    return localPartSchema.safeParse(local).success;
  }, `Use an address ending in @${MAIL_DOMAIN}.`);

export function localPartOf(address: string): string {
  return address.slice(0, address.lastIndexOf("@"));
}

export const createMailboxInput = z.object({
  localPart: localPartSchema,
  userId: nexusUserIdSchema,
  quotaMb: quotaMbSchema,
});

export const addressInput = z.object({ address: mailAddressSchema });

export const setMailboxEnabledInput = z.object({
  address: mailAddressSchema,
  enabled: z.boolean(),
});

export const setMailboxQuotaInput = z.object({
  address: mailAddressSchema,
  quotaMb: quotaMbSchema,
});

export const deleteMailboxInput = z
  .object({ address: mailAddressSchema, confirm: z.string().max(255) })
  .superRefine((value, ctx) => {
    if (value.confirm !== value.address) {
      ctx.addIssue({ code: "custom", path: ["confirm"], message: "mismatch" });
    }
  });

/** Messages shown to the user. Short, and free of system detail. */
export const MAIL_MESSAGES = {
  demo: "Demo session: mail account changes are disabled.",
  unavailable: "The mail service is not reachable. Try again later.",
  failed: "The action could not be completed. Try again.",
  invalid: "The input is invalid. Check the form and try again.",
  conflict: "A mailbox with that address already exists.",
  notFound: "The mailbox was not found.",
  userNotFound: "That Nexus user does not exist.",
  userHasMailbox: "That Nexus user already has a mailbox.",
  confirmMismatch: "Type the mailbox address exactly to delete it.",
  stepUp:
    "Confirm your password and authenticator code to perform administrative actions.",
} as const;
