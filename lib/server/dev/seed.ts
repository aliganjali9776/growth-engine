import "server-only";
import { and, eq } from "drizzle-orm";
import type { Database } from "../db/types";
import * as S from "../db/schema";
import { createOrganizationWithOwner } from "../services/organization";
import { resolveOrganizationContext } from "../context";
import { StrategyService } from "../services/domains";
export async function seedDevelopment(db: Database) {
  return db.transaction((tx) => seedRows(tx));
}
async function seedRows(db: Database) {
  const accounts = await db
    .insert(S.users)
    .values([
      { email: "ali@development.example.invalid", name: "Ali — development" },
      {
        email: "manager@development.example.invalid",
        name: "Manager — development",
      },
    ])
    .onConflictDoNothing()
    .returning();
  const all = await db
    .select()
    .from(S.users)
    .where(eq(S.users.status, "Active"));
  const ali = all.find((u) => u.email === "ali@development.example.invalid")!,
    manager = all.find(
      (u) => u.email === "manager@development.example.invalid",
    )!;
  if (!ali || !manager) throw Error("DevelopmentAccountUnavailable");
  async function company(userId: string, name: string, slug: string) {
    const [old] = await db
      .select()
      .from(S.organizations)
      .where(eq(S.organizations.slug, slug));
    if (old) return old;
    const made = await createOrganizationWithOwner(db, userId, { name, slug });
    // Newly created disposable demo customers explicitly exercise full modules.
    const [enabled] = await db.update(S.organizations).set({accessTier:"full_access"}).where(eq(S.organizations.id,made.organization.id)).returning();
    return enabled;
  }
  const alpha = await company(
      ali.id,
      "Company Alpha — development",
      "dev-alpha",
    ),
    beta = await company(manager.id, "Company Beta — development", "dev-beta");
  for (const [organization, userId, roleName] of [
    [alpha, manager.id, "Manager"],
    [beta, ali.id, "Consultant"],
  ] as const) {
    await db
      .insert(S.memberships)
      .values({
        organizationId: organization.id,
        userId,
        status: "Active",
        joinedAt: new Date(),
      })
      .onConflictDoNothing();
    const [m] = await db
      .select()
      .from(S.memberships)
      .where(
        and(
          eq(S.memberships.organizationId, organization.id),
          eq(S.memberships.userId, userId),
        ),
      );
    const [role] = await db
      .select()
      .from(S.accessRoles)
      .where(
        and(
          eq(S.accessRoles.organizationId, organization.id),
          eq(S.accessRoles.name, roleName),
        ),
      );
    await db
      .insert(S.membershipRoles)
      .values({
        organizationId: organization.id,
        membershipId: m.id,
        roleId: role.id,
      })
      .onConflictDoNothing();
  }
  for (const org of [alpha, beta]) {
    const [existing] = await db
      .select()
      .from(S.strategyCycles)
      .where(eq(S.strategyCycles.organizationId, org.id));
    if (existing) continue;
    const [d] = await db
      .insert(S.departments)
      .values({ organizationId: org.id, name: "Sales" })
      .returning();
    const [role] = await db
      .insert(S.businessRoles)
      .values({
        organizationId: org.id,
        title: "Sales Manager",
        departmentId: d.id,
      })
      .returning();
    const [process] = await db
      .insert(S.processes)
      .values({
        organizationId: org.id,
        code: "P001",
        name: "Development sales process",
        valueChain: "sales",
        departmentId: d.id,
        ownerRoleId: role.id,
        frequency: 2,
        impact: 2,
        variation: 2,
        dependency: 2,
        founderDependency: "medium",
      })
      .returning();
    const [cycle] = await db
      .insert(S.strategyCycles)
      .values({
        organizationId: org.id,
        name: "Development cycle",
        startDate: "2026-10-01",
        endDate: "2026-12-31",
        ownerRoleId: role.id,
      })
      .returning();
    const context = await resolveOrganizationContext(
      db,
      org.id === alpha.id ? ali.id : manager.id,
      org.id,
    );
    await new StrategyService(db).createDraft(
      context,
      {
        cycleId: cycle.id,
        code: "O1",
        title: "Revenue foundation — " + org.name,
        startDate: "2026-10-01",
        deadline: "2026-12-31",
      },
      "seed-objective",
    );
    const [constraint] = await db
      .insert(S.constraints)
      .values({
        organizationId: org.id,
        title: "Development leads gap",
        dimension: "acquisition",
        severity: "medium",
        processId: process.id,
        ownerRoleId: role.id,
      })
      .returning();
    await db
      .insert(S.experiments)
      .values({
        organizationId: org.id,
        constraintId: constraint.id,
        ownerRoleId: role.id,
        code: "E1",
        title: "Development experiment",
        hypothesis: "Observe qualified leads",
      });
  }
  return {
    actorUserId: ali.id,
    alphaId: alpha.id,
    betaId: beta.id,
    createdAccounts: accounts.length,
  };
}
