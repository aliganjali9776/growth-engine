import "server-only";
import type { Database } from "../db/types";
import { reauthorize, type OrganizationContext } from "../context";
import { DataError } from "../db/errors";
import { authorizeWorkspaceChange, workspaceViewPermission } from "./workspace-permissions";
import { SystemDomainRepository, StrategyDomainRepository, ScaleDomainRepository, AgentDomainRepository, AssessmentDomainRepository } from "../repositories/domain-state";
import { moduleForStore, businessExportFromLocal, inspectBusinessExport } from "../../persistence/business-export";
import { localStoreKeys, validateLocalExport } from "../../persistence/export";
import { and, eq, or } from "drizzle-orm";
import { organizations, auditEvents, tenantWorkspaces } from "../db/schema";
import { equalStoreData } from "./domain-conversion";
import { assertStrategyTransition } from "../../strategy/adapt/mutations";
import { assertExperimentTransition } from "../../scale/experiments/validation";
import { assertFunnelTransition } from "../../scale/funnel/validation";
import { assertNetworkTransition } from "../../scale/network/validation";
import { assertReadinessTransition } from "../../scale/readiness/validation";
import { captureAssessmentLead } from "./platform-admin";
type Repository = SystemDomainRepository | StrategyDomainRepository | ScaleDomainRepository | AgentDomainRepository | AssessmentDomainRepository;
async function read(repo: Repository, db: Database, context: OrganizationContext, key: string, ownerKey: string) {
  if (ownerKey !== "shared" && ownerKey !== context.userId) throw new DataError("Forbidden", 403);
  await reauthorize(db, context, workspaceViewPermission(key));
  return repo.read(context.organizationId, ownerKey);
}
async function write(factory: (db: Database) => Repository, db: Database, context: OrganizationContext, key: string, before: string | null, after: string | null, ownerKey: string) {
  if (ownerKey !== "shared" && ownerKey !== context.userId) throw new DataError("Forbidden", 403);
  validateCanonicalStores({ [key]: after }, false);
  return db.transaction(async tx => {
    await reauthorize(tx, context, workspaceViewPermission(key));
    // The org lock serializes store creation and read/compare/write, including
    // two users creating the same external ID before a row exists to lock.
    await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, context.organizationId)).for("update");
    // Recheck after waiting for the same lock used by entitlement changes.
    const fresh = await reauthorize(tx, context, workspaceViewPermission(key));
    const repo = factory(tx), current = (await repo.read(fresh.organizationId, ownerKey))[key] ?? null;
    if (!equalStoreData(current, before)) throw new DataError("Conflict", 409);
    authorizeWorkspaceChange(fresh, key, current, after);
    // Validate against actual scoped parents rather than trusting references
    // supplied by the browser or examining an isolated store alone.
    const repositories = [new SystemDomainRepository(tx), new StrategyDomainRepository(tx), new ScaleDomainRepository(tx), new AgentDomainRepository(tx), new AssessmentDomainRepository(tx)];
    const shared = Object.assign({}, ...await Promise.all(repositories.map(repo => repo.read(fresh.organizationId, "shared"))));
    const personal = ownerKey === "shared" ? {} : Object.assign({}, ...await Promise.all(repositories.map(repo => repo.read(fresh.organizationId, ownerKey))));
    // During staged rollout, inactive domains still use their existing server
    // documents. Include these database-owned parents in cross-domain checks.
    // This never reads or falls back to browser storage.
    const archived = await tx.select().from(tenantWorkspaces).where(and(eq(tenantWorkspaces.organizationId, fresh.organizationId), or(eq(tenantWorkspaces.ownerKey, "shared"), eq(tenantWorkspaces.ownerKey, ownerKey))));
    const archivedShared = archived.find(row => row.ownerKey === "shared")?.stores ?? {};
    const archivedPersonal = ownerKey === "shared" ? {} : archived.find(row => row.ownerKey === ownerKey)?.stores ?? {};
    const combined = { ...archivedShared, ...archivedPersonal, ...shared, ...personal, [key]: after };
    validateCanonicalStores(combined);
    if (current !== null && after !== null) {
      try {
        const previous = JSON.parse(current), next = JSON.parse(after);
        if (key === "growth-engine.strategy.v1") assertStrategyTransition(previous, next);
        if (key === "growth-engine.scale.v1") {
          assertExperimentTransition(previous, next);
          assertFunnelTransition(previous, next);
          assertNetworkTransition(previous, next);
          assertReadinessTransition(previous, next);
        }
      } catch { throw new DataError("InvalidInput"); }
    }
    await repo.save(fresh.organizationId, ownerKey, key, after, { actorType: "User", userId: fresh.userId });
    if (key === localStoreKeys[0]) await captureAssessmentLead(tx, fresh, after);
    await tx.insert(auditEvents).values({ organizationId: fresh.organizationId, actorUserId: fresh.userId, actorType: "User", module: moduleForStore(key), action: "DomainStateChanged", entityType: "DomainStore", metadata: { storeKey: key, ownerScope: ownerKey === "shared" ? "Company" : "Personal" } });
  });
}
export class SystemDomainService {
  constructor(private db: Database) {}
  read(context: OrganizationContext, ownerKey = "shared") { return read(new SystemDomainRepository(this.db), this.db, context, "growth-engine.system.v1", ownerKey); }
  save(context: OrganizationContext, key: string, before: string | null, after: string | null, ownerKey = "shared") { return write(db => new SystemDomainRepository(db), this.db, context, key, before, after, ownerKey); }
}
export class StrategyDomainService {
  constructor(private db: Database) {}
  read(context: OrganizationContext, ownerKey = "shared") { return read(new StrategyDomainRepository(this.db), this.db, context, "growth-engine.strategy.v1", ownerKey); }
  save(context: OrganizationContext, key: string, before: string | null, after: string | null, ownerKey = "shared") { return write(db => new StrategyDomainRepository(db), this.db, context, key, before, after, ownerKey); }
}
export class ScaleDomainService {
  constructor(private db: Database) {}
  read(context: OrganizationContext, ownerKey = "shared") { return read(new ScaleDomainRepository(this.db), this.db, context, "growth-engine.scale.v1", ownerKey); }
  save(context: OrganizationContext, key: string, before: string | null, after: string | null, ownerKey = "shared") { return write(db => new ScaleDomainRepository(db), this.db, context, key, before, after, ownerKey); }
}
export class AgentDomainService {
  constructor(private db: Database) {}
  read(context: OrganizationContext, ownerKey = "shared") { return read(new AgentDomainRepository(this.db), this.db, context, "growth-engine.advisor.v1", ownerKey); }
  save(context: OrganizationContext, key: string, before: string | null, after: string | null, ownerKey: string) { return write(db => new AgentDomainRepository(db), this.db, context, key, before, after, ownerKey); }
}
export class AssessmentDomainService {
  constructor(private db: Database) {}
  read(context: OrganizationContext, ownerKey = "shared") { return read(new AssessmentDomainRepository(this.db), this.db, context, localStoreKeys[0], ownerKey); }
  save(context: OrganizationContext, key: string, before: string | null, after: string | null, ownerKey = "shared") { return write(db => new AssessmentDomainRepository(db), this.db, context, key, before, after, ownerKey); }
}
export function domainService(db: Database, key: string) {
  switch (moduleForStore(key)) {
    case "assessment": return new AssessmentDomainService(db);
    case "system": return new SystemDomainService(db);
    case "strategy": return new StrategyDomainService(db);
    case "scale": return new ScaleDomainService(db);
    case "agent": return new AgentDomainService(db);
  }
}
export function validateCanonicalStores(stores: Record<string, string | null>, checkReferences = true) {
  try {
    const complete = Object.fromEntries(localStoreKeys.map(key => [key, stores[key] ?? null]));
    const local = validateLocalExport({ schemaVersion: 1, source: "browser-local-v1", localWorkspaceId: "server-domain-state", exportedAt: new Date().toISOString(), moduleVersions: Object.fromEntries(localStoreKeys.map(key => [key, complete[key] === null ? null : JSON.parse(complete[key]!).version ?? null])), stores: complete });
    if (checkReferences && inspectBusinessExport(businessExportFromLocal(local)).errors.length) throw Error("BrokenCanonicalReference");
    return local.stores;
  } catch { throw new DataError("InvalidInput"); }
}
