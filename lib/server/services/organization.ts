import "server-only";
import { eq } from "drizzle-orm";
import type { Database } from "../db/types";
import {
  users,
  organizations,
  memberships,
  accessRoles,
  permissions,
  rolePermissions,
  membershipRoles,
  organizationProfiles,
  organizationSettings,
  auditEvents,
} from "../db/schema";
import { permissionKeys, defaultRolePermissions } from "../permissions";
import { DataError, safeDataError } from "../db/errors";
import { requireScope } from "../context";
export interface NewOrganization {
  name: string;
  slug: string;
  currency?: string;
  timezone?: string;
  locale?: string;
  profile?: {
    notes?: string;
    teamSize?: string;
    growthStage?: string;
    primaryMarket?: string;
    monthlyRevenueRange?: string;
  };
}
export async function createOrganizationWithOwner(
  db: Database,
  userId: string,
  input: NewOrganization,
  hooks?: { afterMembership?: () => void },
) {
  requireScope(userId);
  if (
    !input ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 160 ||
    !/^([a-z0-9]+)(-[a-z0-9]+)*$/.test(input.slug) ||
    input.slug.length > 80
  )
    throw new DataError("InvalidInput");
  if (input.currency && !/^[A-Z]{3}$/.test(input.currency))
    throw new DataError("InvalidInput");
  if (input.timezone) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: input.timezone });
    } catch {
      throw new DataError("InvalidInput");
    }
  }
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user || user.status !== "Active")
        throw new DataError("Forbidden", 403);
      const [org] = await tx
        .insert(organizations)
        .values({
          name: input.name.trim(),
          slug: input.slug,
          currency: input.currency,
          timezone: input.timezone,
        })
        .returning();
      const [member] = await tx
        .insert(memberships)
        .values({
          organizationId: org.id,
          userId,
          status: "Active",
          joinedAt: new Date(),
        })
        .returning();
      hooks?.afterMembership?.();
      await tx
        .insert(permissions)
        .values(permissionKeys.map((key) => ({ key, description: key })))
        .onConflictDoNothing();
      const roles = await tx
        .insert(accessRoles)
        .values(
          Object.keys(defaultRolePermissions).map((name) => ({
            organizationId: org.id,
            name,
            systemRole: true,
          })),
        )
        .returning();
      await tx
        .insert(rolePermissions)
        .values(
          roles.flatMap((role) =>
            defaultRolePermissions[role.name].map((permissionKey) => ({
              organizationId: org.id,
              roleId: role.id,
              permissionKey,
            })),
          ),
        );
      const owner = roles.find((r) => r.name === "Owner")!;
      await tx
        .insert(membershipRoles)
        .values({
          organizationId: org.id,
          membershipId: member.id,
          roleId: owner.id,
        });
      await tx
        .insert(organizationSettings)
        .values({
          organizationId: org.id,
          currency: org.currency,
          timezone: org.timezone,
          locale: input.locale ?? "fa-IR",
        });
      await tx
        .insert(organizationProfiles)
        .values({
          organizationId: org.id,
          notes: input.profile?.notes,
          teamSize: input.profile?.teamSize,
          growthStage: input.profile?.growthStage,
          primaryMarket: input.profile?.primaryMarket,
          monthlyRevenueRange: input.profile?.monthlyRevenueRange,
        });
      await tx
        .insert(auditEvents)
        .values({
          organizationId: org.id,
          actorUserId: userId,
          actorType: "User",
          module: "Organization",
          action: "OrganizationCreated",
          entityType: "organization",
          entityId: org.id,
          metadata: { ownerMembershipId: member.id },
        });
      return { organization: org, membership: member, ownerRoleId: owner.id };
    });
  } catch (error) {
    throw safeDataError(error);
  }
}
