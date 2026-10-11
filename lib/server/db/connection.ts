import "server-only";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { DataError } from "./errors";
let pool: Pool | undefined;
export function getDatabase() {
  if (process.env.PERSISTENCE_MODE !== "database")
    throw new DataError("Disabled", 503);
  const url = process.env.DATABASE_URL;
  if (!url || !/^postgres(ql)?:\/\//.test(url))
    throw new DataError("DatabaseUnavailable", 503);
  if (!pool) {
    pool = new Pool({
      connectionString: url,
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    // Handle once; never print connection details or secrets.
    pool.on("error", () => {});
  }
  return drizzle(pool, { schema });
}
