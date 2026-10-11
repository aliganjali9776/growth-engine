import "server-only";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { resolve, relative, isAbsolute } from "node:path";
import * as S from "../lib/server/db/schema";
import { createOrganizationWithOwner } from "../lib/server/services/organization";
import { accessRoleNames } from "../lib/server/permissions";
async function main() {
  const root = resolve(".data"),
    path = resolve(
      process.env.DEV_DATABASE_PATH ?? ".data/postgres-saas-dev-fixed",
    ),
    rel = relative(root, path);
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.DATABASE_DRIVER !== "pglite" ||
    rel.startsWith("..") ||
    isAbsolute(rel)
  )
    throw Error("DevelopmentDatabaseRequired");
  const pg = new PGlite(path),
    db = drizzle(pg, { schema: S });
  try {
    const password = await hashPassword("Development-only-password-2026");
    const ids: Record<string, string> = {};
    for (const role of accessRoleNames) {
      const email = `7c.${role.toLowerCase()}@development.example.invalid`;
      await db
        .insert(S.users)
        .values({
          email,
          name:
            (
              {
                Owner: "علی",
                Admin: "مدیر سیستم",
                Consultant: "سارا",
                Manager: "مدیر",
                Editor: "رضا",
                Viewer: "مینا",
              } as const
            )[role] + " · آزمون 7C",
        })
        .onConflictDoNothing();
      const [u] = await db
        .select()
        .from(S.users)
        .where(eq(S.users.email, email));
      ids[role] = u.id;
      const account = await db
        .select()
        .from(S.authAccounts)
        .where(
          and(
            eq(S.authAccounts.userId, u.id),
            eq(S.authAccounts.providerId, "credential"),
          ),
        );
      if (!account.length)
        await db.insert(S.authAccounts).values({
          userId: u.id,
          providerId: "credential",
          accountId: u.id,
          password,
        });
    }
    const orgs: Record<string, string> = {};
    for (const [key, owner] of [
      ["alpha", "Owner"],
      ["beta", "Admin"],
    ]) {
      let [org] = await db
        .select()
        .from(S.organizations)
        .where(eq(S.organizations.slug, "rbac-7c-" + key));
      if (!org)
        org = (
          await createOrganizationWithOwner(db, ids[owner], {
            name:
              key === "alpha" ? "آلفا · آزمون دسترسی" : "بتا · آزمون دسترسی",
            slug: "rbac-7c-" + key,
          })
        ).organization;
      orgs[key] = org.id;
    }
    for (const [company, user, role] of [
      ...accessRoleNames
        .filter((r) => r !== "Owner")
        .map((r) => ["alpha", r, r]),
      ["beta", "Owner", "Viewer"],
      ["beta", "Consultant", "Consultant"],
    ]) {
      await db
        .insert(S.memberships)
        .values({
          organizationId: orgs[company],
          userId: ids[user],
          status: "Active",
          joinedAt: new Date(),
        })
        .onConflictDoNothing();
      const [m] = await db
        .select()
        .from(S.memberships)
        .where(
          and(
            eq(S.memberships.organizationId, orgs[company]),
            eq(S.memberships.userId, ids[user]),
          ),
        );
      const [r] = await db
        .select()
        .from(S.accessRoles)
        .where(
          and(
            eq(S.accessRoles.organizationId, orgs[company]),
            eq(S.accessRoles.name, role),
          ),
        );
      await db
        .insert(S.membershipRoles)
        .values({
          organizationId: orgs[company],
          membershipId: m.id,
          roleId: r.id,
        })
        .onConflictDoNothing();
    }
    console.log(
      "Six isolated RBAC development users seeded; Alpha/Beta memberships ready.",
    );
  } finally {
    await pg.close();
  }
}
main().catch(() => {
  console.error("RBAC seed failed");
  process.exitCode = 1;
});
