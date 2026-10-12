import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { eq, and } from "drizzle-orm";
import * as S from "../lib/server/db/schema";
import { createOrganizationWithOwner } from "../lib/server/services/organization";
import { resolveOrganizationContext, reauthorize } from "../lib/server/context";
import {
  requirePlatformAdmin,
  changeAccess,
  requestAccess,
  platformOverview,
  assessmentSummary,
} from "../lib/server/services/platform-admin";
import {
  readTenantWorkspace,
  writeTenantWorkspace,
} from "../lib/server/services/workspace";
import { SystemDomainService } from "../lib/server/services/domain-state";
import { emptyDraft, profileOptions } from "../lib/assessment/persistence";
import { questions } from "../lib/assessment/questions";
import { diagnose } from "../lib/assessment/diagnostics";
import { DataError } from "../lib/server/db/errors";
import { diagnosePlatformAdmin } from "../lib/server/services/platform-admin-diagnostic";
const pg = new PGlite(),
  db = drizzle(pg, { schema: S });
let admin: string,
  owner: string,
  outsider: string,
  organizationId: string,
  foreignId: string;
const previousAdmins = process.env.PLATFORM_ADMIN_EMAILS;
const forbidden = (e: any) => e.code === "Forbidden";
const context = () => resolveOrganizationContext(db, owner, organizationId);
const access = (
  tier: "full_access" | "assessment_only",
  previousTier: "full_access" | "assessment_only",
) =>
  changeAccess(db, admin, {
    organizationId,
    tier,
    previousTier,
    confirmed: true,
    reason: "Synthetic QA",
  });
before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  const rows = await db
    .insert(S.users)
    .values([
      { name: "Platform QA", email: "platform@build8a.example.invalid" },
      { name: "Customer QA", email: "customer@build8a.example.invalid" },
      { name: "Other QA", email: "other@build8a.example.invalid" },
    ])
    .returning();
  [admin, owner, outsider] = rows.map((u) => u.id);
  process.env.PLATFORM_ADMIN_EMAILS = " PLATFORM@BUILD8A.EXAMPLE.INVALID ";
  organizationId = (
    await createOrganizationWithOwner(db, owner, {
      name: "QA assessment customer",
      slug: "qa-assessment",
    })
  ).organization.id;
  foreignId = (
    await createOrganizationWithOwner(db, outsider, {
      name: "QA foreign customer",
      slug: "qa-foreign",
    })
  ).organization.id;
});
after(async () => {
  if (previousAdmins === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
  else process.env.PLATFORM_ADMIN_EMAILS = previousAdmins;
  await pg.close();
});
test("existing organizations are preserved, while migration changes future default", async () => {
  const isolated = new PGlite();
  try {
    await isolated.exec(
      "CREATE TABLE users(id uuid PRIMARY KEY); CREATE TABLE organizations(id uuid PRIMARY KEY); INSERT INTO organizations(id) VALUES ('11111111-1111-4111-8111-111111111111');",
    );
    const migration = readMigrationFiles({ migrationsFolder: "drizzle" }).at(
      -1,
    )!;
    await isolated.exec(migration.sql.join("\n"));
    assert.equal(
      (
        await isolated.query<{ access_tier: string }>(
          "SELECT access_tier FROM organizations",
        )
      ).rows[0].access_tier,
      "full_access",
    );
    await isolated.exec(
      "INSERT INTO organizations(id) VALUES ('22222222-2222-4222-8222-222222222222')",
    );
    assert.equal(
      (
        await isolated.query<{ access_tier: string }>(
          "SELECT access_tier FROM organizations WHERE id='22222222-2222-4222-8222-222222222222'",
        )
      ).rows[0].access_tier,
      "assessment_only",
    );
    assert.equal(
      (await isolated.query("SELECT * FROM platform_audit")).rows.length,
      1,
    );
  } finally {
    await isolated.close();
  }
});
test("new normal organization defaults assessment-only independent of Owner role", async () => {
  const c = await context();
  assert.equal(c.accessTier, "assessment_only");
  assert.ok(c.roles?.some((r) => r.name === "Owner"));
  assert.ok(c.permissions.includes("organization.update"));
  assert.ok(!c.permissions.includes("system.view"));
});
test("organization Owner is not Platform Admin", async () => {
  await assert.rejects(requirePlatformAdmin(db, owner), forbidden);
});
test("server allowlist normalization authorizes platform operator", async () => {
  assert.equal((await requirePlatformAdmin(db, admin)).id, admin);
});
test("persisted email normalization is enforced by the database", async () => {
  await assert.rejects(db.update(S.users).set({ email: " Platform@Build8A.Example.Invalid " }).where(eq(S.users.id, admin)));
  assert.equal((await requirePlatformAdmin(db, admin)).id, admin);
});
test("diagnostic reports only five booleans for the authenticated operator", async () => {
  const result = await diagnosePlatformAdmin(async () => ({ db, user: { id: admin, email: "platform@build8a.example.invalid" } }));
  assert.equal(result.status, 200);
  assert.deepEqual(result.diagnostic, { routeExists: true, authenticated: true, sessionEmailPresent: true, platformAdminEnvPresent: true, isPlatformAdmin: true });
});
test("diagnostic distinguishes an authenticated non-admin", async () => {
  const result = await diagnosePlatformAdmin(async () => ({ db, user: { id: owner, email: "customer@build8a.example.invalid" } }));
  assert.equal(result.diagnostic.authenticated, true);
  assert.equal(result.diagnostic.isPlatformAdmin, false);
});
test("diagnostic distinguishes unauthenticated requests", async () => {
  const result = await diagnosePlatformAdmin(async () => { throw new DataError("Forbidden", 401); });
  assert.equal(result.status, 200);
  assert.equal(result.diagnostic.authenticated, false);
  assert.equal(result.diagnostic.sessionEmailPresent, false);
});
test("diagnostic observes missing runtime environment without caching it", async () => {
  const previous = process.env.PLATFORM_ADMIN_EMAILS;
  try {
    process.env.PLATFORM_ADMIN_EMAILS = " ,  ";
    const result = await diagnosePlatformAdmin(async () => ({ db, user: { id: admin, email: "platform@build8a.example.invalid" } }));
    assert.equal(result.diagnostic.platformAdminEnvPresent, false);
    assert.equal(result.diagnostic.isPlatformAdmin, false);
    process.env.PLATFORM_ADMIN_EMAILS = " PLATFORM@BUILD8A.EXAMPLE.INVALID ";
    const restored = await diagnosePlatformAdmin(async () => ({ db, user: { id: admin, email: "platform@build8a.example.invalid" } }));
    assert.equal(restored.diagnostic.isPlatformAdmin, true);
  } finally { if (previous === undefined) delete process.env.PLATFORM_ADMIN_EMAILS; else process.env.PLATFORM_ADMIN_EMAILS = previous; }
});
test("diagnostic handles absent email without exposing identity", async () => {
  const result = await diagnosePlatformAdmin(async () => ({ db, user: { id: owner, email: " " } }));
  assert.equal(result.diagnostic.sessionEmailPresent, false);
  assert.equal(result.diagnostic.isPlatformAdmin, false);
});
test("diagnostic infrastructure failure returns 503 and never exposes error details", async () => {
  const result = await diagnosePlatformAdmin(async () => { throw Error("sensitive simulated connection details"); });
  assert.equal(result.status, 503);
  assert.ok(Object.values(result.diagnostic).every(value => typeof value === "boolean"));
  assert.ok(!JSON.stringify(result).includes("sensitive"));
});
test("unknown identity cannot acquire platform permissions", async () => {
  await assert.rejects(requirePlatformAdmin(db, randomUUID()), forbidden);
});
for (const permission of [
  "system.view",
  "strategy.view",
  "scale.view",
  "agent.view",
  "agent.ask",
] as const)
  test("assessment-only denies " + permission, async () => {
    await assert.rejects(
      reauthorize(db, await context(), permission),
      forbidden,
    );
  });
test("assessment is available but premium workspace data is masked", async () => {
  const w = await readTenantWorkspace(db, await context());
  assert.ok(w.stores["growth-engine.assessment.v2"]);
  assert.equal(w.stores["growth-engine.system.v1"], null);
  assert.equal(w.stores["growth-engine.agent.workspace.v1"], null);
});
test("assessment-only user cannot read premium domain directly", async () => {
  await assert.rejects(
    new SystemDomainService(db).read(await context()),
    forbidden,
  );
});
test("forged tier and permissions cannot bypass fresh server reauthorization", async () => {
  const c = {
    ...(await context()),
    accessTier: "full_access" as const,
    permissions: ["system.view", "organization.view"],
  };
  await assert.rejects(reauthorize(db, c, "system.view"), forbidden);
});
test("new customer can complete assessment and lead scores use existing formulas", async () => {
  const c = await context(),
    w = await readTenantWorkspace(db, c),
    draft = emptyDraft();
  draft.profile = {
    name: "Synthetic QA",
    industry: "QA",
    model: profileOptions.model[0],
    teamSize: profileOptions.teamSize[0],
    revenue: profileOptions.revenue[0],
    stage: profileOptions.stage[0],
  };
  for (const q of questions) draft.answers[q.id] = 3;
  draft.completedAt = new Date().toISOString();
  draft.screen = "results";
  await writeTenantWorkspace(db, c, {
    ...w,
    stores: {
      ...w.stores,
      "growth-engine.assessment.v2": JSON.stringify(draft),
    },
  });
  const overview = await platformOverview(db, admin),
    lead = overview.assessments.find((a) => a.userId === owner)!;
  assert.equal(lead.completionPercentage, 100);
  assert.equal(lead.status, "completed");
  assert.deepEqual(lead.result, diagnose(draft.answers));
  assert.equal(lead.organizationId, organizationId);
});
test("incomplete data never invents scores or completion", () => {
  const summary = assessmentSummary(JSON.stringify(emptyDraft()));
  assert.equal(summary.result, null);
  assert.equal(summary.completionPercentage, 0);
  assert.equal(summary.completedAt, null);
});
test("access request repeats return one active organization request", async () => {
  const c = await context(),
    a = await requestAccess(db, c),
    b = await requestAccess(db, c);
  assert.equal(a.id, b.id);
  assert.equal(
    (
      await db
        .select()
        .from(S.platformAccessRequests)
        .where(eq(S.platformAccessRequests.organizationId, organizationId))
    ).length,
    1,
  );
});
test("cross-tenant context forged for access request is rejected", async () => {
  await assert.rejects(
    requestAccess(db, { ...(await context()), organizationId: foreignId }),
    forbidden,
  );
});
test("normal owner cannot grant itself full access", async () => {
  await assert.rejects(
    changeAccess(db, owner, {
      organizationId,
      tier: "full_access",
      previousTier: "assessment_only",
      confirmed: true,
    }),
    forbidden,
  );
});
test("access mutation requires explicit confirmation", async () => {
  await assert.rejects(
    changeAccess(db, admin, {
      organizationId,
      tier: "full_access",
      previousTier: "assessment_only",
      confirmed: false,
    }),
    (e) => (e as any).code === "InvalidInput",
  );
});
test("approval grants full access and records actor before after target and reason", async () => {
  const [request] = await db
    .select()
    .from(S.platformAccessRequests)
    .where(eq(S.platformAccessRequests.organizationId, organizationId));
  await changeAccess(db, admin, {
    organizationId,
    tier: "full_access",
    previousTier: "assessment_only",
    confirmed: true,
    requestId: request.id,
    reason: "QA approved",
  });
  const c = await context();
  assert.equal(c.accessTier, "full_access");
  assert.ok(c.permissions.includes("system.view"));
  const [event] = await db
    .select()
    .from(S.platformAudit)
    .where(eq(S.platformAudit.organizationId, organizationId));
  assert.equal(event.actorUserId, admin);
  assert.equal(event.previousTier, "assessment_only");
  assert.equal(event.newTier, "full_access");
  assert.equal(event.reason, "QA approved");
  assert.ok(event.createdAt);
  assert.equal(
    (
      await db
        .select()
        .from(S.platformAccessRequests)
        .where(eq(S.platformAccessRequests.id, request.id))
    )[0].status,
    "approved",
  );
});
test("stale confirmation cannot overwrite a concurrent access decision", async () => {
  await assert.rejects(
    access("assessment_only", "assessment_only"),
    (e) => (e as any).code === "Conflict",
  );
});
test("full access still enforces tenant isolation", async () => {
  await assert.rejects(
    new SystemDomainService(db).read({
      ...(await context()),
      organizationId: foreignId,
    }),
    forbidden,
  );
});
test("revocation applies to an old context without deleting assessment data", async () => {
  const old = await context();
  await access("assessment_only", "full_access");
  await assert.rejects(reauthorize(db, old, "system.view"), forbidden);
  const w = await readTenantWorkspace(db, await context());
  assert.ok(JSON.parse(w.stores["growth-engine.assessment.v2"]!).completedAt);
  assert.equal(
    (await platformOverview(db, admin)).assessments.filter(
      (a) => a.userId === owner,
    ).length,
    1,
  );
});
test("rejection records a decision without granting access", async () => {
  const request = await requestAccess(db, await context());
  await changeAccess(db, admin, {
    organizationId,
    tier: "assessment_only",
    previousTier: "assessment_only",
    confirmed: true,
    requestId: request.id,
    reject: true,
  });
  assert.equal((await context()).accessTier, "assessment_only");
  assert.equal(
    (
      await db
        .select()
        .from(S.platformAccessRequests)
        .where(eq(S.platformAccessRequests.id, request.id))
    )[0].status,
    "rejected",
  );
});
test("request target cannot be swapped to another organization", async () => {
  const request = await requestAccess(db, await context());
  await assert.rejects(
    changeAccess(db, admin, {
      organizationId: foreignId,
      tier: "full_access",
      previousTier: "assessment_only",
      confirmed: true,
      requestId: request.id,
    }),
    (e) => (e as any).code === "Conflict",
  );
  assert.equal(
    (
      await db
        .select()
        .from(S.organizations)
        .where(eq(S.organizations.id, foreignId))
    )[0].accessTier,
    "assessment_only",
  );
});
test("dedicated admin projection never exposes authentication credentials or sessions", async () => {
  const output = await platformOverview(db, admin);
  assert.equal(output.totals.users, 3);
  const serialized = JSON.stringify(output);
  for (const key of [
    "passwordHash",
    "password_hash",
    "authSessions",
    "authAccounts",
    "sessionToken",
    "apiKey",
    "databaseUrl",
  ])
    assert.ok(!serialized.includes(key));
});
test("suspended operator loses platform privileges", async () => {
  await db
    .update(S.users)
    .set({ status: "Suspended" })
    .where(eq(S.users.id, admin));
  await assert.rejects(platformOverview(db, admin), forbidden);
  await db
    .update(S.users)
    .set({ status: "Active" })
    .where(eq(S.users.id, admin));
});
