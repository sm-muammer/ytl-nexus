"use client";

import Link from "next/link";
import type { PointerEvent, ReactNode } from "react";

type BentoCardProps = {
  href: string;
  apacheServed?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Glass module card for the home bento grid (spec 24). Updates CSS variables
 * --mx and --my on pointer move for a pure-CSS radial spotlight and reveals
 * a pink-to-blue gradient 1 px hairline border on hover/focus.
 */
export function BentoCard({
  href,
  apacheServed,
  className = "",
  children,
}: BentoCardProps) {
  const onPointerMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - rect.top}px`);
  };

  const baseClass = `nx-bento-card group flex min-h-11 h-full flex-col justify-between overflow-hidden rounded-2xl p-6 backdrop-blur-md ${className}`;

  if (apacheServed) {
    return (
      <a href={href} onPointerMove={onPointerMove} className={baseClass}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} onPointerMove={onPointerMove} className={baseClass}>
      {children}
    </Link>
  );
}
