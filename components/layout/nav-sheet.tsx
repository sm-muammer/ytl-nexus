"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { signOutAction } from "@/lib/server/auth/actions";
import { setDemoSession } from "@/lib/server/demo-session-actions";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import type { NexusMode } from "@/lib/server/mode";
import { NavLink } from "./nav-link";

export type SheetItem = {
  label: string;
  href: string;
  subtitle: string;
  apacheServed: boolean;
};

export type SheetGroup = { key: string; label: string; items: SheetItem[] };

function Avatar({ session }: { session: SessionSummary }) {
  return (
    <span
      aria-hidden="true"
      className={`font-display grid size-9 shrink-0 place-items-center rounded-full text-base font-semibold ${
        session.demo
          ? "bg-pink-ink/15 text-pink-ink ring-pink-ink/40 ring-1"
          : "bg-accent-ink/15 text-accent-ink ring-accent-ink/40 ring-1"
      }`}
    >
      {session.initial ?? (
        <svg
          viewBox="0 0 20 20"
          className="size-5 fill-none stroke-current stroke-[1.6]"
          strokeLinecap="round"
        >
          <circle cx="10" cy="7" r="3.2" />
          <path d="M3.5 17c.8-3.2 3.3-4.8 6.5-4.8s5.7 1.6 6.5 4.8" />
        </svg>
      )}
    </span>
  );
}

/**
 * Submit button for the demo session form. While the Server Function runs, all
 * of them are disabled and the form is marked busy, so a second click cannot
 * race the first and the presenter sees that something is happening.
 */
function SessionButton({
  value,
  pressed,
  className,
  children,
}: {
  value: string;
  pressed?: boolean;
  className: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="role"
      value={value}
      disabled={pending}
      aria-pressed={pressed}
      data-demo-role={pressed === undefined ? undefined : ""}
      className={`${className} disabled:opacity-60`}
    >
      {children}
    </button>
  );
}

/** Who is viewing, shown on the header chip and in the menu. */
export type SessionSummary = {
  /** Small line above the name: "Demo session" or "Signed in". */
  kicker: string | null;
  name: string;
  /** Letter on the avatar, or null for a person icon. */
  initial: string | null;
  demo: boolean;
};

type NavSheetProps = {
  mode: NexusMode;
  /** Null hides the chip (a Visitor in Live_Mode has the Sign in link). */
  session: SessionSummary | null;
  groups: SheetGroup[];
  /** Present in Demo_Mode only: the role the presenter is viewing as, or null. */
  demoSession?: { role: Role | null };
  /** True in Live_Mode for a signed-in person: shows the Sign out button. */
  canSignOut?: boolean;
};

/**
 * The complete module directory in a modal dialog. One component serves both
 * triggers: the "Menu" button below 768 px (the mobile navigation control,
 * Requirement 3.4) and the "All modules" button above it. The native <dialog>
 * traps focus, closes on Escape and marks the page behind it inert; focus goes
 * back to the button that opened it.
 */
export function NavSheet({
  mode: _mode,
  session,
  groups,
  demoSession,
  canSignOut,
}: NavSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      {session ? (
        <button
          type="button"
          onClick={open}
          aria-haspopup="dialog"
          data-session-label
          className="border-line bg-surface/60 hover:bg-surface-raised/80 hidden min-h-11 items-center gap-3 rounded-full border py-1 pr-5 pl-1 text-left backdrop-blur-sm transition-colors duration-(--duration-fast) md:flex"
        >
          <Avatar session={session} />
          <span className="leading-tight">
            {session.kicker ? (
              <span className="text-muted block text-xs whitespace-nowrap">
                {session.kicker}
              </span>
            ) : null}
            <span className="block text-sm font-medium whitespace-nowrap">
              {session.name}
            </span>
          </span>
        </button>
      ) : null}
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label="Open menu"
        className="border-border-strong hover:bg-surface-raised inline-flex size-11 items-center justify-center gap-2 rounded-full border text-sm font-medium transition-colors duration-(--duration-fast) md:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-5 fill-none stroke-current stroke-2"
          strokeLinecap="round"
        >
          <path d="M3 6h14M3 10h14M3 14h14" />
        </svg>
      </button>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        className="group relative hidden min-h-9 items-center gap-2 rounded-full border border-slate-700/70 bg-slate-900/40 px-3.5 py-1.5 text-xs font-medium whitespace-nowrap text-slate-200 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-slate-500 hover:bg-slate-800/60 hover:text-white md:inline-flex"
      >
        <span>All modules</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-3.5 fill-none stroke-current stroke-2 text-slate-400 transition-transform duration-200 group-hover:translate-y-0.5 group-hover:text-slate-200"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      <dialog
        ref={dialogRef}
        data-nav-sheet
        aria-labelledby="nav-sheet-title"
        onClose={() => openerRef.current?.focus()}
        onClick={(event) => {
          // A click on the backdrop lands on the dialog element itself.
          if (event.target === event.currentTarget) close();
        }}
        className="bg-canvas text-ink border-line fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-none overflow-y-auto border-l p-0 backdrop:bg-black/70 md:max-w-3xl"
      >
        <div className="flex min-h-full flex-col gap-8 px-(--spacing-gutter) py-5">
          <div className="flex items-center justify-between gap-4">
            <h2
              id="nav-sheet-title"
              className="text-heading-3 font-display font-semibold"
            >
              All modules
            </h2>
            <button
              type="button"
              onClick={close}
              className="border-border-strong hover:bg-surface-raised inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-full border px-3 text-sm font-medium"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                className="size-4 fill-none stroke-current stroke-2"
                strokeLinecap="round"
              >
                <path d="m3 3 10 10M13 3 3 13" />
              </svg>
              <span className="sr-only">Close menu</span>
            </button>
          </div>

          {session ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-muted text-sm">
                {session.kicker ? `${session.kicker}: ` : ""}
                {session.name}
              </span>
            </div>
          ) : null}

          <nav aria-label="All modules" className="grid gap-8 sm:grid-cols-2">
            {groups.map((group) => (
              <section
                key={group.key}
                aria-labelledby={`nav-group-${group.key}`}
              >
                <h3
                  id={`nav-group-${group.key}`}
                  className="text-muted mb-2 text-sm font-semibold"
                >
                  {group.label}
                </h3>
                <ul className="flex flex-col">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        apacheServed={item.apacheServed}
                        onNavigate={close}
                        className="hover:bg-surface-raised aria-[current=page]:bg-surface-raised block min-h-11 rounded-md px-3 py-2 transition-colors duration-(--duration-fast)"
                      >
                        <span className="block font-medium">{item.label}</span>
                        <span className="text-muted text-data block">
                          {item.subtitle}
                        </span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>

          {canSignOut ? (
            <form
              action={signOutAction}
              className="border-line mt-auto flex flex-col gap-3 border-t pt-6"
            >
              <SessionButton
                value="sign-out"
                className="border-border-strong hover:bg-surface-raised min-h-11 self-start rounded-full border px-5 text-sm font-medium"
              >
                Sign out
              </SessionButton>
            </form>
          ) : null}
          {demoSession ? (
            <form
              action={setDemoSession}
              className="border-line mt-auto flex flex-col gap-3 border-t pt-6"
            >
              <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
                <legend className="text-pink-ink mb-2 text-sm font-semibold">
                  Demo session
                </legend>
                {ROLES.map((role) => (
                  <SessionButton
                    key={role}
                    value={role}
                    pressed={demoSession.role === role}
                    className="border-border-strong hover:bg-surface-raised aria-pressed:border-pink-ink aria-pressed:text-pink-ink min-h-11 rounded-full border px-4 text-sm font-medium"
                  >
                    {ROLE_LABEL[role]}
                  </SessionButton>
                ))}
              </fieldset>
              <SessionButton
                value="visitor"
                className="text-muted hover:text-ink min-h-11 self-start rounded-full px-3 text-sm underline underline-offset-4"
              >
                Visitor view
              </SessionButton>
              <p className="text-muted text-data max-w-prose">
                Presenters use this to view the site as each role. It only
                changes the menu and labels in demo mode. Real access is checked
                on the server.
              </p>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
