// Action state for the Nexus Mail Control forms. Mirrors lib/transfer/form-state.ts.

export type MailActionState =
  | null
  | { error: string }
  | {
      done:
        "created" | "deleted" | "enabled" | "disabled" | "quota" | "password";
      address: string;
      /** New password, shown once only after a create or a reset. */
      password?: string;
    };
