import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Database } from "../db/types";
import * as S from "../db/schema";
import { reauthorize, type OrganizationContext } from "../context";
import { DataError } from "../db/errors";
import { businessExportTables } from "./migration";
import {
  inspectBusinessExport,
  validateBusinessExport,
  type BusinessOSExport,
} from "../../persistence/business-export";
import { localEnvelope } from "../../persistence/business-export";
import { localStoreKeys } from "../../persistence/export";
import { domainRepository, equalStoreData } from "./domain-conversion";
import { isPrivateStore } from "./workspace";

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
export function migrationChecksum(value: BusinessOSExport) {
  const e = validateBusinessExport(value);
  // Export time does not change business identity. Raw JSON is parsed so object
  // key ordering cannot change the checksum, while historical values are intact.
  return createHash("sha256")
    .update(
      canonical({
        schemaVersion: e.schemaVersion,
        profile: e.organizationProfile,
        sections: [e.assessment, e.system, e.strategy, e.scale, e.agent].map(
          (section) =>
            Object.fromEntries(
              Object.entries(section).map(([k, raw]) => [
                k,
                raw === null ? null : JSON.parse(raw),
              ]),
            ),
        ),
      }),
    )
    .digest("hex");
}
export function hasBusinessData(stores: Record<string, string | null>) {
  for (const [key, raw] of Object.entries(stores)) {
    if (!raw) continue;
    const data = JSON.parse(raw);
    if (key.includes("assessment")) {
      if (
        Object.values(data.answers ?? {}).some(
          (v) => v !== null && v !== "" && v !== undefined,
        )
      )
        return true;
      continue;
    }
    if (key === "growth-engine.scale.v1") {
      if (
        data.constraints?.length ||
        data.ideas?.length ||
        data.profile?.growthGoal ||
        Object.values(data.metrics ?? {}).some((v) => v !== null)
      )
        return true;
      for (const child of [
        data.experimentData,
        data.funnelData,
        data.networkData,
        data.readinessData,
      ])
        if (
          child &&
          Object.entries(child).some(
            ([k, v]) =>
              !["metrics", "capacityAreas"].includes(k) &&
              Array.isArray(v) &&
              v.length,
          )
        )
          return true;
      continue;
    }
    if (
      data.session ||
      Object.values(data).some((v) => Array.isArray(v) && v.length > 0)
    )
      return true;
  }
  return false;
}
export async function previewDataMigration(
  db: Database,
  context: OrganizationContext,
  input: { organizationId: string; package: unknown },
) {
  if (input.organizationId !== context.organizationId)
    throw new DataError("Forbidden", 403);
  // Existing Owner/Admin-only permission; Consultant/Editor/Viewer never receive it.
  await reauthorize(db, context, "organization.update");
  let value: BusinessOSExport;
  try {
    value = validateBusinessExport(input.package);
  } catch {
    throw new DataError("InvalidInput");
  }
  const inspection = inspectBusinessExport(value),
    checksum = migrationChecksum(value);
  return db.transaction(async (tx) => {
    const fresh = await reauthorize(tx, context, "organization.update");
    const [org] = await tx
      .select()
      .from(S.organizations)
      .where(eq(S.organizations.id, fresh.organizationId))
      .for("update");
    if (!org) throw new DataError("NotFound", 404);
    const conflicts: { code: string; field?: string }[] = [];
    const profile = value.organizationProfile;
    if (profile?.industry && org.industry && profile.industry !== org.industry)
      conflicts.push({ code: "ProfileConflict", field: "industry" });
    // Name difference is explicit: keep target company's identity, retain imported
    // assessment profile as historical provenance. Never silently rename a tenant.
    if (profile?.name && profile.name !== org.name)
      inspection.warnings.push({
        code: "TargetCompanyNameRetained",
        path: "organizationProfile.name",
      });
    const workspaces = await tx
      .select({ stores: S.tenantWorkspaces.stores })
      .from(S.tenantWorkspaces)
      .where(eq(S.tenantWorkspaces.organizationId, fresh.organizationId));
    const canonicalHeaders = await tx.select().from(S.domainStoreHeaders).where(eq(S.domainStoreHeaders.organizationId, fresh.organizationId));
    const canonicalOccupied = await Promise.all([...new Set(canonicalHeaders.map(row => row.ownerKey))].map(async ownerKey => {
      const stores = Object.assign({}, ...await Promise.all([localStoreKeys[0], "growth-engine.system.v1", "growth-engine.strategy.v1", "growth-engine.scale.v1", "growth-engine.advisor.v1"].map(key => domainRepository(tx, key).read(fresh.organizationId, ownerKey))));
      return hasBusinessData(stores);
    }));
    // One query checks every normalized business table, including tenants with
    // just a department/cycle/constraint/session and no process/objective yet.
    const tables = [...businessExportTables].filter(
      (name) =>
        !["organization_profiles", "organization_settings", "domain_store_headers"].includes(name) && !name.endsWith("_domain_records"),
    );
    const query = sql.join(
      tables.map(
        (name) =>
          sql`select exists(select 1 from ${sql.identifier(name)} where organization_id=${fresh.organizationId}::uuid) as occupied`,
      ),
      sql` union all `,
    );
    const occupancy = await tx.execute<{ occupied: boolean }>(query);
    const rows = Array.isArray(occupancy)
      ? occupancy
      : (occupancy as unknown as { rows: { occupied: boolean }[] }).rows;
    if (
      rows.some((row) => row.occupied) ||
      workspaces.some((row) => hasBusinessData(row.stores)) || canonicalOccupied.some(Boolean)
    )
      conflicts.push({ code: "NonEmptyOrganization" });
    const [record] = await tx
      .insert(S.dataMigrations)
      .values({
        organizationId: fresh.organizationId,
        initiatedByUserId: fresh.userId,
        source: "LocalBusinessOS",
        sourceSchemaVersion: 2,
        targetSchemaVersion: 1,
        status: "Previewed",
        entityCounts: inspection.counts,
        warnings: inspection.warnings,
        checksum,
        errorSummary: inspection.errors.length
          ? `${inspection.errors.length} critical reference errors`
          : null,
      })
      .returning({ id: S.dataMigrations.id, status: S.dataMigrations.status });
    await tx
      .insert(S.auditEvents)
      .values({
        organizationId: fresh.organizationId,
        actorUserId: fresh.userId,
        actorType: "User",
        module: "Migration",
        action: "MigrationPreviewed",
        entityType: "DataMigration",
        entityId: record.id,
        metadata: {
          checksum,
          criticalErrors: inspection.errors.length,
          conflicts: conflicts.map((x) => x.code),
          counts: inspection.counts,
        },
      });
    return {
      migrationId: record.id,
      organizationId: org.id,
      organizationName: org.name,
      checksum,
      ...inspection,
      conflicts,
      eligible: !inspection.errors.length && !conflicts.length,
      executionEnabled: true as const,
    };
  });
}
export async function executeDataMigration(db: Database, context: OrganizationContext, input: { organizationId: string; migrationId: string; checksum: string; package: unknown }, testFault?: (storeIndex: number) => void) {
  if (input.organizationId !== context.organizationId) throw new DataError("Forbidden", 403);
  const fresh = await reauthorize(db, context, "organization.update");
  let value: BusinessOSExport;
  try { value = validateBusinessExport(input.package); } catch { throw new DataError("InvalidInput"); }
  const checksum = migrationChecksum(value), inspection = inspectBusinessExport(value);
  if (checksum !== input.checksum || inspection.errors.length) throw new DataError("InvalidInput");
  return db.transaction(async tx => {
    const actor = await reauthorize(tx, fresh, "organization.update");
    await tx.select({ id: S.organizations.id }).from(S.organizations).where(eq(S.organizations.id, actor.organizationId)).for("update");
    const [record] = await tx.select().from(S.dataMigrations).where(and(eq(S.dataMigrations.organizationId, actor.organizationId), eq(S.dataMigrations.id, input.migrationId))).for("update");
    if (!record || record.status !== "Previewed" || record.checksum !== checksum || record.initiatedByUserId !== actor.userId) throw new DataError("Conflict", 409);
    // Recheck target occupancy and profile conflicts under the organization lock.
    const check = await previewDataMigration(tx, actor, { organizationId: actor.organizationId, package: value });
    if (!check.eligible) throw new DataError("Conflict", 409);
    await tx.update(S.dataMigrations).set({ status: "Running", errorSummary: null }).where(eq(S.dataMigrations.id, record.id));
    try {
      await tx.transaction(async atomic => {
        const source = localEnvelope(value).stores;
        for (let i = 0; i < localStoreKeys.length; i++) {
          const key = localStoreKeys[i], owner = isPrivateStore(key) ? actor.userId : "shared", repo = domainRepository(atomic, key);
          await repo.save(actor.organizationId, owner, key, source[key], { actorType: "LegacyLocal", userId: null });
          if (!equalStoreData(source[key], (await repo.read(actor.organizationId, owner))[key] ?? null)) throw Error("MigrationParityFailure");
          testFault?.(i);
        }
        // Invalidate already-open editors without rewriting their archive.
        const workspaces = await atomic.select().from(S.tenantWorkspaces).where(eq(S.tenantWorkspaces.organizationId, actor.organizationId));
        for (const row of workspaces) await atomic.update(S.tenantWorkspaces).set({ version: row.version + 1, updatedAt: new Date() }).where(eq(S.tenantWorkspaces.id, row.id));
        await atomic.update(S.dataMigrations).set({ status: "Succeeded", completedAt: new Date(), entityCounts: inspection.counts }).where(eq(S.dataMigrations.id, record.id));
        await atomic.insert(S.auditEvents).values({ organizationId: actor.organizationId, actorUserId: actor.userId, actorType: "User", module: "Migration", action: "MigrationSucceeded", entityType: "DataMigration", entityId: record.id, metadata: { checksum, counts: inspection.counts } });
      });
      return { status: "Succeeded" as const, migrationId: record.id, checksum, counts: inspection.counts };
    } catch {
      // The savepoint rolled back every business row. Keep the failure record
      // and audit outside that savepoint, and return rather than aborting them.
      await tx.update(S.dataMigrations).set({ status: "Failed", completedAt: new Date(), errorSummary: "Atomic import failed; business changes rolled back." }).where(eq(S.dataMigrations.id, record.id));
      await tx.insert(S.auditEvents).values({ organizationId: actor.organizationId, actorUserId: actor.userId, actorType: "User", module: "Migration", action: "MigrationFailed", entityType: "DataMigration", entityId: record.id, metadata: { checksum, rolledBack: true } });
      return { status: "Failed" as const, migrationId: record.id };
    }
  });
}
export async function listDataMigrations(
  db: Database,
  context: OrganizationContext,
) {
  const fresh = await reauthorize(db, context, "organization.update");
  return db
    .select()
    .from(S.dataMigrations)
    .where(and(eq(S.dataMigrations.organizationId, fresh.organizationId)))
    .orderBy(sql`${S.dataMigrations.startedAt} desc`)
    .limit(50);
}
