import { DataView } from "@/components/data/data-view";
import { pageMetadata } from "@/components/layout/module-page";
import { meetsRole } from "@/lib/roles";
import { parseListQuery } from "@/lib/data/query";
import {
  getChanges,
  getPage,
  getReferenceOptions,
  getSchema,
} from "@/lib/server/data";
import { requirePage } from "@/lib/server/guards";
import { getMode } from "@/lib/server/mode";
import { getActor } from "@/lib/server/session";

export const metadata = pageMetadata("/data");

type SearchParams = Record<string, string | string[] | undefined>;

export default async function DataPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requirePage("/data");
  const parsed = parseListQuery(await searchParams);
  if (!parsed.ok) {
    return (
      <div className="px-(--spacing-gutter) py-10">
        <h1 className="text-heading-2 font-semibold">Nexus Data</h1>
        <p className="mt-4">
          That address is not valid ({parsed.reason}).{" "}
          <a href="/data" className="underline">
            Open the assets table
          </a>
          .
        </p>
      </div>
    );
  }
  const query = parsed.query;
  const actor = await getActor();

  let loaded: Awaited<ReturnType<typeof load>> | null = null;
  try {
    loaded = await load(query);
  } catch {
    // The database is unreachable: say so instead of showing a guess.
    loaded = null;
  }
  if (!loaded) {
    return (
      <section
        data-unavailable
        className="border-border-strong mx-(--spacing-gutter) my-8 border-l-2 pl-6"
      >
        <h1 className="text-heading-2 font-semibold">No data</h1>
        <p className="text-muted mt-2 max-w-(--spacing-prose)">
          The records could not be read from the database. Nothing is shown
          rather than a guess.
        </p>
      </section>
    );
  }
  return (
    <DataView
      query={query}
      list={loaded.list}
      options={loaded.options}
      schema={loaded.schema}
      changes={loaded.changes}
      canWrite={meetsRole(actor, "operator")}
      demo={getMode() === "demo"}
    />
  );
}

function load(query: Parameters<typeof getPage>[0]) {
  return Promise.all([
    getPage(query),
    getReferenceOptions(query.table),
    getSchema(),
    getChanges(),
  ]).then(([list, options, schema, changes]) => ({
    list,
    options,
    schema,
    changes,
  }));
}
