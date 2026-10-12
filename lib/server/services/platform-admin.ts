import "server-only";
import { and, eq, desc, sql } from "drizzle-orm";
import type { Database } from "../db/types";
import * as S from "../db/schema";
import { DataError } from "../db/errors";
import { reauthorize, type OrganizationContext } from "../context";
import { parseDraft, validProfile } from "../../assessment/persistence";
import { isComplete } from "../../assessment/scoring";
import { diagnose } from "../../assessment/diagnostics";
import { questions } from "../../assessment/questions";
export type AccessTier = "assessment_only" | "full_access";
export async function requirePlatformAdmin(db: Database, userId: string) {
  const [user] = await db
    .select({ id: S.users.id, email: S.users.email, status: S.users.status })
    .from(S.users)
    .where(eq(S.users.id, userId));
  const allowed = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (
    !user ||
    user.status !== "Active" ||
    !allowed.includes(user.email.toLowerCase())
  )
    throw new DataError("Forbidden", 403);
  return user;
}
export async function requireFullAccess(
  db: Database,
  context: OrganizationContext,
) {
  const fresh = await reauthorize(db, context, "organization.view");
  if (fresh.accessTier !== "full_access") throw new DataError("Forbidden", 403);
  return fresh;
}
export async function requestAccess(
  db: Database,
  context: OrganizationContext,
) {
  return db.transaction(async (tx) => {
    await tx
      .select({ id: S.organizations.id })
      .from(S.organizations)
      .where(eq(S.organizations.id, context.organizationId))
      .for("update");
    const fresh = await reauthorize(tx, context, "organization.view");
    if (fresh.accessTier === "full_access")
      throw new DataError("Conflict", 409);
    const [existing] = await tx
      .select()
      .from(S.platformAccessRequests)
      .where(
        and(
          eq(S.platformAccessRequests.organizationId, fresh.organizationId),
          eq(S.platformAccessRequests.status, "pending"),
        ),
      );
    if (existing) return { id: existing.id, status: existing.status };
    const [record] = await tx
      .insert(S.platformAccessRequests)
      .values({ organizationId: fresh.organizationId, userId: fresh.userId })
      .returning();
    return { id: record.id, status: record.status };
  });
}
export async function changeAccess(
  db: Database,
  actorId: string,
  input: {
    organizationId: string;
    tier: AccessTier;
    previousTier: AccessTier;
    confirmed: boolean;
    reason?: string;
    requestId?: string;
    reject?: boolean;
  },
) {
  await requirePlatformAdmin(db, actorId);
  if (
    input.confirmed !== true ||
    !["assessment_only", "full_access"].includes(input.tier) ||
    !["assessment_only", "full_access"].includes(input.previousTier) ||
    (input.reason &&
      (typeof input.reason !== "string" || input.reason.length > 500))
  )
    throw new DataError("InvalidInput");
  return db.transaction(async (tx) => {
    await requirePlatformAdmin(tx, actorId);
    const [org] = await tx
      .select()
      .from(S.organizations)
      .where(eq(S.organizations.id, input.organizationId))
      .for("update");
    if (!org) throw new DataError("NotFound", 404);
    if (org.accessTier !== input.previousTier)
      throw new DataError("Conflict", 409);
    if (input.requestId) {
      const [request] = await tx
        .select()
        .from(S.platformAccessRequests)
        .where(
          and(
            eq(S.platformAccessRequests.id, input.requestId),
            eq(S.platformAccessRequests.organizationId, org.id),
            eq(S.platformAccessRequests.status, "pending"),
          ),
        )
        .for("update");
      if (!request) throw new DataError("Conflict", 409);
      if (!input.reject && input.tier !== "full_access")
        throw new DataError("InvalidInput");
      await tx
        .update(S.platformAccessRequests)
        .set({
          status: input.reject ? "rejected" : "approved",
          updatedAt: new Date(),
        })
        .where(eq(S.platformAccessRequests.id, request.id));
    } else if (input.reject) throw new DataError("InvalidInput");
    const tier = input.reject ? org.accessTier : input.tier;
    await tx
      .update(S.organizations)
      .set({ accessTier: tier, updatedAt: new Date() })
      .where(eq(S.organizations.id, org.id));
    if (tier === "full_access")
      await tx
        .update(S.platformAccessRequests)
        .set({ status: "approved", updatedAt: new Date() })
        .where(
          and(
            eq(S.platformAccessRequests.organizationId, org.id),
            eq(S.platformAccessRequests.status, "pending"),
          ),
        );
    await tx
      .insert(S.platformAudit)
      .values({
        actorUserId: actorId,
        organizationId: org.id,
        action: input.reject ? "AccessRequestRejected" : "AccessTierChanged",
        previousTier: org.accessTier,
        newTier: tier,
        reason: input.reason?.trim() || null,
      });
    return { accessTier: tier };
  });
}
export async function captureAssessmentLead(
  db: Database,
  context: OrganizationContext,
  raw: string | null,
) {
  if (!raw) return;
  const draft = parseDraft(raw);
  await db
    .insert(S.platformAssessmentLeads)
    .values({
      organizationId: context.organizationId,
      userId: context.userId,
      draft,
    })
    .onConflictDoUpdate({
      target: [
        S.platformAssessmentLeads.organizationId,
        S.platformAssessmentLeads.userId,
      ],
      set: { draft, updatedAt: new Date() },
    });
}
export function assessmentSummary(raw: string) {
  const draft = parseDraft(raw),
    complete =
      !!draft.completedAt &&
      validProfile(draft.profile) &&
      isComplete(draft.answers);
  const answered = questions.filter(
    (q) => draft.answers[q.id] !== undefined,
  ).length;
  const result = complete ? diagnose(draft.answers) : null;
  return {
    draft,
    result,
    status: complete ? "completed" : "incomplete",
    completionPercentage: Math.round((answered / questions.length) * 100),
    completedAt: complete ? draft.completedAt : null,
  };
}
// Dedicated cross-tenant service. No OrganizationContext is forged or widened.
export async function platformOverview(db: Database, actorId: string) {
  await requirePlatformAdmin(db, actorId);
  const users = await db
    .select({
      id: S.users.id,
      name: S.users.name,
      email: S.users.email,
      createdAt: S.users.createdAt,
      lastActivity: S.users.lastLoginAt,
      status: S.users.status,
    })
    .from(S.users)
    .orderBy(desc(S.users.createdAt));
  const organizations = await db
    .select({
      id: S.organizations.id,
      name: S.organizations.name,
      industry: S.organizations.industry,
      businessModel: S.organizations.businessModel,
      country: S.organizations.country,
      currency: S.organizations.currency,
      timezone: S.organizations.timezone,
      status: S.organizations.status,
      accessTier: S.organizations.accessTier,
      createdAt: S.organizations.createdAt,
      updatedAt: S.organizations.updatedAt,
    })
    .from(S.organizations)
    .orderBy(desc(S.organizations.createdAt));
  const members = await db
    .select({
      organizationId: S.memberships.organizationId,
      userId: S.memberships.userId,
      status: S.memberships.status,
      role: S.accessRoles.name,
    })
    .from(S.memberships)
    .innerJoin(
      S.membershipRoles,
      and(
        eq(S.membershipRoles.membershipId, S.memberships.id),
        eq(S.membershipRoles.organizationId, S.memberships.organizationId),
      ),
    )
    .innerJoin(
      S.accessRoles,
      and(
        eq(S.accessRoles.id, S.membershipRoles.roleId),
        eq(S.accessRoles.organizationId, S.memberships.organizationId),
      ),
    );
  const leads = await db
    .select()
    .from(S.platformAssessmentLeads)
    .orderBy(desc(S.platformAssessmentLeads.updatedAt));
  const assessments = leads.map((lead) => ({
    ...lead,
    ...assessmentSummary(JSON.stringify(lead.draft)),
  }));
  // Historical shared assessments may have no reliable user attribution. Keep
  // that distinction instead of assigning an owner's answers to every member.
  const { AssessmentDomainRepository } =
    await import("../repositories/domain-state");
  for (const org of organizations) {
    if (assessments.some((lead) => lead.organizationId === org.id)) continue;
    const raw = (
      await new AssessmentDomainRepository(db).read(org.id, "shared")
    )["growth-engine.assessment.v2"];
    if (!raw) continue;
    const header = (
      await db
        .select()
        .from(S.domainStoreHeaders)
        .where(
          and(
            eq(S.domainStoreHeaders.organizationId, org.id),
            eq(S.domainStoreHeaders.storeKey, "growth-engine.assessment.v2"),
            eq(S.domainStoreHeaders.ownerKey, "shared"),
          ),
        )
    )[0];
    assessments.push({
      id: org.id,
      organizationId: org.id,
      userId: "",
      createdAt: header?.createdAt ?? org.createdAt,
      updatedAt: header?.updatedAt ?? org.updatedAt,
      ...assessmentSummary(raw),
    });
  }
  const requests = await db
    .select()
    .from(S.platformAccessRequests)
    .orderBy(desc(S.platformAccessRequests.createdAt));
  const audit = await db
    .select()
    .from(S.platformAudit)
    .orderBy(desc(S.platformAudit.createdAt))
    .limit(200);
  const week = Date.now() - 7 * 86400000;
  const domainCounts = {} as Record<
    string,
    { organizationId: string; count: number }[]
  >;
  for (const [name, table] of [
    ["System", S.systemDomainRecords],
    ["Strategy", S.strategyDomainRecords],
    ["Scale", S.scaleDomainRecords],
  ] as const)
    domainCounts[name] = await db
      .select({
        organizationId: table.organizationId,
        count: sql<number>`count(*)::int`,
      })
      .from(table)
      .groupBy(table.organizationId);
  const recentActivity = await db
    .select({
      organizationId: S.auditEvents.organizationId,
      actorUserId: S.auditEvents.actorUserId,
      action: S.auditEvents.action,
      createdAt: S.auditEvents.createdAt,
    })
    .from(S.auditEvents)
    .orderBy(desc(S.auditEvents.createdAt))
    .limit(200);
  const totals = {
    users: users.length,
    newUsers: users.filter((u) => u.createdAt.getTime() >= week).length,
    organizations: organizations.length,
    completed: assessments.filter((a) => a.status === "completed").length,
    incomplete: assessments.filter((a) => a.status !== "completed").length,
    fullAccess: organizations.filter((o) => o.accessTier === "full_access")
      .length,
    assessmentOnly: users.filter(
      (u) =>
        !members.some(
          (m) =>
            m.userId === u.id &&
            m.status === "Active" &&
            organizations.some(
              (o) =>
                o.id === m.organizationId && o.accessTier === "full_access",
            ),
        ),
    ).length,
    pending: requests.filter((r) => r.status === "pending").length,
  };
  return {
    users,
    organizations,
    members,
    assessments,
    requests,
    audit,
    totals,
    domainCounts,
    recentActivity,
  };
}
