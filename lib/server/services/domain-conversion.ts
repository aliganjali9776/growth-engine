import "server-only";
import { isDeepStrictEqual } from "node:util";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/types";
import { domainStoreHeaders, organizations } from "../db/schema";
import { DataError } from "../db/errors";
import { moduleForStore } from "../../persistence/business-export";
import { localStoreKeys } from "../../persistence/export";
import { SystemDomainRepository, StrategyDomainRepository, ScaleDomainRepository, AgentDomainRepository, AssessmentDomainRepository } from "../repositories/domain-state";

export function domainRepository(db: Database, key: string) {
  switch (moduleForStore(key)) {
    case "system": return new SystemDomainRepository(db);
    case "strategy": return new StrategyDomainRepository(db);
    case "scale": return new ScaleDomainRepository(db);
    case "agent": return new AgentDomainRepository(db);
    case "assessment": return new AssessmentDomainRepository(db);
  }
}
export const equalStoreData = (a: string | null, b: string | null) =>
  isDeepStrictEqual(a === null ? null : JSON.parse(a), b === null ? null : JSON.parse(b));

/** Internal conversion only. The caller must supply an organization-locked
 * transaction and database-owned source data. Never accepts browser input.
 * Existing canonical stores are left untouched; legacy source is never edited.
 * Every newly converted store is read back and compared before commit.
 */
export async function convertArchivedStores(tx: Database, organizationId: string, ownerKey: string, stores: Record<string, string | null>) {
  await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, organizationId)).for("update");
  const headers = await tx.select().from(domainStoreHeaders).where(and(eq(domainStoreHeaders.organizationId, organizationId), eq(domainStoreHeaders.ownerKey, ownerKey)));
  const existing = new Set(headers.map(row => row.storeKey));
  let converted = 0;
  for (const key of localStoreKeys) {
    if (!(key in stores) || existing.has(key)) continue;
    const repo = domainRepository(tx, key);
    await repo.save(organizationId, ownerKey, key, stores[key], { actorType: "LegacyLocal", userId: null });
    const actual = (await repo.read(organizationId, ownerKey))[key] ?? null;
    if (!equalStoreData(stores[key], actual)) throw new DataError("Conflict", 409);
    converted++;
  }
  return { converted };
}
