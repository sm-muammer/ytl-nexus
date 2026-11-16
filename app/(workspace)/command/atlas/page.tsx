import { Suspense } from "react";
import { AtlasView } from "@/components/atlas/atlas-view";
import {
  CommandFrame,
  CommandLoading,
} from "@/components/command/command-frame";
import { RelatedModules } from "@/components/layout/related-modules";
import { pageMetadata } from "@/components/layout/module-page";
import { getAtlas } from "@/lib/server/atlas";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { getActor } from "@/lib/server/session";

export const metadata = pageMetadata("/command/atlas");

async function Atlas({ service }: { service: string | null }) {
  const actor = await getActor();
  let data = null;
  try {
    data = await getAtlas(actor);
  } catch {
    // The database is unreachable: say so instead of drawing a guess.
    data = null;
  }
  if (!data) {
    return (
      <section
        data-unavailable
        className="border-border-strong mx-(--spacing-gutter) my-8 border-l-2 pl-6"
      >
        <h2 className="text-heading-3 font-semibold">No data</h2>
        <p className="text-muted mt-2 max-w-(--spacing-prose)">
          The service inventory could not be read from the database. Nothing is
          shown rather than a guess.
        </p>
      </section>
    );
  }
  return (
    <AtlasView
      data={data}
      initial={service}
      role={actor?.role ?? null}
      demo={getMode() === "demo"}
    />
  );
}

export default async function AtlasPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string | string[] }>;
}) {
  await requirePage("/command/atlas");
  const { service } = await searchParams;
  const initial =
    typeof service === "string" && /^[a-z0-9-]{1,64}$/.test(service)
      ? service
      : null;
  return (
    <CommandFrame path="/command/atlas">
      <Suspense fallback={<CommandLoading what="the service map" />}>
        <Atlas service={initial} />
      </Suspense>
      <RelatedModules
        slugs={["command", "status", "shield"]}
        className="mx-(--spacing-gutter) my-8"
      />
    </CommandFrame>
  );
}
