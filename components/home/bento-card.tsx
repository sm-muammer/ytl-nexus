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
 * Swiss editorial hairline cell for the home modules matrix (spec 24).
 * Updates CSS variables --mx and --my on pointer move for a subtle radial
 * spotlight without floating card chrome.
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

  const baseClass = `nx-bento-card group relative flex min-h-11 h-full flex-col justify-between p-6 lg:p-8 ${className}`;

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
