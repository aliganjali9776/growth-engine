import { readFile, writeFile } from "node:fs/promises";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import * as schema from "../lib/server/db/schema";
async function main() {
  const previous = JSON.parse(await readFile("drizzle/meta/0006_snapshot.json", "utf8"));
  const current = generateDrizzleJson(schema, previous.id);
  const statements = await generateMigration(previous, current);
  const names = ["system_domain_records", "strategy_domain_records", "scale_domain_records", "agent_domain_records", "assessment_domain_records", "domain_store_headers"];
  const unexpected = statements.filter(statement => /^(DROP |TRUNCATE |DELETE )/i.test(statement) || !names.some(name => statement.includes(`"${name}"`)));
  if (unexpected.length) { console.log(unexpected); throw Error("UnexpectedSchemaChange"); }
  const journal = JSON.parse(await readFile("drizzle/meta/_journal.json", "utf8"));
  if (journal.entries.some((entry: { idx: number }) => entry.idx === 7)) throw Error("AlreadyGenerated");
  await writeFile("drizzle/0007_canonical_domain_records.sql", statements.join("\n--> statement-breakpoint\n"));
  await writeFile("drizzle/meta/0007_snapshot.json", JSON.stringify(current, null, 2));
  journal.entries.push({ idx: 7, version: "7", when: 1791400000000, tag: "0007_canonical_domain_records", breakpoints: true });
  await writeFile("drizzle/meta/_journal.json", JSON.stringify(journal, null, 2));
  console.log(`Generated additive canonical domain migration: ${statements.length} statements.`);
}
main().catch(error => { console.error(error); process.exitCode = 1; });
