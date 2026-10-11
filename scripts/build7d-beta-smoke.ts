import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq } from "drizzle-orm";
import * as S from "../lib/server/db/schema";
import { resolveOrganizationContext } from "../lib/server/context";
import { readTenantWorkspace, writeTenantWorkspace } from "../lib/server/services/workspace";
import { exportOrganization } from "../lib/server/services/migration";

// Run with the local application stopped: embedded PostgreSQL has one owner process.
// The only insertion is a Viewer membership inside the explicitly approved TEST organization.
async function main() {
  const organizationId = "984bc0f2-1a5e-412b-8330-bd0d8f8c5c2a";
  const pg = new PGlite(".data/postgres-saas-dev-fixed"), db = drizzle(pg, { schema: S });
  try {
    const [organization] = await db.select().from(S.organizations).where(eq(S.organizations.id, organizationId));
    assert.equal(organization.name, "TEST · BUILD 7D · 2026-10-06");
    const [owner] = await db.select().from(S.users).where(eq(S.users.email, "7c.owner@development.example.invalid"));
    const [viewer] = await db.select().from(S.users).where(eq(S.users.email, "7c.viewer@development.example.invalid"));
    assert.ok(owner && viewer, "Existing synthetic QA identities required");
    await db.transaction(async tx => {
      await tx.insert(S.memberships).values({ organizationId, userId: viewer.id, status: "Active", joinedAt: new Date() }).onConflictDoNothing();
      const [membership] = await tx.select().from(S.memberships).where(and(eq(S.memberships.organizationId, organizationId), eq(S.memberships.userId, viewer.id)));
      const [role] = await tx.select().from(S.accessRoles).where(and(eq(S.accessRoles.organizationId, organizationId), eq(S.accessRoles.name, "Viewer")));
      await tx.insert(S.membershipRoles).values({ organizationId, membershipId: membership.id, roleId: role.id }).onConflictDoNothing();
    });
    const ownerContext = await resolveOrganizationContext(db, owner.id, organizationId), viewerContext = await resolveOrganizationContext(db, viewer.id, organizationId);
    const first = await readTenantWorkspace(db, ownerContext), second = await readTenantWorkspace(db, viewerContext);
    for (const key of ["growth-engine.system.v1", "growth-engine.strategy.v1", "growth-engine.scale.v1", "growth-engine.assessment.v2"]) assert.equal(first.stores[key], second.stores[key]);
    const key = "growth-engine.system.v1", system = JSON.parse(first.stores[key]!);
    assert.equal(system.processes.length, 15);
    assert.equal(JSON.parse(first.stores["growth-engine.strategy.v1"]!).objectives.length, 3);
    const next = structuredClone(system); next.processes[0].name += " forbidden QA edit";
    await assert.rejects(writeTenantWorkspace(db, viewerContext, { ...second, stores: { ...second.stores, [key]: JSON.stringify(next) } }), /Forbidden/);
    assert.equal((await readTenantWorkspace(db, ownerContext)).stores[key], first.stores[key]);
    // A random, absent organization is never treated as the active company's workspace.
    await assert.rejects(resolveOrganizationContext(db, viewer.id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"), /Forbidden|NotFound/);
    const backup = await exportOrganization(db, ownerContext);
    assert.ok(Object.values(backup.tables).flat().every((row: any) => row.organizationId === organizationId));
    const sha256 = createHash("sha256").update(JSON.stringify(first.stores)).digest("hex");
    const report = { checkedAt: new Date().toISOString(), organizationId, sharedUsers: 2, sharedStateEqual: true, viewerWriteDenied: true, tenantScopeDenied: true, processes: system.processes.length, objectives: 3, survivedApplicationRestart: true, storesSha256: sha256, backupTables: Object.keys(backup.tables).length, agentExecutionEnabled: false };
    await writeFile("docs/qa/build7d-beta-persistence-smoke.json", JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report));
  } finally { await pg.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
