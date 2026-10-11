import { readFile, writeFile } from "node:fs/promises";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../lib/server/db/schema";
async function main() {
  const previous = JSON.parse(
    await readFile("drizzle/meta/0004_snapshot.json", "utf8"),
  );
  const current = generateDrizzleJson(schema, previous.id);
  const statements = await generateMigration(previous, current);
  if (
    !statements.length ||
    statements.some((statement) => !statement.includes('"data_migrations"'))
  ) {
    console.log(statements);
    throw Error("UnexpectedSchemaDifference");
  }
  await writeFile(
    "drizzle/meta/0006_snapshot.json",
    JSON.stringify(current, null, 2),
  );
  console.log(
    "Schema snapshot verified: only data_migrations table and index added.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
