import type { CSSProperties, ReactNode } from "react";

// Entrance primitives: fade, rise and stagger. They are CSS keyframe
// animations (classes in app/globals.css), not Motion components, on purpose:
// the server-rendered page is visible without JavaScript, nothing waits for
// hydration, and the largest-contentful-paint text is never hidden at first
// paint. Motion for React is kept for state-driven motion (the signal ribbon,
// and later the Atlas and Command views).
//
// They run once, use opacity and a 12 px rise, and mark themselves with
// data-reveal so tests can wait for the entrance to finish. Under
// prefers-reduced-motion the rise is dropped and the fade stays. Do not use
// them on forms, tables, Nexus Control or the mail inbox (Requirement 3.14).

type Common = {
  children: ReactNode;
  className?: string;
  /** Seconds before the entrance starts. */
  delay?: number;
};

const join = (...parts: (string | undefined)[]) =>
  parts.filter(Boolean).join(" ");

const delayStyle = (delay: number): CSSProperties =>
  ({ "--nx-delay": `${delay}s` }) as CSSProperties;

export function Fade({ children, className, delay = 0 }: Common) {
  return (
    <div
      data-reveal
      className={join("nx-fade", className)}
      style={delayStyle(delay)}
    >
      {children}
    </div>
  );
}

export function Rise({ children, className, delay = 0 }: Common) {
  return (
    <div
      data-reveal
      className={join("nx-rise", className)}
      style={delayStyle(delay)}
    >
      {children}
    </div>
  );
}

type StaggerProps = {
  children: ReactNode;
  className?: string;
  as?: "div" | "ul";
  "aria-labelledby"?: string;
};

/** Container for StaggerItem children. It animates nothing itself. */
export function Stagger({
  children,
  className,
  as: Tag = "div",
  "aria-labelledby": labelledBy,
}: StaggerProps) {
  return (
    <Tag className={className} aria-labelledby={labelledBy}>
      {children}
    </Tag>
  );
}

/** Child that enters 50 ms after the one before it. Pass its position. */
export function StaggerItem({
  children,
  className,
  as: Tag = "div",
  index,
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "li";
  index: number;
}) {
  return (
    <Tag
      data-reveal
      className={join("nx-rise", className)}
      style={delayStyle(0.05 + Math.min(index, 20) * 0.05)}
    >
      {children}
    </Tag>
  );
}
