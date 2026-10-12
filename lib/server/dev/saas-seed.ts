import "server-only";
import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import * as S from "../db/schema";
import type { Database } from "../db/types";
import { createCompany } from "../services/companies";
export const developmentPassword = "Development-only-password-2026";
export async function seedSaaSDevelopment(db: Database) {
  const hashed = await hashPassword(developmentPassword);
  return db.transaction(async (tx) => {
    const userIds: Record<string, string> = {};
    for (const [key, name] of [
      ["ali", "علی · آزمایشی"],
      ["sara", "سارا · آزمایشی"],
      ["viewer", "مشاهده‌گر · آزمایشی"],
    ]) {
      const email = key + "@development.example.invalid";
      await tx.insert(S.users).values({ email, name }).onConflictDoNothing();
      const [user] = await tx
        .select()
        .from(S.users)
        .where(eq(S.users.email, email));
      userIds[key] = user.id;
      const account = await tx
        .select()
        .from(S.authAccounts)
        .where(
          and(
            eq(S.authAccounts.userId, user.id),
            eq(S.authAccounts.providerId, "credential"),
          ),
        );
      if (!account.length)
        await tx
          .insert(S.authAccounts)
          .values({
            userId: user.id,
            providerId: "credential",
            accountId: user.id,
            password: hashed,
          });
    }
    const organizations: Record<string, string> = {};
    for (const [key, name, owner] of [
      ["alpha", "شرکت آلفا · آزمایشی", "ali"],
      ["beta", "شرکت بتا · آزمایشی", "sara"],
    ]) {
      const slug = "saas-dev-" + key;
      let [org] = await tx
        .select()
        .from(S.organizations)
        .where(eq(S.organizations.slug, slug));
      if (!org) {
        const made = await createCompany(tx, userIds[owner], {
          name,
          industry: "خدمات",
          businessModel: "service",
          teamSize: "1–5",
          country: "ایران",
          currency: "IRR",
          timezone: "Asia/Tehran",
        });
        [org] = await tx
          .update(S.organizations)
          .set({ slug, accessTier: "full_access" })
          .where(eq(S.organizations.id, made.organization.id))
          .returning();
      }
      organizations[key] = org.id;
    }
    for (const [company, user, roleName] of [
      ["alpha", "sara", "Manager"],
      ["beta", "ali", "Consultant"],
      ["beta", "viewer", "Viewer"],
    ]) {
      await tx
        .insert(S.memberships)
        .values({
          organizationId: organizations[company],
          userId: userIds[user],
          status: "Active",
          joinedAt: new Date(),
        })
        .onConflictDoNothing();
      const [member] = await tx
        .select()
        .from(S.memberships)
        .where(
          and(
            eq(S.memberships.organizationId, organizations[company]),
            eq(S.memberships.userId, userIds[user]),
          ),
        );
      const [role] = await tx
        .select()
        .from(S.accessRoles)
        .where(
          and(
            eq(S.accessRoles.organizationId, organizations[company]),
            eq(S.accessRoles.name, roleName),
          ),
        );
      await tx
        .insert(S.membershipRoles)
        .values({
          organizationId: organizations[company],
          membershipId: member.id,
          roleId: role.id,
        })
        .onConflictDoNothing();
    }
    return {
      userIds,
      organizations,
      credentials: "Development-only credentials are documented in BUILD-7B.md",
    };
  });
}
