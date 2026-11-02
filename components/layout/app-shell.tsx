import type { ReactNode } from "react";
import { getMode } from "@/lib/server/mode";
import { getActor } from "@/lib/server/session";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { WorkspaceSidebar } from "./workspace-sidebar";

export type Register = "public" | "workspace";

/**
 * The page frame shared by every route group: banner, optional workspace
 * menu, the main landmark and the footer. The root layout supplies the skip
 * link, which targets #main-content here. The main element takes programmatic
 * focus so the skip link moves focus, not just the scroll position.
 *
 * public: editorial, roomy, particles allowed in heroes.
 * workspace: dense and dark, a module sidebar, no decoration around controls.
 */
export async function AppShell({
  register,
  children,
}: {
  register: Register;
  children: ReactNode;
}) {
  const mode = getMode();
  const actor = await getActor();

  return (
    <div data-register={register} className="flex min-h-dvh flex-1 flex-col">
      <SiteHeader mode={mode} actor={actor} />
      <div className="max-w-page mx-auto flex w-full flex-1">
        {register === "workspace" ? <WorkspaceSidebar actor={actor} /> : null}
        <main
          id="main-content"
          tabIndex={-1}
          className="min-w-0 flex-1 outline-none"
        >
          {children}
        </main>
      </div>
      <SiteFooter actor={actor} mode={mode} />
    </div>
  );
}
