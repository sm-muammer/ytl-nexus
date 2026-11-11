import { buildAssets, buildTickets, sites } from "@/lib/server/db/seed/data";
import type { DataTable, RecordValues } from "@/lib/data/tables";

// Demo rows for Nexus Data. They come from the same generator as the database
// seed, so a demo session shows the rows a live session would show after
// `db:seed`. Each row carries its id, as the database does.

export type DemoRow = { id: number } & RecordValues;

export function demoRows(table: DataTable): DemoRow[] {
  if (table === "data_sites") return sites.map((s) => ({ ...s }));
  const assets = buildAssets();
  if (table === "data_assets") return assets.map((a) => ({ ...a }));
  return buildTickets(assets).map((t) => ({ ...t }));
}
