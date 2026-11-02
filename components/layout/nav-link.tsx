"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

type NavLinkProps = {
  href: string;
  children: ReactNode;
  className?: string;
  /** Plain anchor with a full page load, for pages Apache serves. */
  apacheServed?: boolean;
  onNavigate?: () => void;
};

const normalise = (p: string) => (p.length > 1 ? p.replace(/\/$/, "") : p);

/**
 * Link that marks the current page with aria-current="page". Style the active
 * state with the `aria-[current=page]:` variant.
 */
export function NavLink({
  href,
  children,
  className,
  apacheServed,
  onNavigate,
}: NavLinkProps) {
  const pathname = usePathname();
  const current = normalise(pathname) === normalise(href);
  const common = {
    className,
    "aria-current": current ? ("page" as const) : undefined,
    onClick: onNavigate,
  };

  if (apacheServed) {
    return (
      <a href={href} {...common}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} {...common}>
      {children}
    </Link>
  );
}
