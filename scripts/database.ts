import { resolve, relative, isAbsolute } from "node:path";
import { mkdir } from "node:fs/promises";
import { DataError } from "../lib/server/db/errors";
import * as schema from "../lib/server/db/schema";
import { sql } from "drizzle-orm";
import { readMigrationFiles } from "drizzle-orm/migrator";
const action = process.argv[2];
async function main() {
  if (
    !["migrate", "status", "seed", "seed-saas", "health", "reset"].includes(
      action,
    )
  )
    throw new DataError("InvalidInput");
  const embedded = process.env.DATABASE_DRIVER === "pglite";
  if (
    ["seed", "seed-saas", "reset"].includes(action) &&
    process.env.NODE_ENV !== "development"
  )
    throw new DataError("Disabled");
  if (
    action === "reset" &&
    process.env.ALLOW_DEV_DB_RESET !== "reset-disposable-database"
  )
    throw new DataError("Disabled");
  if (embedded && process.env.NODE_ENV !== "development")
    throw new DataError("Disabled");
  let close: () => Promise<void>,
    db: import("../lib/server/db/types").Database,
    migrate: () => Promise<void>;
  if (embedded) {
    const root = resolve(".data"),
      path = resolve(process.env.DEV_DATABASE_PATH ?? ".data/postgres-dev"),
      rel = relative(root, path);
    if (rel.startsWith("..") || isAbsolute(rel))
      throw new DataError("InvalidInput");
    await mkdir(root, { recursive: true });
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate: run } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite(path);
    const embeddedDb = drizzle(client, { schema });
    db = embeddedDb;
    close = () => client.close();
    migrate = () => run(embeddedDb, { migrationsFolder: "drizzle" });
  } else {
    if (!process.env.DATABASE_URL) throw new DataError("DatabaseUnavailable");
    const { Pool } = await import("pg");
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate: run } = await import("drizzle-orm/node-postgres/migrator");
    const client = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      max: 2,
    });
    client.on("error", () => {});
    const pgDb = drizzle(client, { schema });
    db = pgDb;
    close = () => client.end();
    migrate = () => run(pgDb, { migrationsFolder: "drizzle" });
    if (["seed", "seed-saas", "reset"].includes(action)) {
      const url = new URL(process.env.DATABASE_URL);
      if (
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
        !url.pathname.includes("_dev")
      ) {
        await close();
        throw new DataError("Disabled");
      }
    }
  }
  try {
    if (action === "reset") {
      await db.execute(sql`DROP SCHEMA public CASCADE`);
      await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
      await db.execute(sql`CREATE SCHEMA public`);
      await migrate();
      console.log("Disposable development database reset and migrated");
    } else if (action === "migrate") {
      await migrate();
      console.log("Formal migrations applied");
    } else if (action === "status") {
      const expected = readMigrationFiles({ migrationsFolder: "drizzle" });
      const result = await db.execute(
        sql`SELECT hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at`,
      );
      const rows = (
        result as { rows: { hash: string; created_at: string | number }[] }
      ).rows;
      if (
        rows.length !== expected.length ||
        expected.some(
          (migration, index) =>
            rows[index]?.hash !== migration.hash ||
            Number(rows[index]?.created_at) !== migration.folderMillis,
        )
      )
        throw new DataError("MigrationMissing", 503);
      console.log(
        `Migration status: ${rows.length}/${expected.length} applied; hashes verified`,
      );
    } else if (action === "seed-saas") {
      const { seedSaaSDevelopment } =
        await import("../lib/server/dev/saas-seed");
      console.log(JSON.stringify(await seedSaaSDevelopment(db)));
    } else if (action === "seed") {
      const { seedDevelopment } = await import("../lib/server/dev/seed");
      console.log(JSON.stringify(await seedDevelopment(db)));
    } else {
      await db
        .select({ id: schema.organizations.id })
        .from(schema.organizations)
        .limit(1);
      console.log("Database ready; tenant schema available");
    }
  } finally {
    await close();
  }
}
main().catch(async (error) => {
  const { safeDataError } = await import("../lib/server/db/errors");
  console.error(safeDataError(error).code);
  process.exitCode = 1;
});
