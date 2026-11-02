// Runs database migrations as the `nexus_migrate` user.
//   npm run migrate          apply every pending migration
//   npm run migrate:down     reverse the newest migration
//   npm run migrate:status   list migrations and whether they ran
// Settings come from NEXUS_DB_* (see docs/operations/configuration.md).
import { createDb, readDbConfig } from "../../lib/server/db/connection.ts";
import {
  createMigrator,
  migrateDownOne,
  migrateToLatest,
} from "../../lib/server/db/migrate.ts";

const command = process.argv[2] ?? "up";
const db = createDb(readDbConfig(), { connectionLimit: 1 });
try {
  if (command === "up") {
    const applied = await migrateToLatest(db);
    console.log(
      applied.length
        ? `Applied: ${applied.join(", ")}`
        : "Database is up to date.",
    );
  } else if (command === "down") {
    const name = await migrateDownOne(db);
    console.log(name ? `Reversed: ${name}` : "Nothing to reverse.");
  } else if (command === "status") {
    for (const m of await createMigrator(db).getMigrations()) {
      console.log(`${m.executedAt ? "applied " : "pending "} ${m.name}`);
    }
  } else {
    throw new Error(`Unknown command "${command}". Use up, down or status.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Migration failed.");
  process.exitCode = 1;
} finally {
  await db.destroy();
}
