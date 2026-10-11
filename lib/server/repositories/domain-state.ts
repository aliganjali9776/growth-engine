import "server-only";
import { and, eq, asc } from "drizzle-orm";
import type { Database } from "../db/types";
import * as S from "../db/schema";
import { requireScope } from "../context";
import { DataError } from "../db/errors";
import { localStoreKeys } from "../../persistence/export";
import { storeModule, splitDomainStore, joinDomainStore } from "../../persistence/domain-records";
import type { BusinessModule } from "../../persistence/business-export";
type RecordTable = typeof S.systemDomainRecords | typeof S.strategyDomainRecords | typeof S.scaleDomainRecords | typeof S.agentDomainRecords | typeof S.assessmentDomainRecords;
type Provenance = { actorType: "User" | "LegacyLocal"; userId: string | null };
// This internal adapter only handles physical rows. Each public repository has
// a fixed domain boundary; authorization and business calculations live in services.
async function readRows(db: Database, table: RecordTable, organizationId: string, ownerKey: string, module: BusinessModule) {
  requireScope(organizationId);
  const headers = await db.select().from(S.domainStoreHeaders).where(and(eq(S.domainStoreHeaders.organizationId, organizationId), eq(S.domainStoreHeaders.ownerKey, ownerKey)));
  const rows = await db.select().from(table).where(and(eq(table.organizationId, organizationId), eq(table.ownerKey, ownerKey))).orderBy(asc(table.position));
  const stores: Record<string, string | null> = {};
  for (const header of headers.filter(row => storeModule(row.storeKey) === module)) stores[header.storeKey] = joinDomainStore(header.storeKey, { metadata: header.metadata, records: rows.filter(row => row.storeKey === header.storeKey) });
  return stores;
}
async function saveRows(db: Database, table: RecordTable, organizationId: string, ownerKey: string, module: BusinessModule, storeKey: string, raw: string | null, provenance: Provenance) {
  requireScope(organizationId);
  if (!localStoreKeys.includes(storeKey as typeof localStoreKeys[number]) || storeModule(storeKey) !== module) throw new DataError("InvalidInput");
  const data = splitDomainStore(storeKey, raw), where = and(eq(table.organizationId, organizationId), eq(table.ownerKey, ownerKey), eq(table.storeKey, storeKey));
  const old = await db.select().from(table).where(where).for("update");
  const byKey = new Map(old.map(row => [`${row.collection}:${row.entityKey}`, row]));
  for (const record of data.records) {
    const key = `${record.collection}:${record.entityKey}`, previous = byKey.get(key); byKey.delete(key);
    const unchanged = previous && JSON.stringify(previous.payload) === JSON.stringify(record.payload) && previous.position === record.position;
    if (unchanged) continue;
    if (previous) await db.update(table).set({ ...record, version: previous.version + 1, updatedByUserId: provenance.userId, updatedAt: new Date() }).where(and(where, eq(table.id, previous.id), eq(table.version, previous.version)));
    else await db.insert(table).values({ ...record, organizationId, ownerKey, storeKey, actorType: provenance.actorType, createdByUserId: provenance.userId, updatedByUserId: provenance.userId });
  }
  for (const previous of byKey.values()) await db.delete(table).where(and(where, eq(table.id, previous.id)));
  const [header] = await db.select().from(S.domainStoreHeaders).where(and(eq(S.domainStoreHeaders.organizationId, organizationId), eq(S.domainStoreHeaders.ownerKey, ownerKey), eq(S.domainStoreHeaders.storeKey, storeKey))).for("update");
  if (header) await db.update(S.domainStoreHeaders).set({ metadata: data.metadata, version: header.version + 1, updatedAt: new Date() }).where(and(eq(S.domainStoreHeaders.organizationId, organizationId), eq(S.domainStoreHeaders.id, header.id)));
  else await db.insert(S.domainStoreHeaders).values({ organizationId, ownerKey, storeKey, metadata: data.metadata });
}
export class SystemDomainRepository {
  constructor(private db: Database) {}
  read(organizationId: string, ownerKey = "shared") { return readRows(this.db, S.systemDomainRecords, organizationId, ownerKey, "system"); }
  save(organizationId: string, ownerKey: string, key: string, raw: string | null, provenance: Provenance) { return saveRows(this.db, S.systemDomainRecords, organizationId, ownerKey, "system", key, raw, provenance); }
}
export class StrategyDomainRepository {
  constructor(private db: Database) {}
  read(organizationId: string, ownerKey = "shared") { return readRows(this.db, S.strategyDomainRecords, organizationId, ownerKey, "strategy"); }
  save(organizationId: string, ownerKey: string, key: string, raw: string | null, provenance: Provenance) { return saveRows(this.db, S.strategyDomainRecords, organizationId, ownerKey, "strategy", key, raw, provenance); }
}
export class ScaleDomainRepository {
  constructor(private db: Database) {}
  read(organizationId: string, ownerKey = "shared") { return readRows(this.db, S.scaleDomainRecords, organizationId, ownerKey, "scale"); }
  save(organizationId: string, ownerKey: string, key: string, raw: string | null, provenance: Provenance) { return saveRows(this.db, S.scaleDomainRecords, organizationId, ownerKey, "scale", key, raw, provenance); }
}
export class AgentDomainRepository {
  constructor(private db: Database) {}
  read(organizationId: string, ownerKey = "shared") { return readRows(this.db, S.agentDomainRecords, organizationId, ownerKey, "agent"); }
  save(organizationId: string, ownerKey: string, key: string, raw: string | null, provenance: Provenance) { return saveRows(this.db, S.agentDomainRecords, organizationId, ownerKey, "agent", key, raw, provenance); }
}
export class AssessmentDomainRepository {
  constructor(private db: Database) {}
  read(organizationId: string, ownerKey = "shared") { return readRows(this.db, S.assessmentDomainRecords, organizationId, ownerKey, "assessment"); }
  save(organizationId: string, ownerKey: string, key: string, raw: string | null, provenance: Provenance) { return saveRows(this.db, S.assessmentDomainRecords, organizationId, ownerKey, "assessment", key, raw, provenance); }
}
