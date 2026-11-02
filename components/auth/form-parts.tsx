"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export const inputClass =
  "border-border-strong bg-surface text-ink placeholder:text-muted min-h-11 w-full rounded-md border px-3 py-2 text-base";

export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  inputMode,
  pattern,
  maxLength,
  hint,
  defaultValue,
  autoFocus,
}: {
  label: string;
  name: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  inputMode?: "numeric" | "text" | "email";
  pattern?: string;
  maxLength?: number;
  hint?: string;
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        pattern={pattern}
        maxLength={maxLength}
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        spellCheck={false}
        autoCapitalize="none"
        aria-describedby={hintId}
        className={inputClass}
      />
      {hint ? (
        <p id={hintId} className="text-muted text-data">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Working",
  variant = "primary",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "quiet";
}) {
  const { pending } = useFormStatus();
  const base =
    "min-h-11 rounded-full px-6 text-sm font-semibold transition-opacity duration-(--duration-fast) disabled:opacity-60";
  const look =
    variant === "primary"
      ? "bg-accent-ink text-canvas hover:opacity-90"
      : "border-border-strong hover:bg-surface-raised border";
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`${base} ${look}`}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

/** Announced to screen readers when it appears. Empty when there is no message. */
export function FormError({ message }: { message: string | undefined }) {
  return (
    <p
      role="alert"
      className={message ? "text-bad-ink text-sm font-medium" : "sr-only"}
    >
      {message ?? ""}
    </p>
  );
}
