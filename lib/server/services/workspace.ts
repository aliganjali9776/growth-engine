import "server-only";
import { and, eq, or } from "drizzle-orm";
import type { Database } from "../db/types";
import * as S from "../db/schema";
import { reauthorize, type OrganizationContext } from "../context";
import { DataError } from "../db/errors";
import { localStoreKeys, validateLocalExport } from "../../persistence/export";
import { emptyDraft } from "../../assessment/persistence";
import { emptyStrategy } from "../../strategy/model";
import { seedScale } from "../../scale/seed";
import {
  authorizeWorkspaceChange,
  workspaceSecurityEvents,
  workspaceViewPermission,
} from "./workspace-permissions";
import { convertArchivedStores, domainRepository, equalStoreData } from "./domain-conversion";
import { domainService } from "./domain-state";
import { usesCanonicalRecords } from "./domain-rollout";

async function resolveActiveStores(tx: Database, organizationId: string, ownerKey: string, archived: Record<string, string | null>) {
  const selected = Object.fromEntries(Object.entries(archived).filter(([key]) => usesCanonicalRecords(key)));
  await convertArchivedStores(tx, organizationId, ownerKey, selected);
  const current = { ...archived };
  const modules = new Set<string>();
  for (const key of Object.keys(selected)) {
    const repo = domainRepository(tx, key);
    if (modules.has(repo.constructor.name)) continue;
    modules.add(repo.constructor.name);
    Object.assign(current, await repo.read(organizationId, ownerKey));
  }
  return current;
}
export const isPrivateStore = (key: string) =>
  (key.startsWith("growth-engine.agent") &&
    key !== "growth-engine.agent.diagnosis.v1") ||
  key === "growth-engine.advisor.v1";
export function emptyCompanyStores(name: string, industry: string | null) {
  const stores = Object.fromEntries(
    localStoreKeys.map((k) => [k, null]),
  ) as Record<string, string | null>;
  const assessment = emptyDraft();
  assessment.profile.name = name;
  assessment.profile.industry = industry ?? "";
  stores[localStoreKeys[0]] = JSON.stringify(assessment);
  stores["growth-engine.system.v1"] = JSON.stringify({
    version: 1,
    departments: [],
    roles: [],
    people: [],
    processes: [],
  });
  stores["growth-engine.strategy.v1"] = JSON.stringify(emptyStrategy());
  const scale = seedScale();
  scale.sample = false;
  scale.constraints = [];
  scale.ideas = [];
  scale.primaryConstraintId = null;
  scale.profile = {
    ...scale.profile,
    businessModel: "",
    growthGoal: "",
    growthHorizon: "",
    primaryGrowthMetric: "",
    notes: "",
  };
  scale.metrics = Object.fromEntries(
    Object.keys(scale.metrics).map((k) => [k, null]),
  ) as typeof scale.metrics;
  scale.metricPeriod = "";
  scale.diagnostics = scale.diagnostics.map((d) => ({
    ...d,
    status: "unknown",
    evidence: "",
    dataCompleteness: 0,
  }));
  stores["growth-engine.scale.v1"] = JSON.stringify(scale);
  stores["growth-engine.process-maps.v1"] = JSON.stringify({
    version: 1,
    maps: [],
  });
  return stores;
}
export async function readTenantWorkspace(
  db: Database,
  context: OrganizationContext,
) {
  const fresh = await reauthorize(db, context, "organization.view");
  return db.transaction(async (tx) => {
    const [org] = await tx
      .select()
      .from(S.organizations)
      .where(eq(S.organizations.id, context.organizationId));
    if (!org) throw new DataError("NotFound", 404);
    const shared = Object.fromEntries(
      Object.entries(emptyCompanyStores(org.name, org.industry)).filter(
        ([k]) => !isPrivateStore(k),
      ),
    );
    const privateStores = Object.fromEntries(
      localStoreKeys.filter(isPrivateStore).map((k) => [k, null]),
    );
    await tx
      .insert(S.tenantWorkspaces)
      .values([
        {
          organizationId: context.organizationId,
          ownerKey: "shared",
          stores: shared,
        },
        {
          organizationId: context.organizationId,
          ownerKey: context.userId,
          stores: privateStores,
        },
      ])
      .onConflictDoNothing();
    const rows = await tx
      .select()
      .from(S.tenantWorkspaces)
      .where(
        and(
          eq(S.tenantWorkspaces.organizationId, context.organizationId),
          or(
            eq(S.tenantWorkspaces.ownerKey, "shared"),
            eq(S.tenantWorkspaces.ownerKey, context.userId),
          ),
        ),
      );
    const a = rows.find((r) => r.ownerKey === "shared")!,
      b = rows.find((r) => r.ownerKey === context.userId)!;
    const activeShared = await resolveActiveStores(tx, fresh.organizationId, "shared", a.stores);
    const activePrivate = await resolveActiveStores(tx, fresh.organizationId, fresh.userId, b.stores);
    return {
      organizationId: context.organizationId,
      stores: Object.fromEntries(
        Object.entries({
          ...Object.fromEntries(localStoreKeys.map((key) => [key, null])),
          ...activeShared,
          ...Object.fromEntries(
            Object.entries(activePrivate).filter(([key]) => isPrivateStore(key)),
          ),
        }).map(([key, raw]) => [
          key,
          fresh.permissions.includes(workspaceViewPermission(key)) ? raw : null,
        ]),
      ),
      sharedVersion: a.version,
      privateVersion: b.version,
    };
  });
}
export async function writeTenantWorkspace(
  db: Database,
  context: OrganizationContext,
  input: {
    organizationId: string;
    sharedVersion: number;
    privateVersion: number;
    stores: Record<string, string | null>;
  },
) {
  if (input.organizationId !== context.organizationId)
    throw new DataError("Forbidden", 403);
  if (
    !Number.isInteger(input.sharedVersion) ||
    !Number.isInteger(input.privateVersion)
  )
    throw new DataError("InvalidInput");
  let stores: Record<string, string | null>;
  try {
    const versions = Object.fromEntries(
      localStoreKeys.map((k) => [
        k,
        input.stores[k] === null
          ? null
          : (JSON.parse(input.stores[k]!).version ?? null),
      ]),
    );
    stores = validateLocalExport({
      schemaVersion: 1,
      source: "browser-local-v1",
      localWorkspaceId: "server-workspace",
      exportedAt: new Date().toISOString(),
      moduleVersions: versions,
      stores: input.stores,
    }).stores;
  } catch {
    throw new DataError("InvalidInput");
  }
  if (Buffer.byteLength(JSON.stringify(stores)) > 8 * 1024 * 1024)
    throw new DataError("InvalidInput", 413);
  return db.transaction(async (tx) => {
    const fresh = await reauthorize(tx, context, "organization.view");
    const rows = await tx
      .select()
      .from(S.tenantWorkspaces)
      .where(
        and(
          eq(S.tenantWorkspaces.organizationId, context.organizationId),
          or(
            eq(S.tenantWorkspaces.ownerKey, "shared"),
            eq(S.tenantWorkspaces.ownerKey, context.userId),
          ),
        ),
      )
      .for("update");
    const shared = rows.find((r) => r.ownerKey === "shared"),
      privateRow = rows.find((r) => r.ownerKey === context.userId);
    if (
      !shared ||
      !privateRow ||
      shared.version !== input.sharedVersion ||
      privateRow.version !== input.privateVersion
    )
      throw new DataError("Conflict", 409);
    const activeShared = await resolveActiveStores(tx, fresh.organizationId, "shared", shared.stores);
    const activePrivate = await resolveActiveStores(tx, fresh.organizationId, fresh.userId, privateRow.stores);
    const previousStore = (key: string) => (isPrivateStore(key) ? activePrivate : activeShared)[key] ?? null;
    // Masked stores are returned as null; retain them without granting write access.
    for (const key of localStoreKeys)
      if (!fresh.permissions.includes(workspaceViewPermission(key))) {
        if (stores[key] !== null) throw new DataError("Forbidden", 403);
        stores[key] = previousStore(key);
      }
    const changed = localStoreKeys.filter(
      (k) =>
        !equalStoreData(previousStore(k), stores[k]),
    );
    for (const key of changed) {
      for (const action of workspaceSecurityEvents(
        key,
        previousStore(key),
        stores[key],
      ))
        await tx
          .insert(S.auditEvents)
          .values({
            organizationId: fresh.organizationId,
            actorUserId: fresh.userId,
            actorType: "User",
            module: "Workspace",
            action,
            entityType: "workspace",
            entityId: shared.id,
            metadata: { storeKey: key },
          });
      authorizeWorkspaceChange(
        fresh,
        key,
        previousStore(key),
        stores[key],
      );
      if (
        key === "growth-engine.agent.execution.v1" ||
        key === "growth-engine.agent.v1"
      )
        throw new DataError("Disabled", 403);
    }
    for (const key of changed.filter(usesCanonicalRecords)) await domainService(tx, key).save(fresh, key, previousStore(key), stores[key], isPrivateStore(key) ? fresh.userId : "shared");
    for (const row of [shared, privateRow]) {
      const values = Object.fromEntries(
        Object.entries(stores).filter(
          ([k]) => !usesCanonicalRecords(k) && isPrivateStore(k) === (row.ownerKey !== "shared"),
        ),
      );
      if (
        changed.some((k) => isPrivateStore(k) === (row.ownerKey !== "shared"))
      ) {
        await tx
          .update(S.tenantWorkspaces)
          .set({
            ...(Object.keys(values).length ? { stores: { ...row.stores, ...values } } : {}),
            version: row.version + 1,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(S.tenantWorkspaces.organizationId, context.organizationId),
              eq(S.tenantWorkspaces.id, row.id),
            ),
          );
        row.version++;
      }
    }
    if (changed.length)
      await tx.insert(S.auditEvents).values({
        organizationId: context.organizationId,
        actorUserId: context.userId,
        actorType: "User",
        module: "Workspace",
        action: "WorkspaceDraftSaved",
        entityType: "workspace",
        entityId: shared.id,
        metadata: { storeKeys: changed },
      });
    return {
      sharedVersion: shared.version,
      privateVersion: privateRow.version,
    };
  });
}
