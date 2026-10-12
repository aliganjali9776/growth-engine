import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  bigint,
  numeric,
  timestamp,
  date,
  jsonb,
  unique,
  uniqueIndex,
  index,
  foreignKey,
  check,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
const times = () => ({
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// Operational v1 records are split by domain and entity collection. JSONB holds
// the validated versioned entity contract, never an entire browser workspace.
// Queryable ownership, lifecycle and parent identifiers remain ordinary columns.
const domainRecordColumns = () => ({
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  ownerKey: text("owner_key").notNull().default("shared"),
  storeKey: text("store_key").notNull(),
  collection: text().notNull(),
  entityKey: text("entity_key").notNull(),
  position: integer().notNull(),
  payload: jsonb().$type<Record<string, unknown>>().notNull(),
  parentId: text("parent_id"),
  ownerRoleId: text("owner_role_id"),
  status: text(),
  version: integer().notNull().default(1),
  actorType: text("actor_type").notNull(),
  createdByUserId: uuid("created_by_user_id").references(() => users.id),
  updatedByUserId: uuid("updated_by_user_id").references(() => users.id),
  ...times(),
});
const domainRecordIndexes = (t: { [K in keyof ReturnType<typeof domainRecordColumns>]: AnyPgColumn }) => [
  unique().on(t.organizationId, t.ownerKey, t.storeKey, t.collection, t.entityKey),
  index().on(t.organizationId, t.storeKey, t.collection, t.position),
  index().on(t.organizationId, t.parentId),
  index().on(t.organizationId, t.status),
  check("domain_record_version", sql`${t.version}>0`),
  check("domain_record_actor", sql`${t.actorType} in ('User','LegacyLocal')`),
];
export const systemDomainRecords = pgTable("system_domain_records", domainRecordColumns(), domainRecordIndexes);
export const strategyDomainRecords = pgTable("strategy_domain_records", domainRecordColumns(), domainRecordIndexes);
export const scaleDomainRecords = pgTable("scale_domain_records", domainRecordColumns(), domainRecordIndexes);
export const agentDomainRecords = pgTable("agent_domain_records", domainRecordColumns(), domainRecordIndexes);
export const assessmentDomainRecords = pgTable("assessment_domain_records", domainRecordColumns(), domainRecordIndexes);
export const domainStoreHeaders = pgTable("domain_store_headers", {
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  ownerKey: text("owner_key").notNull(),
  storeKey: text("store_key").notNull(),
  metadata: jsonb().$type<Record<string, unknown> | null>(),
  version: integer().notNull().default(1),
  ...times(),
}, t => [unique().on(t.organizationId, t.ownerKey, t.storeKey), index().on(t.organizationId)]);
// Global authentication records. Business access always belongs to Membership.
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: uuid().defaultRandom().primaryKey(),
    token: text().notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    activeOrganizationId: uuid("active_organization_id").references(
      () => organizations.id,
    ),
    ...times(),
  },
  (t) => [index().on(t.userId), index().on(t.expiresAt)],
);
export const authAccounts = pgTable(
  "auth_accounts",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    password: text(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text(),
    ...times(),
  },
  (t) => [unique().on(t.providerId, t.accountId), index().on(t.userId)],
);
export const authVerifications = pgTable(
  "auth_verifications",
  {
    id: uuid().defaultRandom().primaryKey(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ...times(),
  },
  (t) => [index().on(t.identifier)],
);
export const authRateLimits = pgTable("auth_rate_limits", {
  id: uuid().defaultRandom().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});
export const authEvents = pgTable(
  "auth_security_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    userId: uuid("user_id").references(() => users.id),
    action: text().notNull(),
    outcome: text().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index().on(t.userId, t.createdAt)],
);
// Transitional, validated v1 workspace documents. No legacy browser import or
// trusted server execution is implied; canonical normalized migration is later.
export const tenantWorkspaces = pgTable(
  "tenant_workspace_documents",
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    ownerKey: text("owner_key").notNull(),
    version: integer().notNull().default(1),
    stores: jsonb().$type<Record<string, string | null>>().notNull(),
    ...times(),
  },
  (t) => [
    unique().on(t.organizationId, t.ownerKey),
    index().on(t.organizationId),
    check("workspace_version", sql`${t.version}>0`),
  ],
);
export const users = pgTable(
  "users",
  {
    id: uuid().defaultRandom().primaryKey(),
    email: text().notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    authProviderId: text("auth_provider_id").unique(),
    name: text().notNull(),
    avatarUrl: text("avatar_url"),
    status: text().default("Active").notNull(),
    locale: text().default("fa-IR").notNull(),
    timezone: text().default("Asia/Tehran").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...times(),
  },
  (t) => [
    check(
      "user_status",
      sql`${t.status} in ('Active','Invited','Suspended','Disabled')`,
    ),
    check("email_normalized", sql`${t.email}=lower(trim(${t.email}))`),
  ],
);
export const organizations = pgTable(
  "organizations",
  {
    id: uuid().defaultRandom().primaryKey(),
    name: text().notNull(),
    slug: text().notNull().unique(),
    accessTier: text("access_tier").$type<"assessment_only" | "full_access">().default("assessment_only").notNull(),
    legalName: text("legal_name"),
    industry: text(),
    businessModel: text("business_model"),
    country: text(),
    currency: text().default("IRR").notNull(),
    timezone: text().default("Asia/Tehran").notNull(),
    size: integer(),
    status: text().default("Trial").notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...times(),
  },
  (t) => [
    check("organization_access_tier", sql`${t.accessTier} in ('assessment_only','full_access')`),
    check(
      "organization_status",
      sql`${t.status} in ('Active','Trial','Suspended','Archived')`,
    ),
    check("organization_slug", sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$'`),
  ],
);
export const platformAccessRequests = pgTable("platform_access_requests", {
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  status: text().$type<"pending" | "approved" | "rejected">().notNull().default("pending"),
  ...times(),
}, t => [index().on(t.organizationId), uniqueIndex("one_pending_access_request").on(t.organizationId).where(sql`${t.status}='pending'`), check("access_request_status", sql`${t.status} in ('pending','approved','rejected')`)]);
export const platformAudit = pgTable("platform_audit", {
  id: uuid().defaultRandom().primaryKey(),
  actorUserId: uuid("actor_user_id").references(() => users.id),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  action: text().notNull(),
  previousTier: text("previous_tier"),
  newTier: text("new_tier"),
  reason: text(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [index().on(t.organizationId, t.createdAt)]);
export const platformAssessmentLeads = pgTable("platform_assessment_leads", {
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  draft: jsonb().$type<import("../../assessment/types").AssessmentDraft>().notNull(),
  ...times(),
}, t => [unique().on(t.organizationId, t.userId)]);
const tenant = () => ({
  id: uuid().defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),
  version: integer().default(1).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  ...times(),
});
type Scoped = {
  id: AnyPgColumn;
  organizationId: AnyPgColumn;
  version: AnyPgColumn;
};
const scoped = (t: Scoped) => [
  unique().on(t.organizationId, t.id),
  index().on(t.organizationId),
  check("positive_version", sql`${t.version}>0`),
];
const link = (
  t: { organizationId: AnyPgColumn },
  c: AnyPgColumn,
  p: { organizationId: AnyPgColumn; id: AnyPgColumn },
) =>
  foreignKey({
    columns: [t.organizationId, c],
    foreignColumns: [p.organizationId, p.id],
  }).onDelete("restrict");
export const memberships = pgTable(
  "organization_memberships",
  {
    ...tenant(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: text().default("Invited").notNull(),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
  },
  (t) => [
    ...scoped(t),
    unique().on(t.organizationId, t.userId),
    index().on(t.userId, t.status),
    check(
      "membership_status",
      sql`${t.status} in ('Invited','Active','Suspended','Removed')`,
    ),
  ],
);
// AccessRole controls SaaS permissions; BusinessRole describes a job in System.
export const accessRoles = pgTable(
  "access_roles",
  {
    ...tenant(),
    name: text().notNull(),
    systemRole: boolean("system_role").default(false).notNull(),
  },
  (t) => [...scoped(t), unique().on(t.organizationId, t.name)],
);
export const permissions = pgTable("permissions", {
  key: text().primaryKey(),
  description: text().notNull(),
});
export const rolePermissions = pgTable(
  "role_permissions",
  {
    ...tenant(),
    roleId: uuid("role_id").notNull(),
    permissionKey: text("permission_key")
      .notNull()
      .references(() => permissions.key),
  },
  (t) => [
    ...scoped(t),
    link(t, t.roleId, accessRoles),
    unique().on(t.roleId, t.permissionKey),
  ],
);
export const membershipRoles = pgTable(
  "membership_roles",
  {
    ...tenant(),
    membershipId: uuid("membership_id").notNull(),
    roleId: uuid("role_id").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.membershipId, memberships),
    link(t, t.roleId, accessRoles),
    unique().on(t.membershipId, t.roleId),
  ],
);
export const invitations = pgTable(
  "organization_invitations",
  {
    ...tenant(),
    email: text().notNull(),
    invitedByUserId: uuid("invited_by_user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    status: text().default("Pending").notNull(),
  },
  (t) => [
    ...scoped(t),
    index().on(t.organizationId, t.email),
    check(
      "invitation_status",
      sql`${t.status} in ('Pending','Accepted','Revoked','Expired')`,
    ),
  ],
);
export const invitationRoles = pgTable(
  "invitation_roles",
  {
    ...tenant(),
    invitationId: uuid("invitation_id").notNull(),
    roleId: uuid("role_id").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.invitationId, invitations),
    link(t, t.roleId, accessRoles),
    unique().on(t.invitationId, t.roleId),
  ],
);
export const organizationProfiles = pgTable(
  "organization_profiles",
  {
    ...tenant(),
    monthlyRevenueRange: text("monthly_revenue_range"),
    teamSize: text("team_size"),
    growthStage: text("growth_stage"),
    primaryMarket: text("primary_market"),
    notes: text(),
    assessmentProfile: jsonb("assessment_profile"),
  },
  (t) => [...scoped(t), unique().on(t.organizationId)],
);
export const organizationSettings = pgTable(
  "organization_settings",
  {
    ...tenant(),
    locale: text().default("fa-IR").notNull(),
    timezone: text().default("Asia/Tehran").notNull(),
    currency: text().default("IRR").notNull(),
    weekStart: integer("week_start").default(6).notNull(),
    fiscalYearStart: text("fiscal_year_start"),
    dateFormat: text("date_format").default("jalali").notNull(),
    brandName: text("brand_name"),
  },
  (t) => [
    ...scoped(t),
    unique().on(t.organizationId),
    check("week_start", sql`${t.weekStart} between 0 and 6`),
  ],
);
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  lastOrganizationId: uuid("last_organization_id").references(
    () => organizations.id,
  ),
  locale: text(),
  ...times(),
});
export const departments = pgTable(
  "business_departments",
  {
    ...tenant(),
    name: text().notNull(),
    description: text().default("").notNull(),
    parentDepartmentId: uuid("parent_department_id"),
    status: text().default("active").notNull(),
  },
  (t) => [
    ...scoped(t),
    foreignKey({
      columns: [t.organizationId, t.parentDepartmentId],
      foreignColumns: [t.organizationId, t.id],
    }),
  ],
);
export const people = pgTable(
  "business_people",
  {
    ...tenant(),
    name: text().notNull(),
    jobTitle: text("job_title").default("").notNull(),
    email: text(),
    avatar: text(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    status: text().default("active").notNull(),
  },
  (t) => [...scoped(t)],
);
export const businessRoles = pgTable(
  "business_roles",
  {
    ...tenant(),
    title: text().notNull(),
    departmentId: uuid("department_id").notNull(),
    personId: uuid("person_id"),
    reportsToRoleId: uuid("reports_to_role_id"),
    purpose: text().default("").notNull(),
    isKeyRole: boolean("is_key_role").default(false).notNull(),
    isFounderRole: boolean("is_founder_role").default(false).notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.departmentId, departments),
    link(t, t.personId, people),
    foreignKey({
      columns: [t.organizationId, t.reportsToRoleId],
      foreignColumns: [t.organizationId, t.id],
    }),
  ],
);
export const roleResponsibilities = pgTable(
  "business_role_responsibilities",
  {
    ...tenant(),
    roleId: uuid("role_id").notNull(),
    position: integer().notNull(),
    description: text().notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.roleId, businessRoles),
    unique().on(t.roleId, t.position),
  ],
);
export const departmentManagers = pgTable(
  "department_managers",
  {
    ...tenant(),
    departmentId: uuid("department_id").notNull(),
    roleId: uuid("role_id").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.departmentId, departments),
    link(t, t.roleId, businessRoles),
    unique().on(t.departmentId),
  ],
);
export const processes = pgTable(
  "processes",
  {
    ...tenant(),
    code: text().notNull(),
    name: text().notNull(),
    description: text().default("").notNull(),
    valueChain: text("value_chain").notNull(),
    departmentId: uuid("department_id").notNull(),
    ownerRoleId: uuid("owner_role_id").notNull(),
    frequency: integer().notNull(),
    impact: integer().notNull(),
    variation: integer().notNull(),
    dependency: integer().notNull(),
    founderDependency: text("founder_dependency").notNull(),
    status: text().default("active").notNull(),
    systemizationStage: text("systemization_stage")
      .default("identified")
      .notNull(),
    documentationStatus: text("documentation_status").default("none").notNull(),
    adoptionStatus: text("adoption_status").default("not-started").notNull(),
    notes: text().default("").notNull(),
  },
  (t) => [
    ...scoped(t),
    unique().on(t.organizationId, t.code),
    link(t, t.departmentId, departments),
    link(t, t.ownerRoleId, businessRoles),
    index().on(t.organizationId, t.ownerRoleId),
    check(
      "process_ratings",
      sql`${t.frequency} between 1 and 3 and ${t.impact} between 1 and 3 and ${t.variation} between 1 and 3 and ${t.dependency} between 1 and 3`,
    ),
  ],
);
export const strategyCycles = pgTable(
  "strategy_cycles",
  {
    ...tenant(),
    name: text().notNull(),
    description: text().default("").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text().default("draft").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    cycleType: text("cycle_type").default("quarterly").notNull(),
    strategicTheme: text("strategic_theme").default("").notNull(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    ...scoped(t),
    link(t, t.ownerRoleId, businessRoles),
    check("cycle_dates", sql`${t.startDate}<=${t.endDate}`),
  ],
);
export const priorities = pgTable(
  "strategy_priorities",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    title: text().notNull(),
    description: text(),
    direction: text(),
    rank: integer().notNull(),
    rationale: text(),
    successDefinition: text("success_definition"),
    status: text().default("draft").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.cycleId, strategyCycles),
    link(t, t.ownerRoleId, businessRoles),
    unique().on(t.organizationId, t.cycleId, t.id),
  ],
);
export const objectives = pgTable(
  "strategy_objectives",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    priorityId: uuid("priority_id"),
    ownerRoleId: uuid("owner_role_id"),
    code: text().notNull(),
    title: text().notNull(),
    description: text().default("").notNull(),
    status: text().default("draft").notNull(),
    startDate: date("start_date").notNull(),
    deadline: date().notNull(),
    krWeightMode: text("kr_weight_mode").default("equal").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.cycleId, strategyCycles),
    link(t, t.ownerRoleId, businessRoles),
    foreignKey({
      columns: [t.organizationId, t.cycleId, t.priorityId],
      foreignColumns: [
        priorities.organizationId,
        priorities.cycleId,
        priorities.id,
      ],
    }),
    unique().on(t.organizationId, t.cycleId, t.code),
    index().on(t.organizationId, t.cycleId),
  ],
);
export const keyResults = pgTable(
  "key_results",
  {
    ...tenant(),
    objectiveId: uuid("objective_id").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    code: text().notNull(),
    title: text().notNull(),
    description: text(),
    metricType: text("metric_type").notNull(),
    direction: text().notNull(),
    unit: text(),
    baseline: numeric(),
    target: numeric(),
    current: numeric(),
    weight: numeric(),
    confidence: text(),
    status: text().default("draft").notNull(),
    deadline: date(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.objectiveId, objectives),
    link(t, t.ownerRoleId, businessRoles),
    unique().on(t.organizationId, t.objectiveId, t.code),
    index().on(t.organizationId, t.objectiveId),
  ],
);
export const initiatives = pgTable(
  "strategy_initiatives",
  {
    ...tenant(),
    objectiveId: uuid("objective_id").notNull(),
    keyResultId: uuid("key_result_id"),
    processId: uuid("process_id"),
    ownerRoleId: uuid("owner_role_id"),
    title: text().notNull(),
    description: text(),
    status: text().default("draft").notNull(),
    startDate: date("start_date"),
    deadline: date(),
    expectedImpact: text("expected_impact"),
  },
  (t) => [
    ...scoped(t),
    link(t, t.objectiveId, objectives),
    link(t, t.keyResultId, keyResults),
    link(t, t.processId, processes),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const growthProfiles = pgTable(
  "growth_profiles",
  {
    ...tenant(),
    businessModel: text("business_model"),
    growthGoal: text("growth_goal"),
    growthHorizon: text("growth_horizon"),
    currentRevenue: numeric("current_revenue"),
    targetRevenue: numeric("target_revenue"),
    primaryMetric: text("primary_metric"),
    linkedKrId: uuid("linked_kr_id"),
    stage: text(),
    notes: text(),
  },
  (t) => [
    ...scoped(t),
    unique().on(t.organizationId),
    link(t, t.linkedKrId, keyResults),
  ],
);
export const constraints = pgTable(
  "growth_constraints",
  {
    ...tenant(),
    title: text().notNull(),
    description: text().default("").notNull(),
    dimension: text().notNull(),
    severity: text().notNull(),
    confidence: text(),
    status: text().default("active").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    objectiveId: uuid("objective_id"),
    keyResultId: uuid("key_result_id"),
    processId: uuid("process_id"),
    symptom: text(),
    impact: text(),
    notes: text(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    ...scoped(t),
    link(t, t.ownerRoleId, businessRoles),
    link(t, t.objectiveId, objectives),
    link(t, t.keyResultId, keyResults),
    link(t, t.processId, processes),
  ],
);
export const defaultLevers = pgTable("default_growth_levers", {
  key: text().primaryKey(),
  name: text().notNull(),
  category: text().notNull(),
  description: text().notNull(),
});
export const levers = pgTable(
  "tenant_growth_levers",
  {
    ...tenant(),
    defaultKey: text("default_key").references(() => defaultLevers.key),
    name: text().notNull(),
    category: text().notNull(),
    description: text(),
    active: boolean().default(true).notNull(),
  },
  (t) => [...scoped(t), unique().on(t.organizationId, t.defaultKey)],
);
export const ideas = pgTable(
  "growth_ideas",
  {
    ...tenant(),
    constraintId: uuid("constraint_id").notNull(),
    leverId: uuid("lever_id"),
    ownerRoleId: uuid("owner_role_id"),
    title: text().notNull(),
    description: text(),
    source: text().notNull(),
    rationale: text(),
    intervention: text(),
    successMetric: text("success_metric"),
    confidence: text(),
    effort: text(),
    estimatedCost: text("estimated_cost"),
    status: text().default("inbox").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.constraintId, constraints),
    link(t, t.leverId, levers),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const experiments = pgTable(
  "growth_experiments",
  {
    ...tenant(),
    ideaId: uuid("idea_id"),
    constraintId: uuid("constraint_id").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    code: text().notNull(),
    title: text().notNull(),
    hypothesis: text().notNull(),
    intervention: text(),
    successCriterion: text("success_criterion"),
    primaryMetric: text("primary_metric"),
    baseline: numeric(),
    target: numeric(),
    startDate: date("start_date"),
    endDate: date("end_date"),
    status: text().default("draft").notNull(),
    notes: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.ideaId, ideas),
    link(t, t.constraintId, constraints),
    link(t, t.ownerRoleId, businessRoles),
    unique().on(t.organizationId, t.code),
    index().on(t.organizationId, t.constraintId),
  ],
);
export const agentSessions = pgTable(
  "agent_sessions",
  {
    ...tenant(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    title: text().notNull(),
    contextType: text("context_type").notNull(),
    contextEntityId: uuid("context_entity_id"),
    visibility: text().default("private").notNull(),
    status: text().default("active").notNull(),
  },
  (t) => [
    ...scoped(t),
    foreignKey({
      columns: [t.organizationId, t.createdByUserId],
      foreignColumns: [memberships.organizationId, memberships.userId],
    }),
    index().on(t.organizationId, t.createdByUserId),
  ],
);
export const agentMessages = pgTable(
  "agent_messages",
  {
    ...tenant(),
    sessionId: uuid("session_id").notNull(),
    role: text().notNull(),
    content: text().notNull(),
    contextType: text("context_type"),
    contextEntityId: uuid("context_entity_id"),
  },
  (t) => [
    ...scoped(t),
    link(t, t.sessionId, agentSessions),
    index().on(t.organizationId, t.sessionId, t.createdAt),
  ],
);
// JSONB below is frozen evidence/decision payload, not a whole domain store.
export const agentEvidence = pgTable(
  "agent_evidence",
  {
    ...tenant(),
    evidenceType: text("evidence_type").notNull(),
    domain: text().notNull(),
    title: text().notNull(),
    summary: text().notNull(),
    sourceSelector: text("source_selector").notNull(),
    sourceEntityType: text("source_entity_type"),
    sourceEntityId: uuid("source_entity_id"),
    value: jsonb(),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull(),
  },
  (t) => [...scoped(t)],
);
export const agentDiagnoses = pgTable(
  "agent_diagnoses",
  {
    ...tenant(),
    title: text().notNull(),
    logicalKey: text("logical_key").notNull(),
    status: text().notNull(),
    severity: text().notNull(),
    confidence: text().notNull(),
    sourceVersion: text("source_version").notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), unique().on(t.organizationId, t.logicalKey)],
);
export const agentRecommendations = pgTable(
  "agent_recommendations",
  {
    ...tenant(),
    diagnosisId: uuid("diagnosis_id"),
    title: text().notNull(),
    status: text().notNull(),
    sourceVersion: text("source_version").notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.diagnosisId, agentDiagnoses)],
);
export const agentActions = pgTable(
  "agent_proposed_actions",
  {
    ...tenant(),
    recommendationId: uuid("recommendation_id"),
    requestedByUserId: uuid("requested_by_user_id").notNull(),
    capabilityId: text("capability_id").notNull(),
    templateId: text("template_id").notNull(),
    title: text().notNull(),
    status: text().default("Draft").notNull(),
    risk: text().notNull(),
    revision: integer().default(1).notNull(),
    binding: text().notNull(),
    payload: jsonb().notNull(),
    frozenEvidence: jsonb("frozen_evidence").notNull(),
    expectedState: jsonb("expected_state").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.recommendationId, agentRecommendations),
    foreignKey({
      columns: [t.organizationId, t.requestedByUserId],
      foreignColumns: [memberships.organizationId, memberships.userId],
    }),
    check("action_revision", sql`${t.revision}>0`),
  ],
);
export const agentApprovals = pgTable(
  "agent_approvals",
  {
    ...tenant(),
    actionId: uuid("action_id").notNull(),
    approvedByUserId: uuid("approved_by_user_id").notNull(),
    revision: integer().notNull(),
    binding: text().notNull(),
    decision: text().notNull(),
    reason: text(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.actionId, agentActions),
    foreignKey({
      columns: [t.organizationId, t.approvedByUserId],
      foreignColumns: [memberships.organizationId, memberships.userId],
    }),
    unique().on(t.organizationId, t.id, t.actionId, t.revision, t.binding),
    check("approval_decision", sql`${t.decision} in ('Approved','Rejected')`),
  ],
);
export const agentExecutions = pgTable(
  "agent_execution_records",
  {
    ...tenant(),
    actionId: uuid("action_id").notNull(),
    approvalId: uuid("approval_id").notNull(),
    executedByUserId: uuid("executed_by_user_id").notNull(),
    approvedRevision: integer("approved_revision").notNull(),
    binding: text().notNull(),
    commandId: uuid("command_id").notNull(),
    capabilityId: text("capability_id").notNull(),
    status: text().notNull(),
    command: jsonb().notNull(),
    beforeSnapshot: jsonb("before_snapshot").notNull(),
    afterSnapshot: jsonb("after_snapshot"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    errorCode: text("error_code"),
  },
  (t) => [
    ...scoped(t),
    link(t, t.actionId, agentActions),
    foreignKey({
      columns: [
        t.organizationId,
        t.approvalId,
        t.actionId,
        t.approvedRevision,
        t.binding,
      ],
      foreignColumns: [
        agentApprovals.organizationId,
        agentApprovals.id,
        agentApprovals.actionId,
        agentApprovals.revision,
        agentApprovals.binding,
      ],
    }),
    foreignKey({
      columns: [t.organizationId, t.executedByUserId],
      foreignColumns: [memberships.organizationId, memberships.userId],
    }),
    unique().on(t.organizationId, t.commandId),
  ],
);
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "restrict" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, {
      onDelete: "restrict",
    }),
    actorType: text("actor_type").notNull(),
    module: text().notNull(),
    action: text().notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    metadata: jsonb().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index().on(t.organizationId, t.createdAt),
    check("audit_actor_type", sql`${t.actorType} in ('User','Agent','System')`),
  ],
);
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    ...tenant(),
    key: text().notNull(),
    operation: text().notNull(),
    actorUserId: uuid("actor_user_id")
      .notNull()
      .references(() => users.id),
    requestHash: text("request_hash").notNull(),
    result: jsonb(),
    status: text().notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [...scoped(t), unique().on(t.organizationId, t.operation, t.key)],
);
export const migrationImports = pgTable(
  "migration_imports",
  {
    ...tenant(),
    importedByUserId: uuid("imported_by_user_id")
      .notNull()
      .references(() => users.id),
    exportSchemaVersion: integer("export_schema_version").notNull(),
    source: text().notNull(),
    contentHash: text("content_hash").notNull(),
    status: text().default("Staged").notNull(),
    archive: jsonb().notNull(),
  },
  (t) => [...scoped(t), unique().on(t.organizationId, t.contentHash)],
);

// Migration lifecycle metadata contains no raw business package or credentials.
export const dataMigrations = pgTable(
  "data_migrations",
  {
    id: uuid().defaultRandom().primaryKey(),
    organizationId: uuid("organization_id").notNull(),
    initiatedByUserId: uuid("initiated_by_user_id").notNull(),
    source: text().notNull(),
    sourceSchemaVersion: integer("source_schema_version").notNull(),
    targetSchemaVersion: integer("target_schema_version").notNull(),
    status: text().notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    entityCounts: jsonb("entity_counts").notNull(),
    warnings: jsonb().notNull(),
    errorSummary: text("error_summary"),
    checksum: text().notNull(),
  },
  (t) => [
    foreignKey({
      name: "data_migrations_organization_id_fkey",
      columns: [t.organizationId],
      foreignColumns: [organizations.id],
    }),
    foreignKey({
      name: "data_migrations_initiated_by_user_id_fkey",
      columns: [t.initiatedByUserId],
      foreignColumns: [users.id],
    }),
    index().on(t.organizationId, t.startedAt),
    check(
      "data_migration_status",
      sql`${t.status} in ('Previewed','Running','Succeeded','Failed','RolledBack')`,
    ),
  ],
);

// Relational domain children; all references include organization scope.
export const processMaps = pgTable(
  "process_maps",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    variant: text().notNull(),
    direction: text().default("RL").notNull(),
    signature: text(),
    status: text().default("draft").notNull(),
  },
  (t) => [...scoped(t), link(t, t.processId, processes)],
);
export const processSteps = pgTable(
  "process_steps",
  {
    ...tenant(),
    mapId: uuid("map_id").notNull(),
    title: text().notNull(),
    description: text(),
    type: text().notNull(),
    input: text(),
    output: text(),
    ownerRoleId: uuid("owner_role_id"),
    workTimeMinutes: numeric("work_time_minutes"),
    waitTimeMinutes: numeric("wait_time_minutes"),
    founderDependency: text("founder_dependency"),
    reworkProbability: integer("rework_probability"),
    handoff: boolean(),
    notes: text(),
    x: numeric(),
    y: numeric(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.mapId, processMaps),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const processConnections = pgTable(
  "process_connections",
  {
    ...tenant(),
    mapId: uuid("map_id").notNull(),
    sourceStepId: uuid("source_step_id").notNull(),
    targetStepId: uuid("target_step_id").notNull(),
    label: text(),
    condition: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.mapId, processMaps),
    link(t, t.sourceStepId, processSteps),
    link(t, t.targetStepId, processSteps),
  ],
);
export const processSops = pgTable(
  "process_sops",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    title: text().notNull(),
    purpose: text(),
    scope: text(),
    status: text().default("draft").notNull(),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sourceSignature: text("source_signature"),
  },
  (t) => [...scoped(t), link(t, t.processId, processes)],
);
export const sopProcedures = pgTable(
  "sop_procedures",
  {
    ...tenant(),
    sopId: uuid("sop_id").notNull(),
    position: integer().notNull(),
    title: text().notNull(),
    description: text().notNull(),
    ownerRoleId: uuid("owner_role_id"),
  },
  (t) => [
    ...scoped(t),
    link(t, t.sopId, processSops),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const checklists = pgTable(
  "process_checklists",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    title: text().notNull(),
    description: text(),
  },
  (t) => [...scoped(t), link(t, t.processId, processes)],
);
export const checklistItems = pgTable(
  "checklist_items",
  {
    ...tenant(),
    checklistId: uuid("checklist_id").notNull(),
    position: integer().notNull(),
    title: text().notNull(),
    required: boolean().default(true).notNull(),
  },
  (t) => [...scoped(t), link(t, t.checklistId, checklists)],
);
export const decisionRules = pgTable(
  "process_decision_rules",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    title: text().notNull(),
    condition: text().notNull(),
    action: text().notNull(),
    ownerRoleId: uuid("owner_role_id"),
  },
  (t) => [
    ...scoped(t),
    link(t, t.processId, processes),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const processAssets = pgTable(
  "process_assets",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    title: text().notNull(),
    type: text().notNull(),
    url: text(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.processId, processes)],
);
export const implementationPlans = pgTable(
  "implementation_plans",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    targetGoLiveDate: date("target_go_live_date"),
    pilotStatus: text(),
    trainingStatus: text(),
    adoptionStatus: text(),
    notes: text(),
    sourceSignature: text("source_signature"),
  },
  (t) => [
    ...scoped(t),
    link(t, t.processId, processes),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const processKpis = pgTable(
  "process_kpis",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    name: text().notNull(),
    description: text(),
    unit: text().notNull(),
    direction: text().notNull(),
    target: numeric(),
    status: text().default("active").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.processId, processes),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const kpiEntries = pgTable(
  "kpi_entries",
  {
    ...tenant(),
    kpiId: uuid("kpi_id").notNull(),
    value: numeric().notNull(),
    measuredAt: date("measured_at").notNull(),
    evidence: text(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.kpiId, processKpis)],
);
export const improvements = pgTable(
  "improvements",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    ownerRoleId: uuid("owner_role_id"),
    title: text().notNull(),
    expectedImpact: text("expected_impact"),
    dueDate: date("due_date"),
    status: text().default("backlog").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.processId, processes),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const strategyContexts = pgTable(
  "strategy_contexts",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    field: text().notNull(),
    value: text().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const strategyChoices = pgTable(
  "strategy_choices",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    type: text().notNull(),
    statement: text().notNull(),
    rationale: text(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const krMilestones = pgTable(
  "kr_milestones",
  {
    ...tenant(),
    keyResultId: uuid("key_result_id").notNull(),
    title: text().notNull(),
    weight: numeric(),
    completed: boolean().default(false).notNull(),
    position: integer().notNull(),
  },
  (t) => [...scoped(t), link(t, t.keyResultId, keyResults)],
);
export const krCheckIns = pgTable(
  "kr_check_ins",
  {
    ...tenant(),
    keyResultId: uuid("key_result_id").notNull(),
    current: numeric(),
    confidence: text(),
    notes: text(),
    checkedAt: date("checked_at").notNull(),
  },
  (t) => [...scoped(t), link(t, t.keyResultId, keyResults)],
);
export const growthMetrics = pgTable(
  "growth_metrics",
  {
    ...tenant(),
    profileId: uuid("profile_id").notNull(),
    name: text().notNull(),
    value: numeric(),
    period: text(),
    unit: text(),
  },
  (t) => [...scoped(t), link(t, t.profileId, growthProfiles)],
);
export const growthDiagnostics = pgTable(
  "growth_diagnostics",
  {
    ...tenant(),
    profileId: uuid("profile_id").notNull(),
    dimension: text().notNull(),
    status: text().notNull(),
    evidence: text(),
    metricValue: numeric("metric_value"),
    benchmarkType: text("benchmark_type"),
    managementObservation: text("management_observation"),
  },
  (t) => [...scoped(t), link(t, t.profileId, growthProfiles)],
);
export const constraintEvidence = pgTable(
  "constraint_evidence",
  {
    ...tenant(),
    constraintId: uuid("constraint_id").notNull(),
    type: text().notNull(),
    description: text().notNull(),
  },
  (t) => [...scoped(t), link(t, t.constraintId, constraints)],
);
export const constraintLevers = pgTable(
  "constraint_levers",
  {
    ...tenant(),
    constraintId: uuid("constraint_id").notNull(),
    leverId: uuid("lever_id").notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.constraintId, constraints),
    link(t, t.leverId, levers),
  ],
);
export const experimentMetrics = pgTable(
  "experiment_metrics",
  {
    ...tenant(),
    experimentId: uuid("experiment_id").notNull(),
    name: text().notNull(),
    unit: text(),
    baseline: numeric(),
    target: numeric(),
    direction: text(),
  },
  (t) => [...scoped(t), link(t, t.experimentId, experiments)],
);
export const experimentMeasurements = pgTable(
  "experiment_measurements",
  {
    ...tenant(),
    experimentId: uuid("experiment_id").notNull(),
    metricId: uuid("metric_id").notNull(),
    value: numeric().notNull(),
    measuredAt: date("measured_at").notNull(),
    evidence: text(),
    notes: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.experimentId, experiments),
    link(t, t.metricId, experimentMetrics),
  ],
);
export const funnels = pgTable(
  "growth_funnels",
  {
    ...tenant(),
    name: text().notNull(),
    status: text().default("active").notNull(),
    description: text(),
    constraintId: uuid("constraint_id"),
  },
  (t) => [...scoped(t), link(t, t.constraintId, constraints)],
);
export const funnelStages = pgTable(
  "funnel_stages",
  {
    ...tenant(),
    funnelId: uuid("funnel_id").notNull(),
    name: text().notNull(),
    position: integer().notNull(),
    targetConversion: numeric("target_conversion"),
    ownerRoleId: uuid("owner_role_id"),
  },
  (t) => [
    ...scoped(t),
    link(t, t.funnelId, funnels),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const funnelPeriods = pgTable(
  "funnel_periods",
  {
    ...tenant(),
    funnelId: uuid("funnel_id").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    status: text().notNull(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.funnelId, funnels)],
);
export const funnelMeasurements = pgTable(
  "funnel_measurements",
  {
    ...tenant(),
    periodId: uuid("period_id").notNull(),
    stageId: uuid("stage_id").notNull(),
    volume: numeric(),
    revenue: numeric(),
    evidence: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.periodId, funnelPeriods),
    link(t, t.stageId, funnelStages),
  ],
);
export const funnelRevenueModels = pgTable(
  "funnel_revenue_models",
  {
    ...tenant(),
    funnelId: uuid("funnel_id").notNull(),
    averageDealValue: numeric("average_deal_value"),
    revenueTarget: numeric("revenue_target"),
    currency: text(),
    period: text(),
  },
  (t) => [...scoped(t), link(t, t.funnelId, funnels)],
);
export const channels = pgTable(
  "growth_channels",
  {
    ...tenant(),
    name: text().notNull(),
    type: text().notNull(),
    ownerRoleId: uuid("owner_role_id"),
    status: text().default("active").notNull(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.ownerRoleId, businessRoles)],
);
export const channelPeriods = pgTable(
  "channel_periods",
  {
    ...tenant(),
    channelId: uuid("channel_id").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    spend: numeric(),
    leads: numeric(),
    qualifiedLeads: numeric("qualified_leads"),
    customers: numeric(),
    revenue: numeric(),
    evidence: text(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.channelId, channels)],
);
export const loops = pgTable(
  "growth_loops",
  {
    ...tenant(),
    name: text().notNull(),
    type: text().notNull(),
    ownerRoleId: uuid("owner_role_id"),
    status: text().default("draft").notNull(),
    description: text(),
  },
  (t) => [...scoped(t), link(t, t.ownerRoleId, businessRoles)],
);
export const loopNodes = pgTable(
  "loop_nodes",
  {
    ...tenant(),
    loopId: uuid("loop_id").notNull(),
    title: text().notNull(),
    position: integer().notNull(),
    type: text().notNull(),
    ownerRoleId: uuid("owner_role_id"),
    description: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.loopId, loops),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const loopPeriods = pgTable(
  "loop_periods",
  {
    ...tenant(),
    loopId: uuid("loop_id").notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    inputVolume: numeric("input_volume"),
    outputVolume: numeric("output_volume"),
    evidence: text(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.loopId, loops)],
);
export const loopEvidence = pgTable(
  "loop_evidence",
  {
    ...tenant(),
    loopId: uuid("loop_id").notNull(),
    type: text().notNull(),
    description: text().notNull(),
    recordedAt: date("recorded_at"),
  },
  (t) => [...scoped(t), link(t, t.loopId, loops)],
);
export const loopLeakage = pgTable(
  "loop_leakage",
  {
    ...tenant(),
    loopId: uuid("loop_id").notNull(),
    nodeId: uuid("node_id"),
    description: text().notNull(),
    severity: text(),
    status: text(),
  },
  (t) => [...scoped(t), link(t, t.loopId, loops), link(t, t.nodeId, loopNodes)],
);
export const scaleCandidates = pgTable(
  "scale_candidates",
  {
    ...tenant(),
    title: text().notNull(),
    constraintId: uuid("constraint_id"),
    experimentId: uuid("experiment_id"),
    channelId: uuid("channel_id"),
    loopId: uuid("loop_id"),
    ownerRoleId: uuid("owner_role_id"),
    status: text().default("draft").notNull(),
    notes: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.constraintId, constraints),
    link(t, t.experimentId, experiments),
    link(t, t.channelId, channels),
    link(t, t.loopId, loops),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const capacityAreas = pgTable(
  "capacity_areas",
  {
    ...tenant(),
    candidateId: uuid("candidate_id").notNull(),
    name: text().notNull(),
    unit: text(),
    currentCapacity: numeric("current_capacity"),
    currentDemand: numeric("current_demand"),
    ownerRoleId: uuid("owner_role_id"),
    notes: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.candidateId, scaleCandidates),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const capacityScenarios = pgTable(
  "capacity_scenarios",
  {
    ...tenant(),
    candidateId: uuid("candidate_id").notNull(),
    name: text().notNull(),
    growthMultiplier: numeric("growth_multiplier"),
    assumptions: text(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.candidateId, scaleCandidates)],
);
export const financialCapacity = pgTable(
  "financial_capacity",
  {
    ...tenant(),
    candidateId: uuid("candidate_id").notNull(),
    availableBudget: numeric("available_budget"),
    requiredBudget: numeric("required_budget"),
    currency: text(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.candidateId, scaleCandidates)],
);
export const scaleInvestments = pgTable(
  "scale_investments",
  {
    ...tenant(),
    candidateId: uuid("candidate_id").notNull(),
    title: text().notNull(),
    amount: numeric(),
    currency: text(),
    status: text(),
    notes: text(),
  },
  (t) => [...scoped(t), link(t, t.candidateId, scaleCandidates)],
);
export const scalePreparation = pgTable(
  "scale_preparation_items",
  {
    ...tenant(),
    candidateId: uuid("candidate_id").notNull(),
    title: text().notNull(),
    ownerRoleId: uuid("owner_role_id"),
    dueDate: date("due_date"),
    status: text().default("pending").notNull(),
    notes: text(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.candidateId, scaleCandidates),
    link(t, t.ownerRoleId, businessRoles),
  ],
);
export const scaleDecisions = pgTable(
  "scale_decisions",
  {
    ...tenant(),
    candidateId: uuid("candidate_id").notNull(),
    decision: text().notNull(),
    reason: text().notNull(),
    decidedByUserId: uuid("decided_by_user_id").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }).notNull(),
  },
  (t) => [...scoped(t), link(t, t.candidateId, scaleCandidates)],
);

// Immutable decision/history payloads intentionally retain source-time snapshots.
export const systemSnapshots = pgTable(
  "system_snapshots",
  {
    ...tenant(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t)],
);
export const processAnalyses = pgTable(
  "process_analyses",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.processId, processes)],
);
export const processReviews = pgTable(
  "process_reviews",
  {
    ...tenant(),
    processId: uuid("process_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.processId, processes)],
);
export const weeklyReviews = pgTable(
  "strategy_weekly_reviews",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const adaptReviews = pgTable(
  "strategy_adapt_reviews",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const cycleReviews = pgTable(
  "strategy_cycle_reviews",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const strategySnapshots = pgTable(
  "strategy_snapshots",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const strategyLearnings = pgTable(
  "strategy_learnings",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const strategyChanges = pgTable(
  "strategy_changes",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const strategicAssumptions = pgTable(
  "strategic_assumptions",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const cycleResets = pgTable(
  "strategy_cycle_resets",
  {
    ...tenant(),
    cycleId: uuid("cycle_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.cycleId, strategyCycles)],
);
export const experimentLearnings = pgTable(
  "experiment_learnings",
  {
    ...tenant(),
    experimentId: uuid("experiment_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.experimentId, experiments)],
);
export const experimentDecisions = pgTable(
  "experiment_decisions",
  {
    ...tenant(),
    experimentId: uuid("experiment_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.experimentId, experiments)],
);
export const ideaReviews = pgTable(
  "idea_reviews",
  {
    ...tenant(),
    ideaId: uuid("idea_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.ideaId, ideas)],
);
export const ideaHistory = pgTable(
  "idea_history",
  {
    ...tenant(),
    ideaId: uuid("idea_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.ideaId, ideas)],
);
export const channelDecisions = pgTable(
  "channel_decisions",
  {
    ...tenant(),
    channelId: uuid("channel_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.channelId, channels)],
);
export const readinessSnapshots = pgTable(
  "scale_readiness_snapshots",
  {
    ...tenant(),
    candidateId: uuid("candidate_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.candidateId, scaleCandidates)],
);
export const scaleSnapshots = pgTable(
  "scale_snapshots",
  {
    ...tenant(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t)],
);
export const agentDiagnosisHistory = pgTable(
  "agent_diagnosis_history",
  {
    ...tenant(),
    diagnosisId: uuid("diagnosis_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.diagnosisId, agentDiagnoses)],
);
export const agentActionRevisions = pgTable(
  "agent_action_revisions",
  {
    ...tenant(),
    actionId: uuid("action_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.actionId, agentActions)],
);
export const agentRollbacks = pgTable(
  "agent_rollback_records",
  {
    ...tenant(),
    executionId: uuid("execution_id").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull(),
    snapshot: jsonb().notNull(),
  },
  (t) => [...scoped(t), link(t, t.executionId, agentExecutions)],
);

export const assessmentRuns = pgTable(
  "assessment_runs",
  {
    ...tenant(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    formulaVersion: text("formula_version").notNull(),
  },
  (t) => [...scoped(t)],
);
export const assessmentAnswers = pgTable(
  "assessment_answers",
  {
    ...tenant(),
    runId: uuid("run_id").notNull(),
    questionKey: text("question_key").notNull(),
    answer: integer().notNull(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.runId, assessmentRuns),
    unique().on(t.runId, t.questionKey),
    check("answer_range", sql`${t.answer} between 1 and 5`),
  ],
);
export const organizationNodes = pgTable(
  "business_organization_nodes",
  {
    ...tenant(),
    kind: text().notNull(),
    departmentId: uuid("department_id"),
    businessRoleId: uuid("business_role_id"),
    parentNodeId: uuid("parent_node_id"),
    x: numeric(),
    y: numeric(),
  },
  (t) => [
    ...scoped(t),
    link(t, t.departmentId, departments),
    link(t, t.businessRoleId, businessRoles),
    foreignKey({
      columns: [t.organizationId, t.parentNodeId],
      foreignColumns: [t.organizationId, t.id],
    }),
    check(
      "node_entity",
      sql`(${t.kind}='department' and ${t.departmentId} is not null and ${t.businessRoleId} is null) or (${t.kind}='role' and ${t.businessRoleId} is not null and ${t.departmentId} is null)`,
    ),
  ],
);
