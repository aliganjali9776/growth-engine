import "server-only";
import { and, eq } from "drizzle-orm";
import type { Database } from "./db/types";
import {
  users,
  organizations,
  memberships,
  membershipRoles,
  accessRoles,
  rolePermissions,
} from "./db/schema";
import { DataError } from "./db/errors";
import type { Permission } from "./permissions";
export interface OrganizationContext {
  readonly accessTier?: "assessment_only" | "full_access";
  readonly organizationId: string;
  readonly userId: string;
  readonly membershipId: string;
  readonly roleIds: readonly string[];
  readonly permissions: readonly string[];
  readonly roles?: readonly { id: string; name: string }[];
  readonly status?: "Active";
  readonly membership?: Readonly<{
    id: string;
    status: string;
    version: number;
  }>;
}
export interface AuthenticatedActorResolver {
  resolveUserId(): Promise<string | null>;
}
export function requireScope(
  organizationId: unknown,
): asserts organizationId is string {
  if (
    typeof organizationId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      organizationId,
    )
  )
    throw new DataError("InvalidInput");
}
// userId must come from a server actor resolver, never request JSON or UI role state.
export async function resolveOrganizationContext(
  db: Database,
  userId: string,
  organizationId: string,
): Promise<OrganizationContext> {
  requireScope(organizationId);
  requireScope(userId);
  const [member] = await db
    .select({
      id: memberships.id,
      status: memberships.status,
      version: memberships.version,
    })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(
      and(
        eq(memberships.organizationId, organizationId),
        eq(memberships.userId, userId),
        eq(memberships.status, "Active"),
        eq(users.status, "Active"),
      ),
    );
  if (!member) throw new DataError("Forbidden", 403);
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId));
  if (!org || !["Active", "Trial"].includes(org.status))
    throw new DataError("Forbidden", 403);
  const roles = await db
    .select({ id: accessRoles.id, name: accessRoles.name })
    .from(membershipRoles)
    .innerJoin(
      accessRoles,
      and(
        eq(accessRoles.id, membershipRoles.roleId),
        eq(accessRoles.organizationId, organizationId),
      ),
    )
    .where(
      and(
        eq(membershipRoles.organizationId, organizationId),
        eq(membershipRoles.membershipId, member.id),
      ),
    );
  const grants = await db
    .select({
      key: rolePermissions.permissionKey,
      roleId: rolePermissions.roleId,
    })
    .from(rolePermissions)
    .where(eq(rolePermissions.organizationId, organizationId));
  const ids = roles.map((r) => r.id),
    permissions = [
      ...new Set(
        grants.filter((g) => ids.includes(g.roleId)).map((g) => g.key),
      ),
    ].sort();
  return Object.freeze({
    accessTier: org.accessTier,
    organizationId,
    userId,
    membershipId: member.id,
    roleIds: Object.freeze(ids.sort()),
    permissions: Object.freeze(org.accessTier === "full_access" ? permissions : permissions.filter(p => !/^(system|strategy|scale|agent)\./.test(p))),
    roles: Object.freeze(roles.map((r) => Object.freeze(r))),
    status: "Active",
    membership: Object.freeze(member),
  });
}
export async function requireOrganizationContext(
  db: Database,
  actor: AuthenticatedActorResolver,
  organizationId: string,
) {
  const userId = await actor.resolveUserId();
  if (!userId) throw new DataError("Unauthenticated", 401);
  return resolveOrganizationContext(db, userId, organizationId);
}
export function assertPermission(
  context: OrganizationContext,
  permission: Permission,
) {
  if (context.accessTier !== "full_access" && /^(system|strategy|scale|agent)\./.test(permission))
    throw new DataError("Forbidden", 403);
  if (!context.permissions.includes(permission))
    throw new DataError("Forbidden", 403);
}
export function requirePermission(
  db: Database,
  context: OrganizationContext,
  permission: Permission,
): Promise<OrganizationContext>;
/** @deprecated Internal assertion compatibility. Protected entry points must pass the database. */
export function requirePermission(
  context: OrganizationContext,
  permission: Permission,
): void;
export function requirePermission(
  dbOrContext: Database | OrganizationContext,
  contextOrPermission: OrganizationContext | Permission,
  permission?: Permission,
): Promise<OrganizationContext> | void {
  if (permission !== undefined) {
    const context = contextOrPermission as OrganizationContext;
    return resolveOrganizationContext(
      dbOrContext as Database,
      context.userId,
      context.organizationId,
    ).then((fresh) => {
      assertPermission(fresh, permission);
      return fresh;
    });
  }
  assertPermission(
    dbOrContext as OrganizationContext,
    contextOrPermission as Permission,
  );
}
export async function reauthorize(
  db: Database,
  context: OrganizationContext,
  permission: Permission,
) {
  return requirePermission(db, context, permission);
}
export async function resolveOrganizationPermissions(
  db: Database,
  input: { userId: string; organizationId: string },
) {
  return resolveOrganizationContext(db, input.userId, input.organizationId);
}
export async function requireAllPermissions(
  db: Database,
  context: OrganizationContext,
  permissions: readonly Permission[],
) {
  const fresh = await resolveOrganizationContext(
    db,
    context.userId,
    context.organizationId,
  );
  for (const permission of permissions) requirePermission(fresh, permission);
  return fresh;
}
export async function requireAnyPermission(
  db: Database,
  context: OrganizationContext,
  permissions: readonly Permission[],
) {
  const fresh = await resolveOrganizationContext(
    db,
    context.userId,
    context.organizationId,
  );
  if (!permissions.some((p) => fresh.permissions.includes(p)))
    throw new DataError("Forbidden", 403);
  return fresh;
}
export type ResourceScope =
  | { kind: "AllOrganization" }
  | { kind: "OwnRecords" }
  | { kind: "AssignedResources"; resourceIds: readonly string[] };
export function requireResourceScope(
  context: OrganizationContext,
  scope: ResourceScope,
  resource: {
    organizationId: string;
    id: string;
    createdByUserId?: string | null;
  },
) {
  if (
    resource.organizationId !== context.organizationId ||
    (scope.kind === "OwnRecords" &&
      resource.createdByUserId !== context.userId) ||
    (scope.kind === "AssignedResources" &&
      !scope.resourceIds.includes(resource.id))
  )
    throw new DataError("NotFound", 404);
}
