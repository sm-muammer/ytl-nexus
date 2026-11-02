"use client";

import { useRef } from "react";
import { setDemoSession } from "@/lib/server/demo-session-actions";
import { ROLES, ROLE_LABEL, type Role } from "@/lib/roles";
import { NavLink } from "./nav-link";

export type SheetItem = {
  label: string;
  href: string;
  subtitle: string;
  apacheServed: boolean;
};

export type SheetGroup = { key: string; label: string; items: SheetItem[] };

type NavSheetProps = {
  groups: SheetGroup[];
  /** Present in Demo_Mode only: the role the presenter is viewing as, or null. */
  demoSession?: { role: Role | null };
};

/**
 * The complete module directory in a modal dialog. One component serves both
 * triggers: the "Menu" button below 768 px (the mobile navigation control,
 * Requirement 3.4) and the "All modules" button above it. The native <dialog>
 * traps focus, closes on Escape and marks the page behind it inert; focus goes
 * back to the button that opened it.
 */
export function NavSheet({ groups, demoSession }: NavSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    openerRef.current = event.currentTarget;
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-haspopup="dialog"
        aria-label="Open menu"
        className="border-border-strong hover:bg-surface-raised inline-flex size-11 items-center justify-center gap-2 rounded-md border text-sm font-medium transition-colors duration-(--duration-fast) md:hidden"
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
        className="border-border-strong hover:bg-surface-raised hidden min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-(--duration-fast) md:inline-flex"
      >
        All modules
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="size-4 fill-none stroke-current stroke-2"
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
              className="text-heading-3 font-serif font-medium"
            >
              All modules
            </h2>
            <button
              type="button"
              onClick={close}
              className="border-border-strong hover:bg-surface-raised inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium"
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

          <nav aria-label="All modules" className="grid gap-8 sm:grid-cols-2">
            {groups.map((group) => (
              <section
                key={group.key}
                aria-labelledby={`nav-group-${group.key}`}
              >
                <h3
                  id={`nav-group-${group.key}`}
                  className="text-muted mb-2 font-mono text-xs tracking-[0.2em] uppercase"
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

          {demoSession ? (
            <form
              action={setDemoSession}
              className="border-line mt-auto flex flex-col gap-3 border-t pt-6"
            >
              <fieldset className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0">
                <legend className="text-pink-ink mb-2 font-mono text-xs tracking-wide uppercase">
                  Demo session
                </legend>
                {ROLES.map((role) => (
                  <button
                    key={role}
                    type="submit"
                    name="role"
                    value={role}
                    aria-pressed={demoSession.role === role}
                    data-demo-role
                    className="border-border-strong hover:bg-surface-raised aria-pressed:border-pink-ink aria-pressed:text-pink-ink min-h-11 rounded-full border px-4 text-sm font-medium"
                  >
                    {ROLE_LABEL[role]}
                  </button>
                ))}
              </fieldset>
              <button
                type="submit"
                name="role"
                value="visitor"
                className="text-muted hover:text-ink min-h-11 self-start rounded-md px-1 text-sm underline underline-offset-4"
              >
                Visitor view
              </button>
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
