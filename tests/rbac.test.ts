import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import * as S from "../lib/server/db/schema";
import {
  defaultRolePermissions,
  permissionKeys,
  permissionForPage,
} from "../lib/server/permissions";
import { createOrganizationWithOwner } from "../lib/server/services/organization";
import {
  resolveOrganizationContext,
  requireAllPermissions,
  requireAnyPermission,
  requireResourceScope,
} from "../lib/server/context";
import { authorizeWorkspaceChange } from "../lib/server/services/workspace-permissions";
import { readTenantWorkspace } from "../lib/server/services/workspace";
import {
  prepareAgentAction,
  approveAgentAction,
  authorizeAgentExecution,
} from "../lib/server/services/agent-authorization";
import { changeMember } from "../lib/server/services/companies";
const pg = new PGlite(),
  db = drizzle(pg, { schema: S });
let org: string, otherOrg: string;
const users: Record<string, string> = {};
before(async () => {
  await migrate(db, { migrationsFolder: "drizzle" });
  for (const role of Object.keys(defaultRolePermissions)) {
    const [u] = await db
      .insert(S.users)
      .values({
        email: role.toLowerCase() + "@rbac.example.invalid",
        name: role,
        status: "Active",
      })
      .returning();
    users[role] = u.id;
  }
  org = (
    await createOrganizationWithOwner(db, users.Owner, {
      name: "RBAC Alpha",
      slug: "rbac-alpha",
    })
  ).organization.id;
  otherOrg = (
    await createOrganizationWithOwner(db, users.Owner, {
      name: "RBAC Beta",
      slug: "rbac-beta",
    })
  ).organization.id;
  for (const role of Object.keys(users).filter((r) => r !== "Owner")) {
    const [m] = await db
      .insert(S.memberships)
      .values({ organizationId: org, userId: users[role], status: "Active" })
      .returning();
    const [r] = await db
      .select()
      .from(S.accessRoles)
      .where(
        and(
          eq(S.accessRoles.organizationId, org),
          eq(S.accessRoles.name, role),
        ),
      );
    await db
      .insert(S.membershipRoles)
      .values({ organizationId: org, membershipId: m.id, roleId: r.id });
  }
  await readTenantWorkspace(db, await context("Owner"));
});
after(async () => pg.close());
const context = (role: string) =>
  resolveOrganizationContext(db, users[role], org);
const code = (c: string) => (e: any) => e.code === c;
async function denyChange(
  role: string,
  key: string,
  oldRaw: string | null,
  newRaw: string,
  check: (e: any) => boolean,
) {
  const c = await context(role);
  assert.throws(() => authorizeWorkspaceChange(c, key, oldRaw, newRaw), check);
}
for (const role of Object.keys(defaultRolePermissions))
  test(`matrix ${role} resolves exact fresh database grants`, async () =>
    assert.deepEqual(
      (await context(role)).permissions,
      [...defaultRolePermissions[role]].sort(),
    ));
for (const module of ["system", "strategy", "scale"] as const)
  test(`Viewer cannot write ${module}`, async () =>
    denyChange(
      "Viewer",
      `growth-engine.${module}.v1`,
      null,
      "{}",
      code("Forbidden"),
    ));
for (const role of ["Consultant", "Manager", "Editor", "Viewer"])
  test(`${role} cannot approve or execute Agent`, async () => {
    const c = await context(role);
    await assert.rejects(
      requireAllPermissions(db, c, ["agent.approve"]),
      code("Forbidden"),
    );
    await assert.rejects(
      requireAllPermissions(db, c, ["agent.execute"]),
      code("Forbidden"),
    );
  });
for (const role of ["Manager", "Editor", "Viewer"])
  test(`${role} cannot manage access roles`, async () =>
    assert.rejects(
      requireAllPermissions(db, await context(role), ["roles.manage"]),
      code("Forbidden"),
    ));
test("Editor KR target change denied", async () =>
  denyChange(
    "Editor",
    "growth-engine.strategy.v1",
    JSON.stringify({ keyResults: [{ id: "kr", targetValue: 10 }] }),
    JSON.stringify({ keyResults: [{ id: "kr", targetValue: 20 }] }),
    code("Forbidden"),
  ));
test("Editor SOP approval denied", async () =>
  denyChange(
    "Editor",
    "growth-engine.process-standards.v1",
    null,
    JSON.stringify({
      records: [{ processId: "p", sop: { status: "approved" } }],
    }),
    code("Forbidden"),
  ));
test("Editor cycle management denied", async () =>
  denyChange(
    "Editor",
    "growth-engine.strategy.v1",
    null,
    JSON.stringify({ cycles: [{ id: "c" }] }),
    code("Forbidden"),
  ));
test("Editor Scale decision denied", async () =>
  denyChange(
    "Editor",
    "growth-engine.scale.v1",
    null,
    JSON.stringify({ readinessData: { decisions: [{ id: "d" }] } }),
    code("Forbidden"),
  ));
test("unaffiliated tenant rejected", async () =>
  assert.rejects(
    resolveOrganizationContext(db, users.Editor, otherOrg),
    code("Forbidden"),
  ));
test("resource scope denies foreign tenant", async () => {
  const c = await context("Owner");
  assert.throws(
    () =>
      requireResourceScope(
        c,
        { kind: "AllOrganization" },
        { organizationId: otherOrg, id: "foreign" },
      ),
    code("NotFound"),
  );
});
test("own-record scope denies another creator", async () => {
  const c = await context("Editor");
  assert.throws(
    () =>
      requireResourceScope(
        c,
        { kind: "OwnRecords" },
        { organizationId: org, id: "record", createdByUserId: users.Owner },
      ),
    code("NotFound"),
  );
});
test("assigned scope rejects unassigned id", async () => {
  const c = await context("Editor");
  assert.throws(
    () =>
      requireResourceScope(
        c,
        { kind: "AssignedResources", resourceIds: ["allowed"] },
        { organizationId: org, id: "other" },
      ),
    code("NotFound"),
  );
});
test("any permissions fail on empty grants", async () =>
  assert.rejects(
    requireAnyPermission(db, await context("Viewer"), [
      "system.edit",
      "strategy.edit",
    ]),
    code("Forbidden"),
  ));
test("client forged permissions are re-resolved", async () =>
  assert.rejects(
    requireAllPermissions(
      db,
      { ...(await context("Viewer")), permissions: permissionKeys },
      ["agent.execute"],
    ),
    code("Forbidden"),
  ));
test("page guards map nested modules and audit", () => {
  assert.equal(permissionForPage("/strategy/key-results"), "strategy.view");
  assert.equal(
    permissionForPage("/advisor/actions/history"),
    "agent.audit.view",
  );
});
test("Consultant prepares, Owner approves, executor stays disabled", async () => {
  const action = await prepareAgentAction(db, await context("Consultant"), {
    capabilityId: "strategy.createInitiative",
    title: "Consulting proposal",
    payload: { title: "Draft" },
  });
  assert.equal(action.requestedByUserId, users.Consultant);
  await assert.rejects(
    approveAgentAction(db, await context("Consultant"), {
      actionId: action.id,
      revision: 1,
      decision: "Approved",
    }),
    code("Forbidden"),
  );
  const approval = await approveAgentAction(db, await context("Owner"), {
    actionId: action.id,
    revision: 1,
    decision: "Approved",
  });
  assert.equal(approval.approvedByUserId, users.Owner);
  await assert.rejects(
    authorizeAgentExecution(db, await context("Owner"), {
      actionId: action.id,
      approvalId: approval.id,
      explicitExecute: true,
    }),
    code("Disabled"),
  );
  const audit = await db
    .select()
    .from(S.auditEvents)
    .where(eq(S.auditEvents.entityId, action.id));
  assert.equal(audit.length, 2);
  assert.equal(audit[0].actorUserId, users.Consultant);
  assert.equal(audit[1].actorUserId, users.Owner);
});
test("Viewer prepare rejected", async () =>
  assert.rejects(
    prepareAgentAction(db, await context("Viewer"), {
      capabilityId: "strategy.createInitiative",
      title: "Forbidden",
      payload: {},
    }),
    code("Forbidden"),
  ));
test("unknown capability rejected", async () =>
  assert.rejects(
    prepareAgentAction(db, await context("Owner"), {
      capabilityId: "arbitrary.execute",
      title: "Forbidden",
      payload: {},
    }),
    code("Disabled"),
  ));
test("cross-tenant action id hidden", async () => {
  const action = await prepareAgentAction(db, await context("Consultant"), {
    capabilityId: "strategy.createInitiative",
    title: "Scoped draft",
    payload: {},
  });
  const beta = await resolveOrganizationContext(db, users.Owner, otherOrg);
  await assert.rejects(
    approveAgentAction(db, beta, {
      actionId: action.id,
      revision: 1,
      decision: "Approved",
    }),
    code("NotFound"),
  );
});
test("role change invalidates captured context and audit has old/new roles", async () => {
  const stale = await context("Editor");
  const updated = await changeMember(db, await context("Owner"), {
    membershipId: stale.membershipId,
    version: 1,
    role: "Viewer",
  });
  await assert.rejects(
    requireAllPermissions(db, stale, ["strategy.edit"]),
    code("Forbidden"),
  );
  const events = await db
    .select()
    .from(S.auditEvents)
    .where(eq(S.auditEvents.entityId, stale.membershipId));
  assert.deepEqual((events.at(-1)!.metadata as any).oldRoles, ["Editor"]);
  assert.deepEqual((events.at(-1)!.metadata as any).newRoles, ["Viewer"]);
  await changeMember(db, await context("Owner"), {
    membershipId: stale.membershipId,
    version: updated.version,
    status: "Suspended",
  });
  await assert.rejects(context("Editor"), code("Forbidden"));
});

test("Agent preparation requires target-domain permission", async () => {
  const c = await context("Consultant");
  const [r] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, org),
        eq(S.accessRoles.name, "Consultant"),
      ),
    );
  await db
    .delete(S.rolePermissions)
    .where(
      and(
        eq(S.rolePermissions.roleId, r.id),
        eq(S.rolePermissions.permissionKey, "strategy.create"),
      ),
    );
  await assert.rejects(
    prepareAgentAction(db, c, {
      capabilityId: "strategy.createInitiative",
      title: "Denied",
      payload: {},
    }),
    code("Forbidden"),
  );
  await db.insert(S.rolePermissions).values({
    organizationId: org,
    roleId: r.id,
    permissionKey: "strategy.create",
  });
});
test("execution rechecks revoked target permission after approval", async () => {
  const c = await context("Owner");
  const action = await prepareAgentAction(db, c, {
    capabilityId: "strategy.createInitiative",
    title: "Revocation test",
    payload: {},
  });
  const a = await approveAgentAction(db, c, {
    actionId: action.id,
    revision: 1,
    decision: "Approved",
  });
  const [role] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, org),
        eq(S.accessRoles.name, "Owner"),
      ),
    );
  await db
    .delete(S.rolePermissions)
    .where(
      and(
        eq(S.rolePermissions.roleId, role.id),
        eq(S.rolePermissions.permissionKey, "strategy.create"),
      ),
    );
  await assert.rejects(
    authorizeAgentExecution(db, c, {
      actionId: action.id,
      approvalId: a.id,
      explicitExecute: true,
    }),
    code("Forbidden"),
  );
  await db.insert(S.rolePermissions).values({
    organizationId: org,
    roleId: role.id,
    permissionKey: "strategy.create",
  });
});
test("last Owner cannot be demoted", async () => {
  const c = await context("Owner");
  await assert.rejects(
    changeMember(db, c, {
      membershipId: c.membershipId,
      version: 1,
      role: "Viewer",
    }),
    code("Conflict"),
  );
});
test("restricted module documents are masked", async () => {
  const c = await context("Viewer");
  const [role] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, org),
        eq(S.accessRoles.name, "Viewer"),
      ),
    );
  await db
    .delete(S.rolePermissions)
    .where(
      and(
        eq(S.rolePermissions.roleId, role.id),
        eq(S.rolePermissions.permissionKey, "system.view"),
      ),
    );
  const workspace = await readTenantWorkspace(db, c);
  assert.equal(workspace.stores["growth-engine.system.v1"], null);
  await db.insert(S.rolePermissions).values({
    organizationId: org,
    roleId: role.id,
    permissionKey: "system.view",
  });
});
test("Editor can manually create an ordinary Initiative without Agent execute", async () => {
  const [role] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, org),
        eq(S.accessRoles.name, "Editor"),
      ),
    );
  const [u] = await db
    .insert(S.users)
    .values({
      name: "Manual editor",
      email: "manual-editor@rbac.example.invalid",
    })
    .returning();
  const [m] = await db
    .insert(S.memberships)
    .values({ organizationId: org, userId: u.id, status: "Active" })
    .returning();
  await db
    .insert(S.membershipRoles)
    .values({ organizationId: org, membershipId: m.id, roleId: role.id });
  const c = await resolveOrganizationContext(db, u.id, org);
  authorizeWorkspaceChange(
    c,
    "growth-engine.strategy.v1",
    JSON.stringify({ initiatives: [] }),
    JSON.stringify({
      initiatives: [
        { id: "new", title: "Ordinary initiative", status: "planned" },
      ],
    }),
  );
  assert.equal(c.permissions.includes("agent.execute"), false);
});
test("approval requires target module approval in addition to Agent approval", async () => {
  const c = await context("Owner");
  const action = await prepareAgentAction(db, c, {
    capabilityId: "strategy.createInitiative",
    title: "Module approval",
    payload: {},
  });
  const [role] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, org),
        eq(S.accessRoles.name, "Owner"),
      ),
    );
  await db
    .delete(S.rolePermissions)
    .where(
      and(
        eq(S.rolePermissions.roleId, role.id),
        eq(S.rolePermissions.permissionKey, "strategy.approve"),
      ),
    );
  await assert.rejects(
    approveAgentAction(db, c, {
      actionId: action.id,
      revision: 1,
      decision: "Approved",
    }),
    code("Forbidden"),
  );
  await db.insert(S.rolePermissions).values({
    organizationId: org,
    roleId: role.id,
    permissionKey: "strategy.approve",
  });
});
test("approval refuses a proposal after shared business state changes", async () => {
  const c = await context("Owner");
  const action = await prepareAgentAction(db, c, {
    capabilityId: "strategy.createInitiative",
    title: "Freshness check",
    payload: {},
  });
  const [workspace] = await db
    .select()
    .from(S.tenantWorkspaces)
    .where(
      and(
        eq(S.tenantWorkspaces.organizationId, org),
        eq(S.tenantWorkspaces.ownerKey, "shared"),
      ),
    );
  await db
    .update(S.tenantWorkspaces)
    .set({ version: workspace.version + 1 })
    .where(eq(S.tenantWorkspaces.id, workspace.id));
  await assert.rejects(
    approveAgentAction(db, c, {
      actionId: action.id,
      revision: 1,
      decision: "Approved",
    }),
    code("Conflict"),
  );
});
test("delegated member role permission cannot assign a more powerful role", async () => {
  const c = await context("Manager");
  const [role] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, org),
        eq(S.accessRoles.name, "Manager"),
      ),
    );
  await db
    .insert(S.rolePermissions)
    .values({
      organizationId: org,
      roleId: role.id,
      permissionKey: "members.change_role",
    });
  const target = await context("Viewer");
  await assert.rejects(
    changeMember(db, c, {
      membershipId: target.membershipId,
      version: 1,
      role: "Admin",
    }),
    code("Forbidden"),
  );
  await db
    .delete(S.rolePermissions)
    .where(
      and(
        eq(S.rolePermissions.roleId, role.id),
        eq(S.rolePermissions.permissionKey, "members.change_role"),
      ),
    );
});
