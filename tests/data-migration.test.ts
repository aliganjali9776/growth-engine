import assert from "node:assert/strict";
import { test, before, after } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import * as S from "../lib/server/db/schema";
import { createOrganizationWithOwner } from "./full-access-fixture";
import { resolveOrganizationContext } from "../lib/server/context";
import { seedDevelopment } from "../lib/server/dev/seed";
import {
  previewDataMigration,
  listDataMigrations,
  migrationChecksum,
  executeDataMigration,
} from "../lib/server/services/data-migration";
import { domainRepository } from "../lib/server/services/domain-conversion";
import { exportOrganization } from "../lib/server/services/migration";
import {
  exportLocalBusiness,
  inspectBusinessExport,
  validateBusinessExport,
  localEnvelope,
  assertBusinessBackupHasNoSecrets,
} from "../lib/persistence/business-export";
import { createSystemSeed } from "../lib/system/seed";
import { seedStrategy } from "../lib/strategy/seed";
import { exportLocalWorkspace } from "../lib/persistence/export";
const pg = new PGlite(),
  db = drizzle(pg, { schema: S });
let seed: Awaited<ReturnType<typeof seedDevelopment>>;
test("Beta export rejects nested API keys and environment secrets without stripping data", () => {
  for (const field of ["password", "passwordHash", "accessToken", "invitationToken", "apiKey", "api_key", "apiSecret", "DATABASE_URL", "BETTER_AUTH_SECRET", "environmentSecrets"]) {
    const value = { tables: { agent_domain_records: [{ payload: { history: [{ [field]: "synthetic-secret" }] } }] } };
    assert.throws(() => assertBusinessBackupHasNoSecrets(value), /ForbiddenBusinessExportField/);
    assert.equal(Object.keys(value.tables.agent_domain_records[0].payload.history[0])[0], field);
  }
});
before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  seed = await seedDevelopment(db);
});
after(async () => {
  await pg.close();
});
function fixture() {
  const system = createSystemSeed(),
    strategy = seedStrategy(system.roles);
  const stores = {
    "growth-engine.system.v1": JSON.stringify(system),
    "growth-engine.strategy.v1": JSON.stringify(strategy),
  } as Record<string, string>;
  return exportLocalBusiness(
    { getItem: (k) => stores[k] ?? null },
    "7d-golden-foundation",
  );
}
async function company() {
  const made = await createOrganizationWithOwner(db, seed.actorUserId, {
    name: "Migration test",
    slug: "migration-" + randomUUID(),
  });
  return resolveOrganizationContext(db, seed.actorUserId, made.organization.id);
}
test("7D atomic import round-trips all supplied stores and blocks repeat import", async () => {
  const ctx = await company(), pack = fixture();
  const preview = await previewDataMigration(db, ctx, { organizationId: ctx.organizationId, package: pack });
  const result = await executeDataMigration(db, ctx, { organizationId: ctx.organizationId, migrationId: preview.migrationId, checksum: preview.checksum, package: pack });
  assert.equal(result.status, "Succeeded");
  for (const [key, raw] of Object.entries(localEnvelope(pack).stores)) {
    const owner = key.startsWith("growth-engine.agent") && key !== "growth-engine.agent.diagnosis.v1" || key === "growth-engine.advisor.v1" ? ctx.userId : "shared";
    const actual = (await domainRepository(db, key).read(ctx.organizationId, owner))[key] ?? null;
    assert.deepEqual(actual === null ? null : JSON.parse(actual), raw === null ? null : JSON.parse(raw));
  }
  await assert.rejects(executeDataMigration(db, ctx, { organizationId: ctx.organizationId, migrationId: preview.migrationId, checksum: preview.checksum, package: pack }), /Conflict/);
  const again = await previewDataMigration(db, ctx, { organizationId: ctx.organizationId, package: pack });
  assert.equal(again.eligible, false);
});
test("7D injected late import failure rolls back all business rows and retains Failed audit", async () => {
  const ctx = await company(), pack = fixture();
  const preview = await previewDataMigration(db, ctx, { organizationId: ctx.organizationId, package: pack });
  const result = await executeDataMigration(db, ctx, { organizationId: ctx.organizationId, migrationId: preview.migrationId, checksum: preview.checksum, package: pack }, index => { if (index === 12) throw Error("InjectedFailure"); });
  assert.equal(result.status, "Failed");
  assert.equal((await db.select().from(S.domainStoreHeaders).where(eq(S.domainStoreHeaders.organizationId, ctx.organizationId))).length, 0);
  assert.equal((await db.select().from(S.systemDomainRecords).where(eq(S.systemDomainRecords.organizationId, ctx.organizationId))).length, 0);
  const [record] = await db.select().from(S.dataMigrations).where(eq(S.dataMigrations.id, preview.migrationId));
  assert.equal(record.status, "Failed");
  assert.ok((await db.select().from(S.auditEvents).where(eq(S.auditEvents.organizationId, ctx.organizationId))).some(row => row.action === "MigrationFailed"));
});
test("7D operational export includes imported canonical rows without credentials", async () => {
  const ctx = await company(), pack = fixture();
  const preview = await previewDataMigration(db, ctx, { organizationId: ctx.organizationId, package: pack });
  await executeDataMigration(db, ctx, { organizationId: ctx.organizationId, migrationId: preview.migrationId, checksum: preview.checksum, package: pack });
  const backup = await exportOrganization(db, ctx);
  assert.equal(backup.tables.system_domain_records.filter((row: any) => row.collection === "processes").length, 15);
  assert.equal(backup.tables.domain_store_headers.length, 15);
  assert.equal(backup.tables.strategy_domain_records.filter((row: any) => row.collection === "objectives").length, 3);
  for (const name of Object.keys(backup.tables)) assert.ok(!/auth|memberships|role_permissions|invitations|users|migration_imports|tenant_workspaces/.test(name));
  assert.ok(Object.values(backup.tables).flat().every((row: any) => row.organizationId === ctx.organizationId));
});
test("7D export contains exactly the 15 allowlisted stores and keeps legacy IDs", () => {
  const e = fixture(),
    local = localEnvelope(e);
  assert.equal(Object.keys(local.stores).length, 15);
  assert.deepEqual(
    JSON.parse(local.stores["growth-engine.system.v1"]!).processes.map(
      (p: any) => p.id,
    ),
    createSystemSeed().processes.map((p) => p.id),
  );
});
test("7D existing local envelope remains unchanged", () => {
  const e = exportLocalWorkspace({ getItem: () => null }, "local");
  assert.equal(e.schemaVersion, 1);
  assert.equal(e.source, "browser-local-v1");
});
test("7D unsupported export schema is rejected", () =>
  assert.throws(() =>
    validateBusinessExport({ ...fixture(), schemaVersion: 99 }),
  ));
test("7D omitted module cannot become an empty valid import", () =>
  assert.throws(() => validateBusinessExport({ ...fixture(), agent: {} })));
test("7D unexpected auth store is rejected", () => {
  const e = fixture();
  (e.agent as any).authSessions = "[]";
  assert.throws(() => validateBusinessExport(e));
});
test("7D nested credential fields are rejected", () => {
  const e = fixture(),
    data = JSON.parse(e.system["growth-engine.system.v1"]!);
  data.passwordHash = "must-never-export";
  e.system["growth-engine.system.v1"] = JSON.stringify(data);
  assert.throws(
    () => validateBusinessExport(e),
    /ForbiddenBusinessExportField/,
  );
});
test("7D duplicate primary IDs are rejected by shared local validators", () => {
  const e = fixture(),
    data = JSON.parse(e.system["growth-engine.system.v1"]!);
  data.processes.push(data.processes[0]);
  e.system["growth-engine.system.v1"] = JSON.stringify(data);
  assert.throws(() => validateBusinessExport(e));
});
test("7D cross-module missing owner is reported without repairing it", () => {
  const e = fixture(),
    data = JSON.parse(e.strategy["growth-engine.strategy.v1"]!);
  data.objectives[0].ownerRoleId = "missing-role";
  e.strategy["growth-engine.strategy.v1"] = JSON.stringify(data);
  const report = inspectBusinessExport(e);
  assert.ok(report.errors.some((x) => x.targetId === "missing-role"));
  assert.equal(
    JSON.parse(e.strategy["growth-engine.strategy.v1"]!).objectives[0]
      .ownerRoleId,
    "missing-role",
  );
});
test("7D preview counts match actual System and Strategy data", () => {
  const report = inspectBusinessExport(fixture());
  assert.equal(report.errors.length, 0);
  assert.equal(
    report.counts.system.processes,
    createSystemSeed().processes.length,
  );
  assert.ok(report.counts.strategy.objectives > 0);
});
test("7D checksum ignores export date and JSON object key order", () => {
  const a = fixture(),
    b = structuredClone(a);
  b.exportedAt = "2026-10-07T00:00:00Z";
  b.system["growth-engine.system.v1"] = JSON.stringify(
    Object.fromEntries(
      Object.entries(
        JSON.parse(b.system["growth-engine.system.v1"]!),
      ).reverse(),
    ),
  );
  assert.equal(migrationChecksum(a), migrationChecksum(b));
});
test("7D checksum detects historical value changes", () => {
  const a = fixture(),
    b = structuredClone(a),
    data = JSON.parse(b.system["growth-engine.system.v1"]!);
  data.processes[0].notes = "changed";
  b.system["growth-engine.system.v1"] = JSON.stringify(data);
  assert.notEqual(migrationChecksum(a), migrationChecksum(b));
});
test("7D empty company preview writes only lifecycle/audit metadata", async () => {
  const ctx = await company(),
    report = await previewDataMigration(db, ctx, {
      organizationId: ctx.organizationId,
      package: fixture(),
    });
  assert.equal(report.eligible, true);
  assert.equal(report.executionEnabled, true);
  assert.equal(
    (
      await db
        .select()
        .from(S.processes)
        .where(eq(S.processes.organizationId, ctx.organizationId))
    ).length,
    0,
  );
  const [record] = await listDataMigrations(db, ctx);
  assert.equal(record.status, "Previewed");
  assert.equal(record.initiatedByUserId, ctx.userId);
  assert.equal("archive" in record, false);
  const events = await db
    .select()
    .from(S.auditEvents)
    .where(eq(S.auditEvents.entityId, report.migrationId));
  assert.equal(events[0].action, "MigrationPreviewed");
});
for (const roleName of ["Viewer", "Editor", "Consultant"])
  test(`7D ${roleName} cannot preview whole-company import`, async () => {
    const owner = await company();
    const [user] = await db
      .insert(S.users)
      .values({
        name: roleName,
        email: `${randomUUID()}@development.example.invalid`,
      })
      .returning();
    const [member] = await db
      .insert(S.memberships)
      .values({
        organizationId: owner.organizationId,
        userId: user.id,
        status: "Active",
      })
      .returning();
    const [role] = await db
      .select()
      .from(S.accessRoles)
      .where(
        and(
          eq(S.accessRoles.organizationId, owner.organizationId),
          eq(S.accessRoles.name, roleName),
        ),
      );
    await db
      .insert(S.membershipRoles)
      .values({
        organizationId: owner.organizationId,
        membershipId: member.id,
        roleId: role.id,
      });
    const viewer = await resolveOrganizationContext(
      db,
      user.id,
      owner.organizationId,
    );
    await assert.rejects(
      () =>
        previewDataMigration(db, viewer, {
          organizationId: viewer.organizationId,
          package: fixture(),
        }),
      /Forbidden/,
    );
  });
test("7D foreign organization target is denied", async () => {
  const ctx = await company();
  await assert.rejects(
    () =>
      previewDataMigration(db, ctx, {
        organizationId: seed.betaId,
        package: fixture(),
      }),
    /Forbidden/,
  );
});
test("7D company with just one department blocks full import", async () => {
  const ctx = await company();
  await db
    .insert(S.departments)
    .values({
      organizationId: ctx.organizationId,
      name: "Existing department",
    });
  const report = await previewDataMigration(db, ctx, {
    organizationId: ctx.organizationId,
    package: fixture(),
  });
  assert.equal(report.eligible, false);
  assert.ok(report.conflicts.some((x) => x.code === "NonEmptyOrganization"));
});
test("7D preview history is tenant scoped", async () => {
  const a = await company(),
    b = await company();
  await previewDataMigration(db, a, {
    organizationId: a.organizationId,
    package: fixture(),
  });
  assert.equal((await listDataMigrations(db, b)).length, 0);
});
test("7D invalid package leaves migration records and business data untouched", async () => {
  const ctx = await company();
  await assert.rejects(
    () =>
      previewDataMigration(db, ctx, {
        organizationId: ctx.organizationId,
        package: { schemaVersion: 999 },
      }),
    /InvalidInput/,
  );
  assert.equal((await listDataMigrations(db, ctx)).length, 0);
});
test("7D business DB backup excludes invitations, memberships, sessions and raw workspaces", async () => {
  const ctx = await resolveOrganizationContext(
      db,
      seed.actorUserId,
      seed.alphaId,
    ),
    backup = await exportOrganization(db, ctx);
  for (const key of [
    "organization_memberships",
    "membership_roles",
    "organization_invitations",
    "invitation_roles",
    "auth_sessions",
    "auth_accounts",
    "tenant_workspace_documents",
    "migration_imports",
  ])
    assert.equal(key in backup.tables, false, key);
  assert.ok("business_departments" in backup.tables);
  for (const rows of Object.values(backup.tables))
    for (const row of rows)
      assert.equal((row as any).organizationId, ctx.organizationId);
});
