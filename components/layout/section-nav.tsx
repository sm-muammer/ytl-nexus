import { NavLink } from "./nav-link";

/**
 * Contextual navigation for a module with child routes (Requirement 3.3).
 * Rendered by the module's layout, so it appears on every page of the module.
 */
export function SectionNav({
  label,
  items,
}: {
  label: string;
  items: readonly { label: string; href: string }[];
}) {
  return (
    <nav
      aria-label={label}
      className="border-line border-b px-(--spacing-gutter)"
    >
      <ul className="-mb-px flex flex-wrap gap-x-1">
        {items.map((item) => (
          <li key={item.href}>
            <NavLink
              href={item.href}
              className="text-muted hover:text-ink aria-[current=page]:border-accent-ink aria-[current=page]:text-ink inline-flex min-h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium transition-colors duration-(--duration-fast) md:min-h-10"
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
