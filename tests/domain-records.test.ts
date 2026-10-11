import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import * as S from "../lib/server/db/schema";
import { createOrganizationWithOwner } from "../lib/server/services/organization";
import { seedDevelopment } from "../lib/server/dev/seed";
import { splitDomainStore, joinDomainStore } from "../lib/persistence/domain-records";
import { localStoreKeys } from "../lib/persistence/export";
import { createSystemSeed } from "../lib/system/seed";
import { seedStrategy } from "../lib/strategy/seed";
import { seedScale } from "../lib/scale/seed";
import { newAdvisorSession } from "../lib/advisor-storage";
import { SystemDomainRepository, StrategyDomainRepository, AgentDomainRepository } from "../lib/server/repositories/domain-state";
import { convertArchivedStores } from "../lib/server/services/domain-conversion";
import { SystemDomainService } from "../lib/server/services/domain-state";
import { resolveOrganizationContext } from "../lib/server/context";
import { readTenantWorkspace, writeTenantWorkspace } from "../lib/server/services/workspace";
import { calculatePriority } from "../lib/system/scoring";
import { calculateKRProgress } from "../lib/strategy/kr/calculations";
import { calculateConversion } from "../lib/scale/funnel/logic";
import { capacityUtilization } from "../lib/scale/readiness/logic";

// Codec tests deliberately include opaque historical fields. They prove storage
// preservation, not business validity; service validation has separate tests.
const historical = { id: "history-1", recordedAt: "2025-01-01T00:00:00Z", snapshot: { target: 42, score: 17, notes: "سوابق تاریخی" } };
const samples: Record<string, unknown> = {
  "growth-engine.assessment.v2": { version: 2, profile: null, answers: { q1: 0, q2: false, q3: "پاسخ" }, screen: "results" },
  "growth-engine.system.v1": createSystemSeed(),
  "growth-engine.process-maps.v1": { version: 1, maps: [{ processId: "p6", variant: "as-is", nodes: [historical] }, { processId: "p6", variant: "to-be", nodes: [] }] },
  "growth-engine.process-analysis.v1": { version: 1, records: [{ processId: "p6", reviews: [historical] }] },
  "growth-engine.process-standards.v1": { version: 1, records: [{ processId: "p6", sop: historical, plan: { training: [historical] } }] },
  "growth-engine.process-measurement.v1": { version: 1, records: [{ processId: "p6", kpis: [historical], entries: [historical], improvements: [historical], reviews: [historical] }] },
  "growth-engine.system-health-history.v1": { version: 1, snapshots: [historical] },
  "growth-engine.strategy.v1": seedStrategy(createSystemSeed().roles),
  "growth-engine.scale.v1": { version: 1, profile: null, constraints: [historical], experimentData: { experiments: [historical], measurements: [historical] }, readinessData: { snapshots: [historical], scenarios: [historical] } },
  "growth-engine.agent.v1": { version: 1, evidence: [historical], approvals: [historical], audit: [historical] },
  "growth-engine.advisor.v1": { version: 1, session: { id: "s1", messages: [{ id: "m1", text: "پاسخ" }, { id: "m2", text: "Second", snapshot: historical }] } },
  "growth-engine.agent.diagnosis.v1": { version: 1, diagnoses: [historical], runs: [historical], history: [historical] },
  "growth-engine.agent.preparation.v1": { version: 1, actions: [historical], revisions: [historical], approvals: [historical], audit: [historical] },
  "growth-engine.agent.execution.v1": { version: 1, records: [historical], rollbacks: [historical], audit: [historical] },
  "growth-engine.agent.workspace.v1": { version: 1, sessions: [{ id: "s1", messages: [{ id: "m1", text: "First" }, { id: "m2", text: "Second" }] }, { id: "s2", messages: [{ id: "m1", text: "Different session" }] }] },
};
for (const key of localStoreKeys) {
  test(`canonical codec retains all fields and ordering: ${key}`, () => {
    const original = JSON.stringify(samples[key]);
    const split = splitDomainStore(key, original);
    assert.deepEqual(JSON.parse(joinDomainStore(key, split)!), JSON.parse(original));
    assert.equal(original, JSON.stringify(samples[key]), "source remains unchanged");
    assert.deepEqual(JSON.parse(joinDomainStore(key, split)!), JSON.parse(original), "repeated reads do not mutate records");
  });
}
test("null stores stay null", () => {
  for (const key of localStoreKeys) assert.equal(joinDomainStore(key, splitDomainStore(key, null)), null);
});
test("duplicate entity identities fail rather than overwrite a history", () => {
  assert.throws(() => splitDomainStore("growth-engine.agent.execution.v1", JSON.stringify({ records: [historical, historical] })), /DuplicateCanonicalRecord/);
});
test("messages become separate rows scoped to their session", () => {
  const split = splitDomainStore("growth-engine.agent.workspace.v1", JSON.stringify(samples["growth-engine.agent.workspace.v1"]));
  assert.equal(split.records.filter(row => row.collection === "messages").length, 3);
  assert.equal(new Set(split.records.map(row => row.collection + ":" + row.entityKey)).size, 5);
});

const pg = new PGlite(), db = drizzle(pg, { schema: S });
let orgA: string, orgB: string, actorUserId: string;
before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  const seed = await seedDevelopment(db);
  actorUserId = seed.actorUserId;
  orgA = (await createOrganizationWithOwner(db, seed.actorUserId, { name: "Isolated codec A", slug: "codec-a-" + randomUUID() })).organization.id;
  orgB = (await createOrganizationWithOwner(db, seed.actorUserId, { name: "Isolated codec B", slug: "codec-b-" + randomUUID() })).organization.id;
});
after(async () => { await pg.close(); });
test("conversion verifies all 15 stores, preserves its source and is idempotent", async () => {
  const owner = "conversion-proof", stores = Object.fromEntries(localStoreKeys.map(key => [key, JSON.stringify(samples[key])]));
  const source = JSON.stringify(stores);
  assert.equal((await db.transaction(tx => convertArchivedStores(tx, orgB, owner, stores))).converted, 15);
  assert.equal(JSON.stringify(stores), source);
  assert.equal((await db.transaction(tx => convertArchivedStores(tx, orgB, owner, stores))).converted, 0);
});
test("invalid duplicate in later store rolls back all earlier conversions", async () => {
  const owner = "rollback-conversion", stores = Object.fromEntries(localStoreKeys.map(key => [key, JSON.stringify(samples[key])]));
  stores["growth-engine.agent.execution.v1"] = JSON.stringify({ records: [historical, historical] });
  await assert.rejects(db.transaction(tx => convertArchivedStores(tx, orgB, owner, stores)), /DuplicateCanonicalRecord/);
  assert.equal((await db.select().from(S.domainStoreHeaders).where(eq(S.domainStoreHeaders.ownerKey, owner))).length, 0);
  assert.deepEqual(await new SystemDomainRepository(db).read(orgB, owner), {});
});
test("isolated PostgreSQL entity rows preserve System IDs and all fields", async () => {
  const key = "growth-engine.system.v1", raw = JSON.stringify(samples[key]);
  await db.transaction(tx => new SystemDomainRepository(tx).save(orgA, "shared", key, raw, { actorType: "LegacyLocal", userId: null }));
  assert.deepEqual(JSON.parse((await new SystemDomainRepository(db).read(orgA))[key]!), JSON.parse(raw));
  const rows = await db.select().from(S.systemDomainRecords).where(eq(S.systemDomainRecords.organizationId, orgA));
  assert.equal(rows.filter(row => row.collection === "processes").length, createSystemSeed().processes.length);
  assert.ok(rows.every(row => row.actorType === "LegacyLocal" && row.createdByUserId === null && row.version === 1));
  assert.deepEqual(await new SystemDomainRepository(db).read(orgB), {});
});
test("rollback leaves no Strategy rows or header after injected failure", async () => {
  await assert.rejects(db.transaction(async tx => {
    await new StrategyDomainRepository(tx).save(orgB, "shared", "growth-engine.strategy.v1", JSON.stringify(samples["growth-engine.strategy.v1"]), { actorType: "LegacyLocal", userId: null });
    throw Error("InjectedImportFailure");
  }), /InjectedImportFailure/);
  assert.deepEqual(await new StrategyDomainRepository(db).read(orgB), {});
  assert.equal((await db.select().from(S.strategyDomainRecords).where(and(eq(S.strategyDomainRecords.organizationId, orgB), eq(S.strategyDomainRecords.ownerKey, "shared")))).length, 0);
});
test("historical messages retain order and are isolated by owner", async () => {
  const repo = new AgentDomainRepository(db), key = "growth-engine.agent.workspace.v1";
  await db.transaction(tx => new AgentDomainRepository(tx).save(orgA, "private-test-owner", key, JSON.stringify(samples[key]), { actorType: "LegacyLocal", userId: null }));
  assert.deepEqual(JSON.parse((await repo.read(orgA, "private-test-owner"))[key]!), samples[key]);
  assert.deepEqual(await repo.read(orgA, "other-owner"), {});
  assert.deepEqual(await repo.read(orgB, "private-test-owner"), {});
});
test("domain service rejects broken role references without changing persisted data", async () => {
  const ctx = await resolveOrganizationContext(db, actorUserId, orgA);
  const service = new SystemDomainService(db), key = "growth-engine.system.v1";
  const before = (await service.read(ctx))[key]!;
  const next = JSON.parse(before); next.processes[0].ownerRoleId = "missing-role";
  await assert.rejects(service.save(ctx, key, before, JSON.stringify(next)), /InvalidInput/);
  assert.deepEqual(JSON.parse((await service.read(ctx))[key]!), JSON.parse(before));
});
test("two readers cannot overwrite a newer domain version", async () => {
  const ctx = await resolveOrganizationContext(db, actorUserId, orgA);
  const first = new SystemDomainService(db), second = new SystemDomainService(db), key = "growth-engine.system.v1";
  const before = (await first.read(ctx))[key]!;
  const next = JSON.parse(before); next.processes[0].name += " updated";
  await first.save(ctx, key, before, JSON.stringify(next));
  await assert.rejects(second.save(ctx, key, before, before), /Conflict/);
  assert.deepEqual(JSON.parse((await second.read(ctx))[key]!), next);
  const [row] = (await db.select().from(S.systemDomainRecords).where(eq(S.systemDomainRecords.organizationId, orgA))).filter(row => row.collection === "processes" && row.entityKey === next.processes[0].id);
  assert.equal(row.version, 2);
  assert.equal(row.updatedByUserId, actorUserId);
});
test("a service cannot read another user's private scope", async () => {
  const ctx = await resolveOrganizationContext(db, actorUserId, orgA);
  await assert.rejects(new SystemDomainService(db).read(ctx, "other-owner"), /Forbidden/);
});
test("active Assessment/System path preserves its recovery archive and persists only entity rows", async () => {
  const ctx = await resolveOrganizationContext(db, actorUserId, orgB);
  const first = await readTenantWorkspace(db, ctx);
  const [archive] = await db.select().from(S.tenantWorkspaces).where(and(eq(S.tenantWorkspaces.organizationId, orgB), eq(S.tenantWorkspaces.ownerKey, "shared")));
  const stores = { ...first.stores, "growth-engine.system.v1": JSON.stringify(createSystemSeed()) };
  await writeTenantWorkspace(db, ctx, { organizationId: orgB, sharedVersion: first.sharedVersion, privateVersion: first.privateVersion, stores });
  const second = await readTenantWorkspace(db, ctx);
  assert.deepEqual(JSON.parse(second.stores["growth-engine.system.v1"]!), JSON.parse(stores["growth-engine.system.v1"]));
  const [preserved] = await db.select().from(S.tenantWorkspaces).where(eq(S.tenantWorkspaces.id, archive.id));
  assert.equal(preserved.stores["growth-engine.system.v1"], archive.stores["growth-engine.system.v1"]);
  assert.equal(second.sharedVersion, first.sharedVersion + 1);
  await assert.rejects(writeTenantWorkspace(db, ctx, { organizationId: orgB, sharedVersion: first.sharedVersion, privateVersion: first.privateVersion, stores }), /Conflict/);
});
test("active Strategy path preserves cycle and objective IDs without overwriting the archive", async () => {
  const ctx = await resolveOrganizationContext(db, actorUserId, orgB), first = await readTenantWorkspace(db, ctx);
  const [archive] = await db.select().from(S.tenantWorkspaces).where(and(eq(S.tenantWorkspaces.organizationId, orgB), eq(S.tenantWorkspaces.ownerKey, "shared")));
  const key = "growth-engine.strategy.v1", data = seedStrategy(createSystemSeed().roles);
  await writeTenantWorkspace(db, ctx, { ...first, stores: { ...first.stores, [key]: JSON.stringify(data) } });
  const second = await readTenantWorkspace(db, ctx);
  assert.deepEqual(JSON.parse(second.stores[key]!), JSON.parse(JSON.stringify(data)));
  const [preserved] = await db.select().from(S.tenantWorkspaces).where(eq(S.tenantWorkspaces.id, archive.id));
  assert.equal(preserved.stores[key], archive.stores[key]);
  assert.deepEqual((await new StrategyDomainRepository(db).read(orgA))[key] ?? null, null);
});
test("active Scale path round-trips canonical state and keeps its server archive", async () => {
  const ctx = await resolveOrganizationContext(db, actorUserId, orgB), first = await readTenantWorkspace(db, ctx);
  const [archive] = await db.select().from(S.tenantWorkspaces).where(and(eq(S.tenantWorkspaces.organizationId, orgB), eq(S.tenantWorkspaces.ownerKey, "shared")));
  const key = "growth-engine.scale.v1", data = seedScale("2026-01-01T00:00:00.000Z", createSystemSeed().roles[0].id);
  await writeTenantWorkspace(db, ctx, { ...first, stores: { ...first.stores, [key]: JSON.stringify(data) } });
  assert.deepEqual(JSON.parse((await readTenantWorkspace(db, ctx)).stores[key]!), JSON.parse(JSON.stringify(data)));
  const [preserved] = await db.select().from(S.tenantWorkspaces).where(eq(S.tenantWorkspaces.id, archive.id));
  assert.equal(preserved.stores[key], archive.stores[key]);
});
test("Agent artifact persistence preserves a session and keeps business execution disabled", async () => {
  const ctx = await resolveOrganizationContext(db, actorUserId, orgB), first = await readTenantWorkspace(db, ctx);
  const key = "growth-engine.advisor.v1", session = newAdvisorSession(), raw = JSON.stringify({ version: 1, session });
  await writeTenantWorkspace(db, ctx, { ...first, stores: { ...first.stores, [key]: raw } });
  const second = await readTenantWorkspace(db, ctx);
  assert.deepEqual(JSON.parse(second.stores[key]!), JSON.parse(raw));
  const [archive] = await db.select().from(S.tenantWorkspaces).where(and(eq(S.tenantWorkspaces.organizationId, orgB), eq(S.tenantWorkspaces.ownerKey, actorUserId)));
  assert.equal(archive.stores[key], null);
  assert.equal((await new AgentDomainRepository(db).read(orgB, "other-user"))[key] ?? null, null);
  await assert.rejects(writeTenantWorkspace(db, ctx, { ...second, stores: { ...second.stores, "growth-engine.agent.execution.v1": JSON.stringify({ version: 1, records: [], rollbacks: [], audit: [] }) } }), /Disabled/);
});

test("Beta two distinct users share persisted state while Viewer cannot mutate or cross tenants", async () => {
  const [user] = await db.insert(S.users).values({ email: "beta-viewer@isolated.example.invalid", name: "Disposable Beta Viewer", status: "Active" }).returning();
  const [membership] = await db.insert(S.memberships).values({ organizationId: orgB, userId: user.id, status: "Active" }).returning();
  const [role] = await db.select().from(S.accessRoles).where(and(eq(S.accessRoles.organizationId, orgB), eq(S.accessRoles.name, "Viewer")));
  await db.insert(S.membershipRoles).values({ organizationId: orgB, membershipId: membership.id, roleId: role.id });
  const owner = await resolveOrganizationContext(db, actorUserId, orgB);
  const viewer = await resolveOrganizationContext(db, user.id, orgB);
  const ownerState = await readTenantWorkspace(db, owner), viewerState = await readTenantWorkspace(db, viewer);
  for (const key of ["growth-engine.system.v1", "growth-engine.strategy.v1", "growth-engine.scale.v1"]) assert.equal(viewerState.stores[key], ownerState.stores[key]);
  assert.equal(viewerState.stores["growth-engine.advisor.v1"], null, "personal Agent session is not shared");
  const key = "growth-engine.system.v1", changed = JSON.parse(ownerState.stores[key]!);
  changed.processes[0].name += " forbidden Viewer edit";
  await assert.rejects(writeTenantWorkspace(db, viewer, { ...viewerState, stores: { ...viewerState.stores, [key]: JSON.stringify(changed) } }), /Forbidden/);
  assert.equal((await readTenantWorkspace(db, owner)).stores[key], ownerState.stores[key]);
  await assert.rejects(resolveOrganizationContext(db, user.id, orgA), /Forbidden/);
});

test("Beta critical System, four KR types and Scale numeric formulas survive server round trips", async () => {
  const system = createSystemSeed(), strategy = seedStrategy(system.roles);
  const base = { id: "beta-kr", cycleId: strategy.cycles[0].id, objectiveId: strategy.objectives[0].id, startValue: 0, targetValue: 100, currentValue: 25, milestones: [] };
  const keyResults = [
    { ...base, id: "beta-increase", type: "increase" },
    { ...base, id: "beta-decrease", type: "decrease", startValue: 100, targetValue: 0, currentValue: 75 },
    { ...base, id: "beta-binary", type: "binary", targetValue: 1, currentValue: 1 },
    { ...base, id: "beta-milestone", type: "milestone", milestones: [{ id: "m1", title: "Synthetic first", weight: 25, completed: true }, { id: "m2", title: "Synthetic second", weight: 75, completed: false }] },
  ];
  const data = { ...strategy, keyResults }, owner = "beta-formula-fixture";
  await db.transaction(tx => new StrategyDomainRepository(tx).save(orgB, owner, "growth-engine.strategy.v1", JSON.stringify(data), { actorType: "LegacyLocal", userId: null }));
  const restored = JSON.parse((await new StrategyDomainRepository(db).read(orgB, owner))["growth-engine.strategy.v1"]!);
  assert.deepEqual(restored.keyResults.map(calculateKRProgress), [25,25,100,25]);
  assert.deepEqual(restored.keyResults.map(calculateKRProgress), keyResults.map(k => calculateKRProgress(k as any)));
  const systemAfter = JSON.parse(joinDomainStore("growth-engine.system.v1", splitDomainStore("growth-engine.system.v1", JSON.stringify(system)))!);
  assert.deepEqual(systemAfter.processes.map(calculatePriority), system.processes.map(calculatePriority));
  const scale = { ...seedScale("2026-01-01T00:00:00.000Z", system.roles[0].id), betaInputs: { current: 0, previous: 10, load: 60, capacity: 80 } };
  const scaleAfter = JSON.parse(joinDomainStore("growth-engine.scale.v1", splitDomainStore("growth-engine.scale.v1", JSON.stringify(scale)))!).betaInputs;
  assert.equal(calculateConversion(scaleAfter.current, scaleAfter.previous), 0);
  assert.equal(capacityUtilization(scaleAfter.load, scaleAfter.capacity), 75);
  assert.equal(calculateConversion(null, 0), null);
  assert.equal(capacityUtilization(0, 0), null);
});
