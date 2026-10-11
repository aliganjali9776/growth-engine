import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { joinDomainStore } from "../lib/persistence/domain-records";
import { localStoreKeys } from "../lib/persistence/export";
import { businessExportFromLocal, validateBusinessExport } from "../lib/persistence/business-export";

// Read an already downloaded artifact. Never open a database or browser storage.
async function main() {
const filename = process.argv[2];
if (!filename) throw Error("Downloaded backup path required");
const bytes = await readFile(filename);
const backup = JSON.parse(bytes.toString("utf8"));
const fixture = JSON.parse(await readFile(".build7d-synthetic-backup.json", "utf8"));
const tables = backup.tables as Record<string, any[]>;
const expectedOrganization = "984bc0f2-1a5e-412b-8330-bd0d8f8c5c2a";
if (backup.source !== "server-postgresql-v1" || backup.organization?.id !== expectedOrganization) throw Error("Unexpected test backup");
const forbidden = /^(password|passwordHash|password_hash|accessToken|refreshToken|sessionSecret|tokenHash|token_hash|invitationToken|rawInvitationToken|apiKey|api_key|apiSecret|api_secret|DATABASE_URL|BETTER_AUTH_SECRET|environmentSecrets|environment_secrets)$/i;
let forbiddenFields = 0;
function scan(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) { if (forbidden.test(key)) forbiddenFields++; scan(child); }
}
scan(backup);
let foreignRows = 0;
for (const rows of Object.values(tables)) for (const row of rows) if (row.organizationId !== expectedOrganization) foreignRows++;
const recordTables = ["assessment_domain_records", "system_domain_records", "strategy_domain_records", "scale_domain_records", "agent_domain_records"];
const parity = localStoreKeys.map(storeKey => {
  const headers = tables.domain_store_headers.filter(row => row.storeKey === storeKey);
  if (headers.length !== 1) throw Error(`Ambiguous test owner: ${storeKey}`);
  const header = headers[0];
  const records = recordTables.flatMap(table => tables[table]).filter(row => row.storeKey === storeKey && row.ownerKey === header.ownerKey);
  const restored = joinDomainStore(storeKey, { metadata: header.metadata, records });
  const expected = Object.values(fixture).find((section: any) => section && typeof section === "object" && storeKey in section) as Record<string, string | null>;
  const equal = isDeepStrictEqual(restored === null ? null : JSON.parse(restored), expected[storeKey] === null ? null : JSON.parse(expected[storeKey]!));
  if (!equal) throw Error(`Downloaded store parity failed: ${storeKey}`);
  return { storeKey, equal, records: records.length };
});
let acceptedByMigration = false;
try { backup.schemaVersion === 1 ? businessExportFromLocal(backup) : validateBusinessExport(backup); acceptedByMigration = true; } catch { /* Preserve the rejection: no lossy conversion. */ }
const report = {
  checkedAt: new Date().toISOString(), organizationId: expectedOrganization, filename,
  bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
  forbiddenFields, foreignRows, parity,
  acceptedByMigration,
  restoreDisposition: "DEFERRED by approved Beta scope: full automated PostgreSQL business-backup restore. PostgreSQL-level backup/restore is the Beta recovery mechanism. No lossy conversion is permitted.",
};
if (forbiddenFields || foreignRows) throw Error("Unsafe downloaded backup");
await writeFile("docs/qa/build7d-downloaded-backup-verification.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({ bytes: report.bytes, parityStores: parity.length, forbiddenFields, foreignRows, acceptedByMigration, restoreDisposition: report.restoreDisposition }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
