import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Database } from "../db/types";
import * as S from "../db/schema";
import {
  resolveOrganizationContext,
  reauthorize,
  requireScope,
  type OrganizationContext,
} from "../context";
import { DataError } from "../db/errors";
import { createOrganizationWithOwner } from "./organization";
import { OrganizationRepository } from "../repositories/organization";
export const roleLabels: Record<string, string> = {
  Owner: "مالک",
  Admin: "مدیر سیستم",
  Consultant: "مشاور",
  Manager: "مدیر",
  Editor: "ویرایشگر",
  Viewer: "مشاهده‌گر",
};
export async function listOrganizations(db: Database, userId: string) {
  const orgs = await new OrganizationRepository(db).listForUser(userId);
  if (!orgs.length) return [];
  const roles = await db
    .select({
      organizationId: S.membershipRoles.organizationId,
      membershipId: S.membershipRoles.membershipId,
      name: S.accessRoles.name,
    })
    .from(S.membershipRoles)
    .innerJoin(
      S.accessRoles,
      and(
        eq(S.accessRoles.id, S.membershipRoles.roleId),
        eq(S.accessRoles.organizationId, S.membershipRoles.organizationId),
      ),
    )
    .where(
      inArray(
        S.membershipRoles.membershipId,
        orgs.map((o) => o.membershipId),
      ),
    );
  return orgs.map((o) => ({
    ...o,
    roles: roles
      .filter(
        (r) => r.organizationId === o.id && r.membershipId === o.membershipId,
      )
      .map((r) => r.name),
  }));
}
async function audit(
  db: Database,
  context: Pick<OrganizationContext, "organizationId" | "userId">,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(S.auditEvents).values({
    organizationId: context.organizationId,
    actorUserId: context.userId,
    actorType: "User",
    module: "Organization",
    action,
    entityType,
    entityId,
    metadata,
  });
}
export async function switchOrganization(
  db: Database,
  userId: string,
  sessionId: string,
  organizationId: string,
) {
  return db.transaction(async (tx) => {
    const context = await resolveOrganizationContext(
      tx,
      userId,
      organizationId,
    );
    const [session] = await tx
      .update(S.authSessions)
      .set({ activeOrganizationId: organizationId, updatedAt: new Date() })
      .where(
        and(
          eq(S.authSessions.id, sessionId),
          eq(S.authSessions.userId, userId),
          sql`${S.authSessions.expiresAt}>now()`,
        ),
      )
      .returning();
    if (!session) throw new DataError("Forbidden", 401);
    await tx
      .insert(S.userPreferences)
      .values({ userId, lastOrganizationId: organizationId })
      .onConflictDoUpdate({
        target: S.userPreferences.userId,
        set: { lastOrganizationId: organizationId, updatedAt: new Date() },
      });
    await audit(
      tx,
      context,
      "OrganizationSwitched",
      "organization",
      organizationId,
    );
    return context;
  });
}
export interface CompanyInput {
  name: string;
  industry: string;
  businessModel: string;
  teamSize: string;
  country: string;
  currency: string;
  timezone: string;
}
export async function createCompany(
  db: Database,
  userId: string,
  input: CompanyInput,
) {
  if (
    !input ||
    typeof input.name !== "string" ||
    !input.name.trim() ||
    input.name.length > 160
  )
    throw new DataError("InvalidInput");
  for (const key of [
    "industry",
    "businessModel",
    "teamSize",
    "country",
  ] as const)
    if (typeof input[key] !== "string" || input[key].length > 160)
      throw new DataError("InvalidInput");
  // Random suffix is hidden from users and avoids slug-selection races.
  const stem =
    input.name
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "company";
  return db.transaction(async (tx) => {
    const made = await createOrganizationWithOwner(tx, userId, {
      name: input.name,
      slug: stem + "-" + randomUUID().slice(0, 8),
      currency: input.currency,
      timezone: input.timezone,
      profile: { teamSize: input.teamSize },
    });
    const [org] = await tx
      .update(S.organizations)
      .set({
        industry: input.industry,
        businessModel: input.businessModel,
        country: input.country,
      })
      .where(eq(S.organizations.id, made.organization.id))
      .returning();
    return { ...made, organization: org };
  });
}
async function lockOrganization(db: Database, id: string) {
  await db
    .select({ id: S.organizations.id })
    .from(S.organizations)
    .where(eq(S.organizations.id, id))
    .for("update");
}
async function roleInTenant(
  db: Database,
  context: OrganizationContext,
  name: string,
) {
  if (!Object.hasOwn(roleLabels, name)) throw new DataError("InvalidInput");
  if (name === "Owner") {
    const owner = await db
      .select()
      .from(S.membershipRoles)
      .innerJoin(S.accessRoles, eq(S.accessRoles.id, S.membershipRoles.roleId))
      .where(
        and(
          eq(S.membershipRoles.organizationId, context.organizationId),
          eq(S.membershipRoles.membershipId, context.membershipId),
          eq(S.accessRoles.name, "Owner"),
        ),
      );
    if (!owner.length) throw new DataError("Forbidden", 403);
  }
  const [role] = await db
    .select()
    .from(S.accessRoles)
    .where(
      and(
        eq(S.accessRoles.organizationId, context.organizationId),
        eq(S.accessRoles.name, name),
      ),
    );
  if (!role) throw new DataError("InvalidInput");
  const grants = await db
    .select({ key: S.rolePermissions.permissionKey })
    .from(S.rolePermissions)
    .where(
      and(
        eq(S.rolePermissions.organizationId, context.organizationId),
        eq(S.rolePermissions.roleId, role.id),
      ),
    );
  if (grants.some((grant) => !context.permissions.includes(grant.key)))
    throw new DataError("Forbidden", 403);
  return role;
}
export async function membersView(db: Database, context: OrganizationContext) {
  await reauthorize(db, context, "members.view");
  const rows = await db
    .select({
      id: S.memberships.id,
      userId: S.users.id,
      name: S.users.name,
      email: S.users.email,
      status: S.memberships.status,
      joinedAt: S.memberships.joinedAt,
      invitedAt: S.memberships.createdAt,
      version: S.memberships.version,
    })
    .from(S.memberships)
    .innerJoin(S.users, eq(S.users.id, S.memberships.userId))
    .where(eq(S.memberships.organizationId, context.organizationId));
  const assigned = await db
    .select({
      membershipId: S.membershipRoles.membershipId,
      name: S.accessRoles.name,
    })
    .from(S.membershipRoles)
    .innerJoin(
      S.accessRoles,
      and(
        eq(S.accessRoles.id, S.membershipRoles.roleId),
        eq(S.accessRoles.organizationId, context.organizationId),
      ),
    )
    .where(eq(S.membershipRoles.organizationId, context.organizationId));
  const people = await db
    .select({ userId: S.people.userId, personId: S.people.id })
    .from(S.people)
    .where(eq(S.people.organizationId, context.organizationId));
  const jobs = await db
    .select({
      personId: S.businessRoles.personId,
      title: S.businessRoles.title,
    })
    .from(S.businessRoles)
    .where(eq(S.businessRoles.organizationId, context.organizationId));
  const pending = await db
    .select({
      id: S.invitations.id,
      email: S.invitations.email,
      status: S.invitations.status,
      expiresAt: S.invitations.expiresAt,
      createdAt: S.invitations.createdAt,
    })
    .from(S.invitations)
    .where(eq(S.invitations.organizationId, context.organizationId));
  const invitedRoles = await db
    .select({
      invitationId: S.invitationRoles.invitationId,
      name: S.accessRoles.name,
    })
    .from(S.invitationRoles)
    .innerJoin(S.accessRoles, eq(S.accessRoles.id, S.invitationRoles.roleId))
    .where(eq(S.invitationRoles.organizationId, context.organizationId));
  return {
    members: rows.map((m) => ({
      ...m,
      roles: assigned.filter((r) => r.membershipId === m.id).map((r) => r.name),
      businessRoles: jobs
        .filter((j) =>
          people.some(
            (p) => p.userId === m.userId && p.personId === j.personId,
          ),
        )
        .map((j) => j.title),
    })),
    invitations: pending.map((i) => ({
      ...i,
      status:
        i.status === "Pending" && i.expiresAt <= new Date()
          ? "Expired"
          : i.status,
      roles: invitedRoles
        .filter((r) => r.invitationId === i.id)
        .map((r) => r.name),
    })),
  };
}
const tokenHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export async function inviteMember(
  db: Database,
  context: OrganizationContext,
  email: string,
  roleName: string,
) {
  email = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    throw new DataError("InvalidInput");
  return db.transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const fresh = await reauthorize(tx, context, "members.invite"),
      role = await roleInTenant(tx, fresh, roleName);
    const existing = await tx
      .select()
      .from(S.memberships)
      .innerJoin(S.users, eq(S.users.id, S.memberships.userId))
      .where(
        and(
          eq(S.memberships.organizationId, context.organizationId),
          eq(S.users.email, email),
          eq(S.memberships.status, "Active"),
        ),
      );
    if (existing.length) throw new DataError("Conflict", 409);
    await tx
      .update(S.invitations)
      .set({ status: "Revoked", updatedAt: new Date() })
      .where(
        and(
          eq(S.invitations.organizationId, context.organizationId),
          eq(S.invitations.email, email),
          eq(S.invitations.status, "Pending"),
        ),
      );
    const configuredDays = Number(process.env.INVITATION_TTL_DAYS ?? 7);
    const days =
      Number.isInteger(configuredDays) &&
      configuredDays >= 1 &&
      configuredDays <= 30
        ? configuredDays
        : 7;
    const token = randomBytes(32).toString("base64url"),
      expiresAt = new Date(Date.now() + days * 86400000);
    const [invitation] = await tx
      .insert(S.invitations)
      .values({
        organizationId: context.organizationId,
        email,
        invitedByUserId: context.userId,
        tokenHash: tokenHash(token),
        expiresAt,
      })
      .returning();
    await tx.insert(S.invitationRoles).values({
      organizationId: context.organizationId,
      invitationId: invitation.id,
      roleId: role.id,
    });
    await audit(tx, fresh, "MemberInvited", "invitation", invitation.id, {
      email,
      role: roleName,
    });
    // Raw token exists only in this response. Never audit or persist it.
    return { id: invitation.id, token, expiresAt, email };
  });
}
export async function invitationInfo(db: Database, token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new DataError("NotFound", 404);
  const [row] = await db
    .select({
      id: S.invitations.id,
      email: S.invitations.email,
      status: S.invitations.status,
      expiresAt: S.invitations.expiresAt,
      organizationId: S.organizations.id,
      companyName: S.organizations.name,
      companyStatus: S.organizations.status,
    })
    .from(S.invitations)
    .innerJoin(
      S.organizations,
      eq(S.organizations.id, S.invitations.organizationId),
    )
    .where(eq(S.invitations.tokenHash, tokenHash(token)));
  if (!row) throw new DataError("NotFound", 404);
  if (
    row.status !== "Pending" ||
    row.expiresAt <= new Date() ||
    !["Active", "Trial"].includes(row.companyStatus)
  )
    throw new DataError("Conflict", 410);
  return row;
}
export async function acceptInvitation(
  db: Database,
  userId: string,
  token: string,
) {
  const info = await invitationInfo(db, token);
  return db.transaction(async (tx) => {
    await lockOrganization(tx, info.organizationId);
    const invite = await invitationInfo(tx, token);
    const [user] = await tx
      .select()
      .from(S.users)
      .where(eq(S.users.id, userId));
    if (user?.status !== "Active" || user.email !== invite.email)
      throw new DataError("Forbidden", 403);
    let [member] = await tx
      .select()
      .from(S.memberships)
      .where(
        and(
          eq(S.memberships.organizationId, invite.organizationId),
          eq(S.memberships.userId, userId),
        ),
      );
    if (member && ["Suspended", "Removed"].includes(member.status))
      throw new DataError("Forbidden", 403);
    const already = member?.status === "Active";
    if (!member)
      [member] = await tx
        .insert(S.memberships)
        .values({
          organizationId: invite.organizationId,
          userId,
          status: "Active",
          joinedAt: new Date(),
          invitedByUserId: (
            await tx
              .select()
              .from(S.invitations)
              .where(eq(S.invitations.id, invite.id))
          )[0].invitedByUserId,
        })
        .returning();
    else if (!already)
      [member] = await tx
        .update(S.memberships)
        .set({
          status: "Active",
          joinedAt: new Date(),
          version: sql`${S.memberships.version}+1`,
        })
        .where(eq(S.memberships.id, member.id))
        .returning();
    if (!already) {
      const roles = await tx
        .select()
        .from(S.invitationRoles)
        .where(
          and(
            eq(S.invitationRoles.organizationId, invite.organizationId),
            eq(S.invitationRoles.invitationId, invite.id),
          ),
        );
      if (!roles.length) throw new DataError("InvalidInput");
      await tx
        .insert(S.membershipRoles)
        .values(
          roles.map((r) => ({
            organizationId: invite.organizationId,
            membershipId: member.id,
            roleId: r.roleId,
          })),
        )
        .onConflictDoNothing();
    }
    await tx
      .update(S.invitations)
      .set({
        status: "Accepted",
        updatedAt: new Date(),
        version: sql`${S.invitations.version}+1`,
      })
      .where(
        and(
          eq(S.invitations.organizationId, invite.organizationId),
          eq(S.invitations.id, invite.id),
          eq(S.invitations.status, "Pending"),
        ),
      );
    await audit(
      tx,
      { organizationId: invite.organizationId, userId },
      "InvitationAccepted",
      "membership",
      member.id,
      { invitationId: invite.id, targetUserId: userId, alreadyMember: already },
    );
    return {
      organizationId: invite.organizationId,
      membershipId: member.id,
      alreadyMember: already,
    };
  });
}
export async function changeMember(
  db: Database,
  context: OrganizationContext,
  input: {
    membershipId: string;
    version: number;
    role?: string;
    status?: string;
  },
) {
  requireScope(input.membershipId);
  if (!Number.isInteger(input.version)) throw new DataError("InvalidInput");
  return db.transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const fresh = await reauthorize(
      tx,
      context,
      input.role
        ? "members.change_role"
        : input.status === "Removed"
          ? "members.remove"
          : "members.suspend",
    );
    if (input.role && input.status)
      await reauthorize(
        tx,
        fresh,
        input.status === "Removed" ? "members.remove" : "members.suspend",
      );
    const [target] = await tx
      .select()
      .from(S.memberships)
      .where(
        and(
          eq(S.memberships.organizationId, context.organizationId),
          eq(S.memberships.id, input.membershipId),
        ),
      );
    if (!target) throw new DataError("NotFound", 404);
    if (
      input.role &&
      target.userId === fresh.userId &&
      !fresh.roles?.some((r) => r.name === "Owner")
    )
      throw new DataError("Forbidden", 403);
    if (target.version !== input.version) throw new DataError("Conflict", 409);
    if (
      input.status &&
      !["Active", "Suspended", "Removed"].includes(input.status)
    )
      throw new DataError("InvalidInput");
    const roles = await tx
      .select({ name: S.accessRoles.name })
      .from(S.membershipRoles)
      .innerJoin(S.accessRoles, eq(S.accessRoles.id, S.membershipRoles.roleId))
      .where(
        and(
          eq(S.membershipRoles.organizationId, context.organizationId),
          eq(S.membershipRoles.membershipId, target.id),
        ),
      );
    if (roles.some((r) => r.name === "Owner")) {
      await roleInTenant(tx, fresh, "Owner");
      if (
        target.status === "Active" &&
        ((input.role && input.role !== "Owner") ||
          (input.status && input.status !== "Active"))
      ) {
        const owners = await tx
          .select({ id: S.memberships.id })
          .from(S.memberships)
          .innerJoin(
            S.membershipRoles,
            eq(S.membershipRoles.membershipId, S.memberships.id),
          )
          .innerJoin(
            S.accessRoles,
            eq(S.accessRoles.id, S.membershipRoles.roleId),
          )
          .innerJoin(S.users, eq(S.users.id, S.memberships.userId))
          .where(
            and(
              eq(S.memberships.organizationId, context.organizationId),
              eq(S.memberships.status, "Active"),
              eq(S.users.status, "Active"),
              eq(S.accessRoles.name, "Owner"),
            ),
          );
        if (owners.length <= 1) throw new DataError("Conflict", 409);
      }
    }
    if (input.role) {
      const role = await roleInTenant(tx, fresh, input.role);
      await tx
        .delete(S.membershipRoles)
        .where(
          and(
            eq(S.membershipRoles.organizationId, context.organizationId),
            eq(S.membershipRoles.membershipId, target.id),
          ),
        );
      await tx.insert(S.membershipRoles).values({
        organizationId: context.organizationId,
        membershipId: target.id,
        roleId: role.id,
      });
    }
    const [updated] = await tx
      .update(S.memberships)
      .set({
        status: input.status ?? target.status,
        version: target.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(S.memberships.organizationId, context.organizationId),
          eq(S.memberships.id, target.id),
        ),
      )
      .returning();
    await audit(
      tx,
      fresh,
      input.role
        ? "MemberRoleChanged"
        : input.status === "Suspended"
          ? "MemberSuspended"
          : input.status === "Removed"
            ? "MemberRemoved"
            : "MemberRestored",
      "membership",
      target.id,
      {
        targetUserId: target.userId,
        role: input.role ?? null,
        oldRoles: roles.map((r) => r.name),
        newRoles: input.role ? [input.role] : roles.map((r) => r.name),
        status: updated.status,
      },
    );
    return updated;
  });
}
export async function revokeInvitation(
  db: Database,
  context: OrganizationContext,
  id: string,
) {
  requireScope(id);
  return db.transaction(async (tx) => {
    await lockOrganization(tx, context.organizationId);
    const fresh = await reauthorize(tx, context, "members.invite");
    const [r] = await tx
      .update(S.invitations)
      .set({ status: "Revoked", updatedAt: new Date() })
      .where(
        and(
          eq(S.invitations.organizationId, context.organizationId),
          eq(S.invitations.id, id),
          eq(S.invitations.status, "Pending"),
        ),
      )
      .returning();
    if (!r) throw new DataError("NotFound", 404);
    await audit(tx, fresh, "InvitationRevoked", "invitation", id);
    return { id };
  });
}
