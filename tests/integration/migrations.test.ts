import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  MIGRATIONS_DIR,
  migrateDownAll,
  migrateToLatest,
} from "@/lib/server/db/migrate";
import { APPLICATION_TABLES } from "@/lib/server/db/schema";
import {
  createScratchDatabase,
  schemaSnapshot,
  type ScratchDatabase,
} from "./helpers/test-db";

let scratch: ScratchDatabase;
beforeAll(async () => {
  scratch = await createScratchDatabase();
});
afterAll(async () => {
  await scratch.drop();
});

async function tables(): Promise<string[]> {
  const [rows] = await scratch.admin.query(
    "SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME NOT LIKE 'kysely%' ORDER BY TABLE_NAME",
    [scratch.name],
  );
  return (rows as { name: string }[]).map((r) => r.name).sort();
}

describe("migrations", () => {
  it("exports both up and down from every migration file", async () => {
    const files = (await fs.readdir(MIGRATIONS_DIR)).filter((f) =>
      f.endsWith(".ts"),
    );
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(file).toMatch(/^\d{14}-[a-z0-9-]+\.ts$/);
      const mod = await import(
        /* @vite-ignore */ path.join(MIGRATIONS_DIR, file)
      );
      expect(typeof mod.up, `${file} up`).toBe("function");
      expect(typeof mod.down, `${file} down`).toBe("function");
    }
  });

  it("creates every required table on an empty database", async () => {
    await migrateToLatest(scratch.migrate);
    expect(await tables()).toEqual([...APPLICATION_TABLES].sort());
  });

  it("goes up, down and up again with an identical schema (Property 8)", async () => {
    await migrateDownAll(scratch.migrate);
    expect(await tables()).toEqual([]);

    await migrateToLatest(scratch.migrate);
    const first = await schemaSnapshot(scratch.admin, scratch.name);

    await migrateDownAll(scratch.migrate);
    expect(await tables()).toEqual([]);

    await migrateToLatest(scratch.migrate);
    const second = await schemaSnapshot(scratch.admin, scratch.name);

    expect(second).toBe(first);
  });

  it("is a no-op when run again at the latest version", async () => {
    expect(await migrateToLatest(scratch.migrate)).toEqual([]);
  });
});
