import type { Actor } from "@/lib/roles";
import {
  NAV_GROUPS,
  NAV_GROUP_LABEL,
  NAV_ITEMS,
  visibleNav,
} from "@/lib/navigation/modules";
import { NavLink } from "./nav-link";

/**
 * Dense module list for the workspace register, from 1024 px up. Below that
 * the header's menu carries the same links. Shows only what the actor's role
 * allows; the pages enforce access themselves.
 */
export function WorkspaceSidebar({ actor }: { actor: Actor }) {
  const items = visibleNav(NAV_ITEMS, actor).filter(
    (i) => i.group !== "explore",
  );

  return (
    <div className="border-line hidden w-60 shrink-0 border-r lg:block">
      <nav
        aria-label="Workspace"
        className="lg:sticky lg:top-0 lg:max-h-dvh lg:overflow-y-auto"
      >
        <div className="flex flex-col gap-6 px-3 py-6">
          {items.length === 0 ? (
            <p className="text-muted text-data px-3">
              No workspace modules are available at your access level.
            </p>
          ) : null}
          {NAV_GROUPS.filter((g) => g !== "explore").map((group) => {
            const inGroup = items.filter((i) => i.group === group);
            if (inGroup.length === 0) return null;
            return (
              <section key={group} aria-labelledby={`side-${group}`}>
                <h2
                  id={`side-${group}`}
                  className="text-muted mb-1 px-3 font-mono text-xs tracking-[0.2em] uppercase"
                >
                  {NAV_GROUP_LABEL[group]}
                </h2>
                <ul className="flex flex-col">
                  {inGroup.map((item) => (
                    <li key={item.href}>
                      <NavLink
                        href={item.href}
                        {...(item.apacheServed ? { apacheServed: true } : {})}
                        className="text-muted hover:bg-surface-raised hover:text-ink aria-[current=page]:bg-surface-raised aria-[current=page]:text-ink flex min-h-9 items-center rounded-md px-3 text-sm font-medium transition-colors duration-(--duration-fast)"
                      >
                        {item.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
