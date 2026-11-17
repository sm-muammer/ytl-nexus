"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

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
  action,
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
  action?: ReactNode;
}) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const effectiveType = isPassword
    ? showPassword
      ? "text"
      : "password"
    : type;
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={name} className="text-sm font-medium">
          {label}
        </label>
        {action}
      </div>
      <div className="relative flex items-center">
        <input
          id={name}
          name={name}
          type={effectiveType}
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
          className={`${inputClass} ${isPassword ? "pr-11" : ""}`}
        />
        {isPassword ? (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="text-muted hover:text-ink absolute right-2.5 flex size-8 items-center justify-center rounded-md transition-colors"
          >
            {showPassword ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                <line x1="2" x2="22" y1="2" y2="22" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
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
  disabled = false,
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "quiet";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  const isDisabled = pending || disabled;
  const base =
    "min-h-11 rounded-full px-6 text-sm font-semibold transition-opacity duration-(--duration-fast) disabled:opacity-60";
  const look =
    variant === "primary"
      ? "bg-accent-ink text-canvas hover:opacity-90"
      : "border-border-strong hover:bg-surface-raised border";
  return (
    <button
      type="submit"
      disabled={isDisabled}
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
