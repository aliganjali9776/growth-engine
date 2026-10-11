import "server-only";
import type { Database } from "./db/types";
import { createAuth } from "./auth";
import { getDatabase } from "./db/connection";
export function appMode() {
  const mode = process.env.APP_MODE ?? "saas";
  if (!["local", "saas"].includes(mode)) throw Error("InvalidAppMode");
  return mode as "local" | "saas";
}
type Runtime = Promise<{ db: Database; auth: ReturnType<typeof createAuth> }>;
// App-route and React server bundles must share one embedded database instance.
// Only connection/framework objects are cached, never user or tenant context.
const processState = globalThis as typeof globalThis & {
  growthEngineSaaSRuntime?: Runtime;
};
export function getSaaSRuntime() {
  if (appMode() !== "saas") throw Error("SaaSDisabled");
  return (processState.growthEngineSaaSRuntime ??= (async () => {
    const baseURL = process.env.BETTER_AUTH_URL,
      secret = process.env.BETTER_AUTH_SECRET;
    if (!baseURL || !secret || secret.length < 32)
      throw Error("AuthConfigurationMissing");
    let db: Database;
    if (process.env.SAAS_DEV_DATABASE === "true") {
      if (process.env.NODE_ENV === "production") throw Error("EmbeddedDatabaseDisabledInProduction");
      const url = new URL(baseURL);
      if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        throw Error("EmbeddedDatabaseLocalOnly");
      const { resolve, relative, isAbsolute } = await import("node:path");
      const root = resolve(".data"),
        path = resolve(
          process.env.DEV_DATABASE_PATH ?? ".data/postgres-saas-dev",
        ),
        rel = relative(root, path);
      if (rel.startsWith("..") || isAbsolute(rel))
        throw Error("InvalidDevPath");
      const { mkdir } = await import("node:fs/promises");
      await mkdir(root, { recursive: true });
      const { PGlite } = await import("@electric-sql/pglite");
      const { drizzle } = await import("drizzle-orm/pglite");
      const schema = await import("./db/schema");
      db = drizzle(new PGlite(path), { schema });
    } else db = getDatabase();
    return { db, auth: createAuth(db, { baseURL, secret }) };
  })());
}
