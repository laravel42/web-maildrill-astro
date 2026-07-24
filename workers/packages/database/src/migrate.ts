import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client";

async function main(): Promise<void> {
  // Run from the repo root (pnpm db:migrate); migrations live in ./migrations.
  await migrate(db, { migrationsFolder: "migrations" });
  // eslint-disable-next-line no-console
  console.log("migrations applied");
}

main()
  .catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error("migration failed:", err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
