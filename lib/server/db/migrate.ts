import { promises as fs } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { Kysely } from "kysely";
import {
  Migrator,
  type Migration,
  type MigrationProvider,
  type MigrationResult,
} from "kysely/migration";

// Migrations are written against an untyped handle; the typed `Database` view
// is only for application queries. Any Kysely instance is accepted here.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyKysely = Kysely<any>;

export const MIGRATIONS_DIR = path.join(import.meta.dirname, "migrations");

// Loads `<timestamp>-<description>.ts` files from the migrations folder. Each
// must export both `up` and `down`; a file missing either is refused so no
// migration can ship without a way back (requirement 5.4).
const provider: MigrationProvider = {
  async getMigrations() {
    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => /^\d{14}-[a-z0-9-]+\.ts$/.test(f))
      .sort();
    const migrations: Record<string, Migration> = {};
    for (const file of files) {
      const mod = (await import(
        pathToFileURL(path.join(MIGRATIONS_DIR, file)).href
      )) as Partial<Migration>;
      if (typeof mod.up !== "function" || typeof mod.down !== "function") {
        throw new Error(`Migration ${file} must export both up and down.`);
      }
      migrations[file.replace(/\.ts$/, "")] = { up: mod.up, down: mod.down };
    }
    return migrations;
  },
};

export function createMigrator(db: AnyKysely): Migrator {
  return new Migrator({ db, provider });
}

function assertOk(
  label: string,
  results: MigrationResult[] | undefined,
  error: unknown,
) {
  if (error) {
    const failed = results?.find((r) => r.status === "Error");
    const where = failed ? ` in ${failed.migrationName}` : "";
    const cause = error instanceof Error ? `: ${error.message}` : "";
    throw new Error(`Migration ${label} failed${where}${cause}`);
  }
}

/** Applies every pending migration. Returns the names applied. */
export async function migrateToLatest(db: AnyKysely): Promise<string[]> {
  const { error, results } = await createMigrator(db).migrateToLatest();
  assertOk("up", results, error);
  return (results ?? []).map((r) => r.migrationName);
}

/** Reverses the most recent migration. Returns its name, or undefined if none. */
export async function migrateDownOne(
  db: AnyKysely,
): Promise<string | undefined> {
  const { error, results } = await createMigrator(db).migrateDown();
  assertOk("down", results, error);
  return results?.[0]?.migrationName;
}

/** Reverses every applied migration, newest first. */
export async function migrateDownAll(db: AnyKysely): Promise<string[]> {
  const reversed: string[] = [];
  for (;;) {
    const name = await migrateDownOne(db);
    if (!name) return reversed;
    reversed.push(name);
  }
}
