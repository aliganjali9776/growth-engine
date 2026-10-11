import "server-only";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve, relative, isAbsolute } from "node:path";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { getTableName, is } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as S from "../lib/server/db/schema";
import { businessExportTables } from "../lib/server/services/migration";
import { localStoreKeys, validateLocalExport } from "../lib/persistence/export";
import { businessExportFromLocal, inspectBusinessExport } from "../lib/persistence/business-export";
import { splitDomainStore, joinDomainStore } from "../lib/persistence/domain-records";

async function main() {
  const path = resolve(process.env.DEV_DATABASE_PATH ?? ".data/postgres-saas-dev-fixed");
  const rel = relative(resolve(".data"), path);
  if (rel.startsWith("..") || isAbsolute(rel)) throw Error("InvalidDatabasePath");
  // Run only while the application is stopped. This script never migrates,
  // seeds, updates or deletes database records, and never accesses a browser.
  const pg = new PGlite(path), db = drizzle(pg, { schema: S });
  try {
    const archivedWorkspaces = await db.select().from(S.tenantWorkspaces);
    const businessRows: Record<string, unknown> = {};
    for (const table of Object.values(S)) if (is(table, PgTable) && businessExportTables.has(getTableName(table))) businessRows[getTableName(table)] = await db.select().from(table);
    const archive = { schemaVersion: 1, source: "postgres-business-recovery", exportedAt: new Date().toISOString(), archivedWorkspaces, businessRows };
    const content = JSON.stringify(archive, null, 2);
    const folder = resolve(".data/backups/build7d"), filename = resolve(folder, `business-recovery-${Date.now()}.json`);
    await mkdir(folder, { recursive: true });
    await writeFile(filename, content, { flag: "wx" });
    const saved = await readFile(filename, "utf8");
    if (!isDeepStrictEqual(JSON.parse(saved), JSON.parse(content))) throw Error("BackupVerificationFailed");
    const checksum = createHash("sha256").update(saved).digest("hex");
    await writeFile(filename + ".sha256", checksum + "\n", { flag: "wx" });
    const issues: Array<{ organizationId: string; ownerKey: string; stage: string; detail: unknown }> = [];
    let checkedStores = 0;
    for (const workspace of archivedWorkspaces) {
      const shared = archivedWorkspaces.find(row => row.organizationId === workspace.organizationId && row.ownerKey === "shared");
      const stores = Object.fromEntries(localStoreKeys.map(key => [key, workspace.stores[key] ?? shared?.stores[key] ?? null]));
      try {
        const local = validateLocalExport({ schemaVersion: 1, source: "browser-local-v1", localWorkspaceId: "server-preflight", exportedAt: archive.exportedAt, stores, moduleVersions: Object.fromEntries(localStoreKeys.map(key => [key, stores[key] === null ? null : JSON.parse(stores[key]!).version ?? null])) });
        const inspection = inspectBusinessExport(businessExportFromLocal(local));
        if (inspection.errors.length) issues.push({ organizationId: workspace.organizationId, ownerKey: workspace.ownerKey, stage: "references", detail: inspection.errors });
        for (const key of localStoreKeys) {
          const raw = stores[key];
          const restored = joinDomainStore(key, splitDomainStore(key, raw));
          if (!isDeepStrictEqual(raw === null ? null : JSON.parse(raw), restored === null ? null : JSON.parse(restored))) issues.push({ organizationId: workspace.organizationId, ownerKey: workspace.ownerKey, stage: "parity", detail: key });
          checkedStores++;
        }
      } catch (error) {
        issues.push({ organizationId: workspace.organizationId, ownerKey: workspace.ownerKey, stage: "schema", detail: error instanceof Error ? error.message : "InvalidState" });
      }
    }
    const report = { backupPath: filename, checksum, workspaceCount: archivedWorkspaces.length, checkedStores, issueCount: issues.length, issues, activationAllowed: issues.length === 0 };
    await writeFile(resolve(folder, "preflight-report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ backupPath: filename, workspaceCount: archivedWorkspaces.length, checkedStores, issueCount: issues.length, activationAllowed: report.activationAllowed }));
    if (issues.length) process.exitCode = 2;
  } finally { await pg.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "PreflightFailed"); process.exitCode = 1; });
