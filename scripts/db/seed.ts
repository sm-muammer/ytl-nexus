// Loads the deterministic sample data.
//   npm run db:seed              refuses if seeded tables already hold rows
//   npm run db:seed -- --reset   replaces the sample data (audit_events is kept)
import { createDb, readDbConfig } from "../../lib/server/db/connection.ts";
import { seedDatabase } from "../../lib/server/db/seed/run.ts";

const db = createDb(readDbConfig(), { connectionLimit: 1 });
try {
  const { rows } = await seedDatabase(db, {
    reset: process.argv.includes("--reset"),
  });
  for (const [table, count] of Object.entries(rows)) {
    console.log(`${table}: ${count}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Seed failed.");
  process.exitCode = 1;
} finally {
  await db.destroy();
}
