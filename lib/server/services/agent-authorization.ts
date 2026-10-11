import "server-only";
import { and, eq, getTableColumns } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Database } from "../db/types";
import * as S from "../db/schema";
import {
  requireAllPermissions,
  requireScope,
  type OrganizationContext,
} from "../context";
import type { Permission } from "../permissions";
import { DataError } from "../db/errors";
import { agentActionPermissionMap } from "../../saas/agent-action-permissions";
function targetPermissions(capabilityId: string): readonly Permission[] {
  const target = Object.hasOwn(agentActionPermissionMap, capabilityId)
    ? agentActionPermissionMap[capabilityId]
    : undefined;
  if (!target) throw new DataError("Disabled", 403);
  return target;
}
function approvalPermission(capabilityId: string): Permission {
  return capabilityId.startsWith("system.")
    ? "system.approve"
    : capabilityId.startsWith("strategy.")
      ? "strategy.approve"
      : "scale.approve";
}
export async function listAgentActions(
  db: Database,
  context: OrganizationContext,
) {
  await requireAllPermissions(db, context, ["agent.view"]);
  // Prepared actions are shared company artifacts. Conversations remain creator-private.
  const actions = await db
    .select({
      ...getTableColumns(S.agentActions),
      preparedByName: S.users.name,
    })
    .from(S.agentActions)
    .innerJoin(S.users, eq(S.users.id, S.agentActions.requestedByUserId))
    .where(eq(S.agentActions.organizationId, context.organizationId));
  const approvals = await db
    .select({
      ...getTableColumns(S.agentApprovals),
      approvedByName: S.users.name,
    })
    .from(S.agentApprovals)
    .innerJoin(S.users, eq(S.users.id, S.agentApprovals.approvedByUserId))
    .where(eq(S.agentApprovals.organizationId, context.organizationId));
  return { actions, approvals, executionEnabled: false };
}
export async function prepareAgentAction(
  db: Database,
  context: OrganizationContext,
  input: { capabilityId: string; title: string; payload: unknown },
) {
  const permissions = targetPermissions(input.capabilityId);
  if (
    typeof input.title !== "string" ||
    !input.title.trim() ||
    input.title.length > 200 ||
    !input.payload ||
    typeof input.payload !== "object" ||
    Array.isArray(input.payload) ||
    Buffer.byteLength(JSON.stringify(input.payload)) > 16000
  )
    throw new DataError("InvalidInput");
  return db.transaction(async (tx) => {
    const fresh = await requireAllPermissions(tx, context, [
      "agent.prepare",
      ...permissions,
    ]);
    const [workspace] = await tx
      .select()
      .from(S.tenantWorkspaces)
      .where(
        and(
          eq(S.tenantWorkspaces.organizationId, fresh.organizationId),
          eq(S.tenantWorkspaces.ownerKey, "shared"),
        ),
      )
      .for("update");
    if (!workspace) throw new DataError("Conflict", 409);
    const binding = createHash("sha256")
      .update(
        JSON.stringify({
          organizationId: fresh.organizationId,
          capabilityId: input.capabilityId,
          title: input.title.trim(),
          payload: input.payload,
          sharedVersion: workspace.version,
        }),
      )
      .digest("hex");
    const [action] = await tx
      .insert(S.agentActions)
      .values({
        organizationId: fresh.organizationId,
        requestedByUserId: fresh.userId,
        capabilityId: input.capabilityId,
        templateId: input.capabilityId,
        title: input.title.trim(),
        risk: "Medium",
        binding,
        payload: input.payload,
        frozenEvidence: [],
        expectedState: { sharedVersion: workspace.version },
      })
      .returning();
    await tx.insert(S.auditEvents).values({
      organizationId: fresh.organizationId,
      actorUserId: fresh.userId,
      actorType: "User",
      module: "Agent",
      action: "AgentActionPrepared",
      entityType: "agentAction",
      entityId: action.id,
      metadata: {
        capabilityId: action.capabilityId,
        revision: action.revision,
      },
    });
    return action;
  });
}
export async function approveAgentAction(
  db: Database,
  context: OrganizationContext,
  input: { actionId: string; revision: number; decision: string },
) {
  requireScope(input.actionId);
  if (
    !Number.isInteger(input.revision) ||
    !["Approved", "Rejected"].includes(input.decision)
  )
    throw new DataError("InvalidInput");
  return db.transaction(async (tx) => {
    await requireAllPermissions(tx, context, ["agent.approve"]);
    const [action] = await tx
      .select()
      .from(S.agentActions)
      .where(
        and(
          eq(S.agentActions.organizationId, context.organizationId),
          eq(S.agentActions.id, input.actionId),
        ),
      )
      .for("update");
    if (!action) throw new DataError("NotFound", 404);
    await requireAllPermissions(tx, context, [
      approvalPermission(action.capabilityId),
      ...targetPermissions(action.capabilityId),
    ]);
    if (action.revision !== input.revision || action.status !== "Draft")
      throw new DataError("Conflict", 409);
    const [workspace] = await tx
      .select()
      .from(S.tenantWorkspaces)
      .where(
        and(
          eq(S.tenantWorkspaces.organizationId, context.organizationId),
          eq(S.tenantWorkspaces.ownerKey, "shared"),
        ),
      );
    if (
      !workspace ||
      (action.expectedState as { sharedVersion: number }).sharedVersion !==
        workspace.version
    )
      throw new DataError("Conflict", 409);
    const [approval] = await tx
      .insert(S.agentApprovals)
      .values({
        organizationId: context.organizationId,
        actionId: action.id,
        approvedByUserId: context.userId,
        revision: action.revision,
        binding: action.binding,
        decision: input.decision,
        expiresAt: new Date(Date.now() + 24 * 3600000),
      })
      .returning();
    await tx
      .update(S.agentActions)
      .set({ status: input.decision, updatedAt: new Date() })
      .where(
        and(
          eq(S.agentActions.organizationId, context.organizationId),
          eq(S.agentActions.id, action.id),
        ),
      );
    await tx.insert(S.auditEvents).values({
      organizationId: context.organizationId,
      actorUserId: context.userId,
      actorType: "User",
      module: "Agent",
      action: "AgentAction" + input.decision,
      entityType: "agentAction",
      entityId: action.id,
      metadata: {
        approvalId: approval.id,
        preparedByUserId: action.requestedByUserId,
        approvedByUserId: context.userId,
        revision: action.revision,
      },
    });
    return approval;
  });
}
export async function authorizeAgentExecution(
  db: Database,
  context: OrganizationContext,
  input: { actionId: string; approvalId: string; explicitExecute: boolean },
) {
  requireScope(input.actionId);
  requireScope(input.approvalId);
  await requireAllPermissions(db, context, ["agent.execute"]);
  const [action] = await db
    .select()
    .from(S.agentActions)
    .where(
      and(
        eq(S.agentActions.organizationId, context.organizationId),
        eq(S.agentActions.id, input.actionId),
      ),
    );
  if (!action) throw new DataError("NotFound", 404);
  await requireAllPermissions(
    db,
    context,
    targetPermissions(action.capabilityId),
  );
  const [approval] = await db
    .select()
    .from(S.agentApprovals)
    .where(
      and(
        eq(S.agentApprovals.organizationId, context.organizationId),
        eq(S.agentApprovals.id, input.approvalId),
        eq(S.agentApprovals.actionId, action.id),
      ),
    );
  if (
    !input.explicitExecute ||
    !approval ||
    approval.decision !== "Approved" ||
    approval.expiresAt <= new Date() ||
    approval.revision !== action.revision ||
    approval.binding !== action.binding ||
    action.status !== "Approved"
  )
    throw new DataError("Forbidden", 403);
  const [workspace] = await db
    .select()
    .from(S.tenantWorkspaces)
    .where(
      and(
        eq(S.tenantWorkspaces.organizationId, context.organizationId),
        eq(S.tenantWorkspaces.ownerKey, "shared"),
      ),
    );
  if (
    !workspace ||
    (action.expectedState as { sharedVersion: number }).sharedVersion !==
      workspace.version
  )
    throw new DataError("Conflict", 409);
  // 7C deliberately excludes migrating the executor. Never manufacture an execution actor/record.
  throw new DataError("Disabled", 403);
}
