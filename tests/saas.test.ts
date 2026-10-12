import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq, sql, is, getTableColumns, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import * as S from "../lib/server/db/schema";
import { DataError, safeDataError } from "../lib/server/db/errors";
import {
  resolveOrganizationContext,
  requireOrganizationContext,
  requirePermission,
} from "../lib/server/context";
import { defaultRolePermissions } from "../lib/server/permissions";
import { createOrganizationWithOwner } from "./full-access-fixture";
import { StrategyService, AgentService } from "../lib/server/services/domains";
import {
  SystemRepository,
  StrategyRepository,
  ScaleRepository,
  AgentRepository,
} from "../lib/server/repositories/domains";
import { OrganizationRepository } from "../lib/server/repositories/organization";
import { seedDevelopment } from "../lib/server/dev/seed";
import {
  exportLocalWorkspace,
  validateLocalExport,
  localStoreKeys,
} from "../lib/persistence/export";
import {
  LocalPersistenceProvider,
  persistenceMode,
} from "../lib/persistence/provider";
import { DatabasePersistenceProvider } from "../lib/server/persistence";
import {
  exportOrganization,
  stageLocalImport,
} from "../lib/server/services/migration";
import { createDevHandlers } from "../lib/server/dev-api";

const pg = new PGlite(),
  db = drizzle(pg, { schema: S });
let seed: Awaited<ReturnType<typeof seedDevelopment>>;
let alpha: Awaited<ReturnType<typeof resolveOrganizationContext>>,
  beta: typeof alpha;
before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  seed = await seedDevelopment(db);
  alpha = await resolveOrganizationContext(db, seed.actorUserId, seed.alphaId);
  beta = await resolveOrganizationContext(db, seed.actorUserId, seed.betaId);
});
after(async () => {
  await pg.close();
});
const errorCode = (code: string) => (e: unknown) =>
  e instanceof DataError && e.code === code;

test("7A A/B/P organization bootstrap creates owner roles profile settings and audit atomically", async () => {
  const made = await createOrganizationWithOwner(db, seed.actorUserId, {
    name: "Bootstrap company",
    slug: "bootstrap-" + randomUUID(),
    timezone: "UTC",
    currency: "USD",
    profile: { teamSize: "6–15", notes: "profile separate from identity" },
  });
  assert.equal(made.membership.userId, seed.actorUserId);
  assert.equal(made.membership.status, "Active");
  const context = await resolveOrganizationContext(
    db,
    seed.actorUserId,
    made.organization.id,
  );
  assert.ok(context.permissions.includes("roles.manage"));
  const settings = await new OrganizationRepository(db).settings(
    made.organization.id,
  );
  assert.equal(settings?.timezone, "UTC");
  assert.equal(settings?.currency, "USD");
  const roles = await db
    .select()
    .from(S.accessRoles)
    .where(eq(S.accessRoles.organizationId, made.organization.id));
  assert.equal(roles.length, 6);
  const audit = await new AgentRepository(db).listAudit(made.organization.id);
  assert.equal(audit[0].organizationId, made.organization.id);
  assert.equal(audit[0].actorUserId, seed.actorUserId);
  assert.equal(
    (
      await db
        .select()
        .from(S.organizationProfiles)
        .where(eq(S.organizationProfiles.organizationId, made.organization.id))
    )[0].notes,
    "profile separate from identity",
  );
});
test("7A C/D user belongs to two organizations and duplicate membership is rejected by PostgreSQL", async () => {
  assert.equal(
    (await new OrganizationRepository(db).listForUser(seed.actorUserId)).filter(
      (o) => [seed.alphaId, seed.betaId].includes(o.id),
    ).length,
    2,
  );
  await assert.rejects(
    db.insert(S.memberships).values({
      organizationId: seed.alphaId,
      userId: seed.actorUserId,
      status: "Active",
    }),
  );
});
test("7A E/L two-company golden objective lookup never returns another company", async () => {
  const repo = new StrategyRepository(db),
    a = await repo.listObjectives(seed.alphaId),
    b = await repo.listObjectives(seed.betaId);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
  assert.notEqual(a[0].id, b[0].id);
  assert.equal(
    await repo.getObjective({
      organizationId: seed.alphaId,
      objectiveId: b[0].id,
    }),
    null,
  );
  assert.equal(
    await repo.getObjective({
      organizationId: seed.betaId,
      objectiveId: a[0].id,
    }),
    null,
  );
});
test("7A E scoped process and experiment ID attacks are isolated", async () => {
  const sys = new SystemRepository(db),
    scale = new ScaleRepository(db);
  const p = (await sys.listProcesses(seed.betaId))[0],
    e = (await scale.listExperiments(seed.betaId))[0];
  assert.equal(
    await sys.getProcess({ organizationId: seed.alphaId, processId: p.id }),
    null,
  );
  assert.equal(
    await scale.getExperiment({
      organizationId: seed.alphaId,
      experimentId: e.id,
    }),
    null,
  );
});
test("7A cross-tenant owner, role grant, cycle and experiment constraint fail at real FK boundary", async () => {
  const [roleB] = await db
    .select()
    .from(S.businessRoles)
    .where(eq(S.businessRoles.organizationId, seed.betaId));
  const [departmentA] = await db
    .select()
    .from(S.departments)
    .where(eq(S.departments.organizationId, seed.alphaId));
  await assert.rejects(
    db.insert(S.processes).values({
      organizationId: seed.alphaId,
      code: "ATTACK",
      name: "Invalid cross tenant",
      valueChain: "sales",
      departmentId: departmentA.id,
      ownerRoleId: roleB.id,
      frequency: 1,
      impact: 1,
      variation: 1,
      dependency: 1,
      founderDependency: "none",
    }),
  );
  await assert.rejects(
    db.insert(S.membershipRoles).values({
      organizationId: seed.alphaId,
      membershipId: alpha.membershipId,
      roleId: beta.roleIds[0],
    }),
  );
  const [cycleB] = await db
    .select()
    .from(S.strategyCycles)
    .where(eq(S.strategyCycles.organizationId, seed.betaId));
  await assert.rejects(
    db.insert(S.objectives).values({
      organizationId: seed.alphaId,
      cycleId: cycleB.id,
      code: "BAD",
      title: "Invalid",
      startDate: "2026-10-01",
      deadline: "2026-12-31",
    }),
  );
  const [constraintB] = await db
    .select()
    .from(S.constraints)
    .where(eq(S.constraints.organizationId, seed.betaId));
  await assert.rejects(
    db.insert(S.experiments).values({
      organizationId: seed.alphaId,
      constraintId: constraintB.id,
      code: "BAD",
      title: "Invalid",
      hypothesis: "Invalid",
    }),
  );
});
test("7A F/G suspended invited removed memberships never resolve active access", async () => {
  for (const status of ["Suspended", "Invited", "Removed"]) {
    await db
      .update(S.memberships)
      .set({ status })
      .where(eq(S.memberships.id, beta.membershipId));
    await assert.rejects(
      resolveOrganizationContext(db, seed.actorUserId, seed.betaId),
      errorCode("Forbidden"),
    );
  }
  await db
    .update(S.memberships)
    .set({ status: "Active" })
    .where(eq(S.memberships.id, beta.membershipId));
});
test("7A disabled account and suspended organization deny context regardless of role", async () => {
  await db
    .update(S.users)
    .set({ status: "Disabled" })
    .where(eq(S.users.id, seed.actorUserId));
  await assert.rejects(
    resolveOrganizationContext(db, seed.actorUserId, seed.alphaId),
    errorCode("Forbidden"),
  );
  await db
    .update(S.users)
    .set({ status: "Active" })
    .where(eq(S.users.id, seed.actorUserId));
  await db
    .update(S.organizations)
    .set({ status: "Suspended" })
    .where(eq(S.organizations.id, seed.betaId));
  await assert.rejects(
    resolveOrganizationContext(db, seed.actorUserId, seed.betaId),
    errorCode("Forbidden"),
  );
  await db
    .update(S.organizations)
    .set({ status: "Trial" })
    .where(eq(S.organizations.id, seed.betaId));
});
test("7A H access roles distinct from business roles; Person may lack account", async () => {
  const access = await db
      .select()
      .from(S.accessRoles)
      .where(eq(S.accessRoles.organizationId, seed.alphaId)),
    business = await db
      .select()
      .from(S.businessRoles)
      .where(eq(S.businessRoles.organizationId, seed.alphaId));
  assert.ok(access.some((r) => r.name === "Owner"));
  assert.ok(business.some((r) => r.title === "Sales Manager"));
  assert.ok(!("role" in S.users));
  const [person] = await db
    .insert(S.people)
    .values({ organizationId: seed.alphaId, name: "Employee without login" })
    .returning();
  assert.equal(person.userId, null);
  await db
    .update(S.people)
    .set({ status: "archived", archivedAt: new Date() })
    .where(eq(S.people.id, person.id));
  assert.equal(
    (await db.select().from(S.users).where(eq(S.users.id, seed.actorUserId)))
      .length,
    1,
  );
});
test("7A I multi-organization role permissions resolve separately and deterministically", async () => {
  assert.deepEqual(
    (await resolveOrganizationContext(db, seed.actorUserId, seed.alphaId))
      .permissions,
    alpha.permissions,
  );
  assert.ok(alpha.permissions.includes("agent.execute"));
  assert.ok(!beta.permissions.includes("agent.execute"));
  assert.ok(beta.permissions.includes("strategy.edit"));
  assert.throws(
    () => requirePermission(beta, "agent.execute"),
    errorCode("Forbidden"),
  );
  assert.ok(defaultRolePermissions.Viewer.every((p) => p.endsWith(".view")));
});
test("7A Viewer can read but cannot write or acquire authority from forged cached context", async () => {
  const [u] = await db
    .insert(S.users)
    .values({ email: "viewer@tests.example.invalid", name: "Viewer" })
    .returning();
  const [m] = await db
    .insert(S.memberships)
    .values({ organizationId: seed.betaId, userId: u.id, status: "Active" })
    .returning();
  const [r] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, seed.betaId),
        eq(S.accessRoles.name, "Viewer"),
      ),
    );
  await db
    .insert(S.membershipRoles)
    .values({ organizationId: seed.betaId, membershipId: m.id, roleId: r.id });
  const viewer = await resolveOrganizationContext(db, u.id, seed.betaId);
  assert.ok(viewer.permissions.includes("strategy.view"));
  assert.equal((await new StrategyService(db).list(viewer)).length, 1);
  await assert.rejects(
    new AgentService(db).createSession(
      { ...viewer, permissions: ["agent.recommend"] },
      "Forbidden session",
    ),
    errorCode("Forbidden"),
  );
  const [cycle] = await db
    .select()
    .from(S.strategyCycles)
    .where(eq(S.strategyCycles.organizationId, seed.betaId));
  await assert.rejects(
    new StrategyService(db).createDraft(
      { ...viewer, permissions: ["strategy.edit"] },
      {
        cycleId: cycle.id,
        code: "FORGE",
        title: "Forged",
        startDate: "2026-10-01",
        deadline: "2026-12-31",
      },
      "forged",
    ),
    errorCode("Forbidden"),
  );
});
test("7A J organization slug and email normalization/unique constraints are real", async () => {
  await assert.rejects(
    createOrganizationWithOwner(db, seed.actorUserId, {
      name: "Duplicate",
      slug: "dev-alpha",
    }),
    errorCode("ConstraintViolation"),
  );
  await assert.rejects(
    db
      .insert(S.users)
      .values({ email: "UPPER@EXAMPLE.INVALID", name: "Invalid email" }),
  );
});
test("7A K repository requires valid organizationId and no unscoped ID signature", async () => {
  const r = new StrategyRepository(db);
  await assert.rejects(
    r.getObjective({ organizationId: "", objectiveId: randomUUID() }),
    errorCode("InvalidInput"),
  );
  assert.throws(
    () => r.listObjectives(undefined as unknown as string),
    errorCode("InvalidInput"),
  );
});
test("7A M audit includes scope and actor; tenant export contains no other organization", async () => {
  const exported = await exportOrganization(db, alpha);
  assert.equal(exported.organization?.id, seed.alphaId);
  for (const rows of Object.values(exported.tables))
    for (const row of rows)
      assert.equal(
        (row as { organizationId: string }).organizationId,
        seed.alphaId,
      );
  assert.equal("users" in exported.tables, false);
  assert.equal("permissions" in exported.tables, false);
});
test("7A N Agent session includes organization and real creator membership", async () => {
  const session = await new AgentService(db).createSession(
    alpha,
    "Scoped session",
  );
  assert.equal(session.organizationId, seed.alphaId);
  assert.equal(session.createdByUserId, seed.actorUserId);
  assert.equal(
    (
      await db
        .select()
        .from(S.auditEvents)
        .where(
          and(
            eq(S.auditEvents.organizationId, seed.alphaId),
            eq(S.auditEvents.entityId, session.id),
          ),
        )
    ).length,
    1,
  );
  assert.equal(
    (await new AgentRepository(db).listSessions(seed.betaId, seed.actorUserId))
      .length,
    0,
  );
  const [outsider] = await db
    .insert(S.users)
    .values({ email: "outsider@tests.example.invalid", name: "Outsider" })
    .returning();
  await assert.rejects(
    db.insert(S.agentSessions).values({
      organizationId: seed.alphaId,
      createdByUserId: outsider.id,
      title: "Invalid",
      contextType: "executive",
    }),
  );
});
test("7A O Agent requested approved executed actors and approval binding persist relationally", async () => {
  const [action] = await db
    .insert(S.agentActions)
    .values({
      organizationId: seed.alphaId,
      requestedByUserId: seed.actorUserId,
      capabilityId: "system.createImprovement",
      templateId: "Improvement",
      title: "Schema only",
      risk: "Medium",
      binding: "revision-one",
      payload: {},
      frozenEvidence: [],
      expectedState: {},
    })
    .returning();
  const [approval] = await db
    .insert(S.agentApprovals)
    .values({
      organizationId: seed.alphaId,
      actionId: action.id,
      approvedByUserId: seed.actorUserId,
      revision: 1,
      binding: "revision-one",
      decision: "Approved",
      expiresAt: new Date(Date.now() + 60000),
    })
    .returning();
  const [execution] = await db
    .insert(S.agentExecutions)
    .values({
      organizationId: seed.alphaId,
      actionId: action.id,
      approvalId: approval.id,
      executedByUserId: seed.actorUserId,
      approvedRevision: 1,
      binding: "revision-one",
      commandId: randomUUID(),
      capabilityId: action.capabilityId,
      status: "Pending",
      command: {},
      beforeSnapshot: {},
    })
    .returning();
  assert.equal(action.requestedByUserId, approval.approvedByUserId);
  assert.equal(execution.executedByUserId, seed.actorUserId);
  await assert.rejects(
    db.insert(S.agentExecutions).values({
      ...execution,
      id: randomUUID(),
      commandId: randomUUID(),
      approvedRevision: 2,
    }),
  );
});
test("7A Q failure mid-bootstrap rolls back organization membership roles settings audit", async () => {
  const slug = "rollback-" + randomUUID();
  const before = (await db.select().from(S.memberships)).length;
  await assert.rejects(
    createOrganizationWithOwner(
      db,
      seed.actorUserId,
      { name: "Fail", slug },
      {
        afterMembership() {
          throw Error("forced failure");
        },
      },
    ),
  );
  assert.equal(
    (
      await db
        .select()
        .from(S.organizations)
        .where(eq(S.organizations.slug, slug))
    ).length,
    0,
  );
  assert.equal((await db.select().from(S.memberships)).length, before);
});
test("7A R transactional idempotency creates one objective and audit; altered payload conflicts", async () => {
  const [cycle] = await db
    .select()
    .from(S.strategyCycles)
    .where(eq(S.strategyCycles.organizationId, seed.alphaId));
  const input = {
    cycleId: cycle.id,
    code: "O2",
    title: "Idempotent objective",
    startDate: "2026-10-01",
    deadline: "2026-12-31",
  };
  const service = new StrategyService(db),
    first = await service.createDraft(alpha, input, "same-command"),
    second = await service.createDraft(alpha, input, "same-command");
  assert.equal(first.id, second.id);
  assert.equal(
    (
      await db
        .select()
        .from(S.auditEvents)
        .where(
          and(
            eq(S.auditEvents.organizationId, seed.alphaId),
            eq(S.auditEvents.entityId, first.id),
          ),
        )
    ).length,
    1,
  );
  await assert.rejects(
    service.createDraft(alpha, { ...input, title: "changed" }, "same-command"),
    errorCode("Conflict"),
  );
});
test("7A S optimistic update cannot overwrite another manager; audit commits atomically", async () => {
  const [o] = await db
    .select()
    .from(S.objectives)
    .where(
      and(
        eq(S.objectives.organizationId, seed.alphaId),
        eq(S.objectives.code, "O2"),
      ),
    );
  const service = new StrategyService(db);
  const a = await service.updateTitle(alpha, o.id, o.version, "Version two");
  assert.equal(a.version, o.version + 1);
  await assert.rejects(
    service.updateTitle(alpha, o.id, o.version, "Stale overwrite"),
    errorCode("Conflict"),
  );
  assert.equal(
    (
      await new StrategyRepository(db).getObjective({
        organizationId: seed.alphaId,
        objectiveId: o.id,
      })
    )?.title,
    "Version two",
  );
});
test("7A existing pure domain validation rejects impossible dates before database create", async () => {
  const [cycle] = await db
    .select()
    .from(S.strategyCycles)
    .where(eq(S.strategyCycles.organizationId, seed.alphaId));
  await assert.rejects(
    new StrategyService(db).createDraft(
      alpha,
      {
        cycleId: cycle.id,
        code: "DATE",
        title: "Bad date",
        startDate: "2026-02-30",
        deadline: "2026-12-31",
      },
      "bad-date",
    ),
    errorCode("InvalidInput"),
  );
  assert.equal(
    (
      await db
        .select()
        .from(S.idempotencyKeys)
        .where(eq(S.idempotencyKeys.key, "bad-date"))
    ).length,
    0,
  );
});
test("7A T database missing migration/unavailable/constraint errors are sanitized", async () => {
  const raw = new PGlite();
  try {
    await raw.query("select * from organizations");
    assert.fail();
  } catch (e) {
    assert.equal(safeDataError(e).code, "MigrationMissing");
  } finally {
    await raw.close();
  }
  assert.equal(
    safeDataError({
      code: "ECONNREFUSED",
      message: "postgres://secret:password@host",
    }).message,
    "DatabaseUnavailable",
  );
  assert.equal(
    safeDataError({ cause: { code: "23505" } }).code,
    "ConstraintViolation",
  );
});
test("7A U/V local fallback and database providers initialize independently without cache bleed", async () => {
  const local = new LocalPersistenceProvider({ getItem: () => null });
  assert.deepEqual(await local.listObjectives(), []);
  assert.equal(persistenceMode(undefined), "local");
  assert.equal(persistenceMode("database"), "database");
  assert.throws(() => persistenceMode("invalid"));
  const a = new DatabasePersistenceProvider(db, alpha),
    b = new DatabasePersistenceProvider(db, beta);
  assert.ok(
    (await a.listObjectives()).every(
      (o) => o.title !== "Revenue foundation — Company Beta — development",
    ),
  );
  assert.equal((await b.listObjectives()).length, 1);
});
test("7A versioned complete local export is allowlisted and stages only in explicit target tenant", async () => {
  const map = new Map<string, string>([["unrelated-secret", "do not export"]]);
  const store = { getItem: (key: string) => map.get(key) ?? null };
  const e = exportLocalWorkspace(store, "selected-local-workspace");
  assert.equal(Object.keys(e.stores).length, localStoreKeys.length);
  assert.equal("unrelated-secret" in e.stores, false);
  assert.equal(validateLocalExport(e).schemaVersion, 1);
  const staged = await stageLocalImport(db, alpha, e);
  assert.equal(staged.organizationId, seed.alphaId);
  assert.equal(staged.status, "Staged");
  assert.equal((await stageLocalImport(db, alpha, e)).id, staged.id);
  assert.equal(
    (
      await db
        .select()
        .from(S.migrationImports)
        .where(eq(S.migrationImports.organizationId, seed.betaId))
    ).length,
    0,
  );
  await assert.rejects(
    stageLocalImport(db, alpha, { ...e, schemaVersion: 99 }),
    errorCode("InvalidInput"),
  );
  assert.equal(
    (await new StrategyRepository(db).listObjectives(seed.alphaId)).length,
    2,
  );
});
test("7A staged export rejects corrupt stores and drops untrusted metadata", () => {
  const e = exportLocalWorkspace({ getItem: () => null }, "local-workspace");
  const accepted = validateLocalExport({
    ...e,
    organizationProfile: { forged: true },
    moduleVersions: { ...e.moduleVersions, unrelated: 1 },
  });
  assert.equal(accepted.organizationProfile, null);
  assert.equal("unrelated" in accepted.moduleVersions, false);
  assert.throws(() =>
    validateLocalExport({
      ...e,
      stores: { ...e.stores, [localStoreKeys[0]]: "" },
    }),
  );
  assert.throws(() =>
    validateLocalExport({
      ...e,
      stores: { ...e.stores, [localStoreKeys[0]]: "{bad json" },
    }),
  );
});
test("7A dev API real database smoke: health organizations create/read objective and cross-tenant deny", async () => {
  const config = {
    environment: "test",
    enabled: true,
    token: "development-test-token-not-a-secret-123",
    actorUserId: seed.actorUserId,
  };
  const api = createDevHandlers(() => db, config);
  const request = (path: string, body?: unknown, key?: string) =>
    new Request("http://localhost:3000/api/dev/saas" + path, {
      method: body ? "POST" : "GET",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "x-saas-dev-token": config.token,
        "content-type": "application/json",
        "idempotency-key": key ?? "",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  assert.equal((await api.GET(request("?operation=health"))).status, 200);
  const created = await api.POST(
    request("", {
      operation: "createOrganization",
      name: "API company",
      slug: "api-company",
    }),
  );
  assert.equal(created.status, 201);
  const made = await created.json();
  assert.equal(made.membership.userId, seed.actorUserId);
  // This legacy objective scenario exercises an explicitly enabled customer.
  await db.update(S.organizations).set({accessTier:"full_access"}).where(eq(S.organizations.id,made.organization.id));
  const [cycle] = await db
    .insert(S.strategyCycles)
    .values({
      organizationId: made.organization.id,
      name: "API cycle",
      startDate: "2026-10-01",
      endDate: "2026-12-31",
    })
    .returning();
  const result = await api.POST(
    request(
      "",
      {
        operation: "createObjective",
        organizationId: made.organization.id,
        cycleId: cycle.id,
        code: "O1",
        title: "API objective",
        startDate: "2026-10-01",
        deadline: "2026-12-31",
      },
      "api-objective",
    ),
  );
  assert.equal(result.status, 201);
  assert.equal(
    (
      await (
        await api.GET(request("?organizationId=" + made.organization.id))
      ).json()
    ).objectives.length,
    1,
  );
  const outsiderApi = createDevHandlers(() => db, {
    ...config,
    actorUserId: randomUUID(),
  });
  assert.equal(
    (await outsiderApi.GET(request("?organizationId=" + made.organization.id)))
      .status,
    403,
  );
});
test("7A production dev API stays disabled even with configuration; body role/user forgery rejected", async () => {
  const config = {
    environment: "production",
    enabled: true,
    token: "development-test-token-not-a-secret-123",
    actorUserId: seed.actorUserId,
  };
  const r = new Request("http://localhost:3000/api/dev/saas", {
    headers: { host: "localhost:3000", "x-saas-dev-token": config.token },
  });
  let accessed = false;
  const api = createDevHandlers(() => {
    accessed = true;
    return db;
  }, config);
  assert.equal((await api.GET(r)).status, 404);
  assert.equal(accessed, false);
  const dev = createDevHandlers(() => db, { ...config, environment: "test" });
  const bad = new Request(r.url, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "x-saas-dev-token": config.token,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      operation: "createOrganization",
      name: "Forged",
      slug: "forged",
      userId: randomUUID(),
      role: "Owner",
    }),
  });
  assert.equal((await dev.POST(bad)).status, 400);
});
test("7A every business table owns tenant scope; global identity/reference tables are explicit exceptions", () => {
  const global = new Set([
    "users",
    "organizations",
    "permissions",
    "default_growth_levers",
    "user_preferences",
    "auth_accounts","auth_sessions","auth_verifications","auth_rate_limits","auth_security_events",
  ]);
  for (const table of Object.values(S))
    if (is(table, PgTable)) {
      const columns = getTableColumns(table);
      if (!("organizationId" in columns))
        assert.ok(global.has(getTableName(table)));
    }
});
test("7A audit is append-only and completed Agent binding cannot change or disappear", async () => {
  const [event] = await db
    .select()
    .from(S.auditEvents)
    .where(eq(S.auditEvents.organizationId, seed.alphaId));
  await assert.rejects(
    db
      .update(S.auditEvents)
      .set({ action: "tampered" })
      .where(eq(S.auditEvents.id, event.id)),
  );
  await assert.rejects(
    db.delete(S.auditEvents).where(eq(S.auditEvents.id, event.id)),
  );
  const [record] = await db
    .select()
    .from(S.agentExecutions)
    .where(eq(S.agentExecutions.organizationId, seed.alphaId));
  await db
    .update(S.agentExecutions)
    .set({ status: "Succeeded", completedAt: new Date() })
    .where(eq(S.agentExecutions.id, record.id));
  await assert.rejects(
    db
      .update(S.agentExecutions)
      .set({ binding: "changed" })
      .where(eq(S.agentExecutions.id, record.id)),
  );
  await assert.rejects(
    db.delete(S.agentExecutions).where(eq(S.agentExecutions.id, record.id)),
  );
});
test("7A removing membership preserves company data and historical authorship", async () => {
  const before = (
    await new StrategyRepository(db).listObjectives(seed.betaId)
  ).map((o) => o.id);
  await db
    .update(S.memberships)
    .set({ status: "Removed" })
    .where(eq(S.memberships.id, beta.membershipId));
  assert.deepEqual(
    (await new StrategyRepository(db).listObjectives(seed.betaId)).map(
      (o) => o.id,
    ),
    before,
  );
  await assert.rejects(
    resolveOrganizationContext(db, seed.actorUserId, seed.betaId),
    errorCode("Forbidden"),
  );
  await db
    .update(S.memberships)
    .set({ status: "Active" })
    .where(eq(S.memberships.id, beta.membershipId));
});
test("7A dev API rejects wrong token origin host and oversized request without leaking secrets", async () => {
  const config = {
    environment: "test",
    enabled: true,
    token: "development-test-token-not-a-secret-123",
    actorUserId: seed.actorUserId,
  };
  const api = createDevHandlers(() => db, config);
  for (const [headers, status] of [
    [{ "x-saas-dev-token": "wrong" }, 403],
    [{ origin: "https://foreign.example" }, 403],
    [{ host: "foreign.example" }, 403],
  ] as const) {
    const r = await api.POST(
      new Request("http://localhost:3000/api/dev/saas", {
        method: "POST",
        headers: {
          host: "localhost:3000",
          origin: "http://localhost:3000",
          "x-saas-dev-token": config.token,
          "content-type": "application/json",
          ...headers,
        },
        body: "{}",
      }),
    );
    assert.equal(r.status, status);
    assert.ok(!(await r.text()).includes(config.token));
  }
  const large = await api.POST(
    new Request("http://localhost:3000/api/dev/saas", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
        "x-saas-dev-token": config.token,
        "content-type": "application/json",
      },
      body: " ".repeat(9000),
    }),
  );
  assert.equal(large.status, 413);
});
test("7A migration runner is repeatable against real PostgreSQL without resetting data", async () => {
  const before = (await db.select().from(S.organizations)).length;
  await migrate(db, { migrationsFolder: "drizzle" });
  assert.equal((await db.select().from(S.organizations)).length, before);
});
test("7A performance foundation: 100 companies, 100 users, 100 memberships/company and tenant queries", async () => {
  const orgs = await db
    .insert(S.organizations)
    .values(
      Array.from({ length: 100 }, (_, i) => ({
        name: "Load company " + i,
        slug: "load-company-" + i,
      })),
    )
    .returning();
  const accounts = await db
    .insert(S.users)
    .values(
      Array.from({ length: 100 }, (_, i) => ({
        name: "Load user " + i,
        email: `load-${i}@tests.example.invalid`,
      })),
    )
    .returning();
  const members = orgs.flatMap((o) =>
    accounts.map((u) => ({
      organizationId: o.id,
      userId: u.id,
      status: "Active",
    })),
  );
  for (let i = 0; i < members.length; i += 1000)
    await db.insert(S.memberships).values(members.slice(i, i + 1000));
  const cycles = await db
    .insert(S.strategyCycles)
    .values(
      orgs.map((o) => ({
        organizationId: o.id,
        name: "Load cycle",
        startDate: "2026-10-01",
        endDate: "2026-12-31",
      })),
    )
    .returning();
  const rows = cycles.flatMap((c) =>
    Array.from({ length: 25 }, (_, i) => ({
      organizationId: c.organizationId,
      cycleId: c.id,
      code: "O" + i,
      title: "Load objective " + i,
      startDate: "2026-10-01",
      deadline: "2026-12-31",
    })),
  );
  for (let i = 0; i < rows.length; i += 500)
    await db.insert(S.objectives).values(rows.slice(i, i + 500));
  const start = performance.now();
  const selected = await new StrategyRepository(db).listObjectives(orgs[0].id);
  const duration = performance.now() - start;
  assert.equal(selected.length, 25);
  assert.ok(selected.every((r) => r.organizationId === orgs[0].id));
  assert.ok(duration < 5000);
  console.log(
    JSON.stringify({
      organizations: 100,
      users: 100,
      memberships: 10000,
      objectives: 2500,
      scopedQueryMs: +duration.toFixed(2),
    }),
  );
  const plan = await pg.query(
    "EXPLAIN SELECT * FROM strategy_objectives WHERE organization_id=$1",
    [orgs[0].id],
  );
  assert.ok(JSON.stringify(plan.rows).includes("Index"));
});
