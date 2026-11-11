// What the Control forms for Nexus Transfer exchange with their Server
// Functions. Types and messages only, so client components can import them.
// Messages are for the person at the keyboard: no addresses, no SFTPGo wording.

export type TransferActionState =
  | null
  | { error: string }
  | {
      done:
        | "created"
        | "password"
        | "enabled"
        | "disabled"
        | "quota"
        | "deleted"
        | "key-added"
        | "key-removed";
      username: string;
      /** Shown once, only for a new account or a password reset. */
      password?: string;
    };

export const TRANSFER_MESSAGES = {
  demo: "This is a demo session. Nothing was changed.",
  unavailable:
    "The file transfer service does not answer. Nothing was changed.",
  rejected:
    "The file transfer service refused the change. Nothing was changed.",
  failed: "Something went wrong. Check the list before trying again.",
  invalidInput: "Check the highlighted fields and try again.",
  stepUp: "Confirm your password and code again to continue.",
  forbidden: "You do not have access to do that.",
  notFound: "That account no longer exists. Reload the list.",
  nameTaken: "That name is already used. Pick another.",
  userNotFound: "That Nexus account no longer exists.",
  userHasAccount: "That person already has a file transfer account.",
  keyInvalid:
    "That is not a valid OpenSSH public key. Paste the whole .pub line.",
  keyDuplicate: "That key is already registered.",
  keyLimit: "This account already has 10 keys. Remove one first.",
  keyMissing: "That key is no longer registered.",
  confirmMismatch: "Type the account name exactly to confirm the delete.",
} as const;
