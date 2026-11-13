// Action state type for Nexus Mail Control forms. Mirrors the pattern used
// by lib/transfer/form-state.ts.

export type MailActionState =
  | null
  | { error: string }
  | {
      done:
        "created" | "deleted" | "enabled" | "disabled" | "quota" | "password";
      address: string;
      /** New password, shown once only on a create or reset-password action. */
      password?: string;
    };
