import "server-only";
import { requirePermission, type OrganizationContext } from "../context";
import type { Permission } from "../permissions";
import { DataError } from "../db/errors";
type RecordValue = Record<string, any>;
const value = (raw: string | null): RecordValue => (raw ? JSON.parse(raw) : {});
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
export function workspaceViewPermission(key: string): Permission {
  if (key === "growth-engine.assessment.v2") return "organization.view";
  return key.includes("agent") || key.includes("advisor")
    ? "agent.view"
    : key.includes("strategy")
      ? "strategy.view"
      : key.includes("scale")
        ? "scale.view"
        : "system.view";
}
// Inspect canonical validated documents, not submitted permission hints.
export function authorizeWorkspaceChange(
  context: OrganizationContext,
  key: string,
  oldRaw: string | null,
  newRaw: string | null,
) {
  const before = value(oldRaw),
    after = value(newRaw);
  if (key === "growth-engine.assessment.v2") {
    if (context.accessTier === "full_access" && context.permissions.includes("system.edit")) requirePermission(context,"system.edit");
    else requirePermission(context, "organization.update");
    return;
  }
  const module = workspaceViewPermission(key).split(".")[0] as
    "system" | "strategy" | "scale" | "agent";
  requirePermission(context, workspaceViewPermission(key));
  if (module === "agent") {
    if (key.includes("execution") || key === "growth-engine.agent.v1")
      throw new DataError("Disabled", 403);
    // Approval actors and shared draft transitions use the canonical server service.
    if (key.includes("preparation")) throw new DataError("Disabled", 403);
    requirePermission(
      context,
      key.includes("diagnosis")
        ? "agent.diagnose"
        : key.includes("advisor")
          ? "agent.ask"
          : "agent.recommend",
    );
    return;
  }
  requirePermission(context, `${module}.edit`);
  const check = (field: string, permission: Permission) => {
    if (!equal(before[field] ?? [], after[field] ?? []))
      requirePermission(context, permission);
  };
  if (module === "system") {
    if (key === "growth-engine.system.v1") {
      for (const field of ["departments", "people"])
        check(field, "system.organization.edit");
      check("roles", "system.roles.edit");
      check("processes", "system.process.edit");
    }
    if (key.includes("process-maps") || key.includes("process-analysis"))
      requirePermission(context, "system.process.edit");
    if (key.includes("standards")) {
      requirePermission(context, "system.sop.edit");
      for (const record of after.records ?? []) {
        const previous = (before.records ?? []).find(
          (r: RecordValue) => r.processId === record.processId,
        );
        if (
          !equal(previous?.sop, record.sop) &&
          (record.sop?.status === "approved" ||
            previous?.sop?.status === "approved" ||
            record.sop?.approvedAt ||
            record.sop?.approvedByRoleId)
        )
          requirePermission(context, "system.sop.approve");
      }
    }
    if (key.includes("measurement")) {
      for (const record of after.records ?? []) {
        const previous = (before.records ?? []).find(
          (r: RecordValue) => r.processId === record.processId,
        );
        if (
          !equal(previous?.kpis ?? [], record.kpis ?? []) ||
          !equal(previous?.entries ?? [], record.entries ?? [])
        )
          requirePermission(context, "system.kpi.edit");
        if (!equal(previous?.improvements ?? [], record.improvements ?? []))
          requirePermission(context, "system.improvement.edit");
      }
    }
  }
  if (module === "strategy") {
    for (const field of ["cycles", "cycleResets"])
      check(field, "strategy.cycle.manage");
    check("objectives", "strategy.objective.edit");
    check("keyResults", "strategy.kr.edit");
    check("initiatives", "strategy.initiative.edit");
    for (const field of ["weeklyReviews", "krCheckIns", "strategyDecisions"])
      check(field, "strategy.review.edit");
    for (const field of [
      "adaptReviews",
      "cycleReviews",
      "strategyChanges",
      "strategyLearnings",
      "strategicAssumptions",
    ])
      check(field, "strategy.adapt.edit");
    for (const kr of after.keyResults ?? []) {
      const previous = (before.keyResults ?? []).find(
        (r: RecordValue) => r.id === kr.id,
      );
      if (previous && !equal(previous.targetValue, kr.targetValue))
        requirePermission(context, "strategy.kr.target_change");
    }
  }
  if (module === "scale") {
    check("constraints", "scale.constraint.edit");
    check("experimentData", "scale.experiment.edit");
    check("funnelData", "scale.funnel.edit");
    if (!equal(before.networkData, after.networkData)) {
      requirePermission(context, "scale.channel.edit");
      requirePermission(context, "scale.loop.edit");
    }
    if (!equal(before.readinessData, after.readinessData))
      requirePermission(context, "scale.readiness.edit");
    if (
      !equal(
        before.readinessData?.decisions ?? [],
        after.readinessData?.decisions ?? [],
      )
    )
      requirePermission(context, "scale.decision.approve");
  }
  // Creation/removal and archive transitions cannot bypass generic create/archive grants.
  function walk(a: any, b: any) {
    if (Array.isArray(a) || Array.isArray(b)) {
      const oldRows = Array.isArray(a) ? a : [],
        newRows = Array.isArray(b) ? b : [];
      if (
        newRows.some(
          (r) =>
            r &&
            typeof r === "object" &&
            r.id &&
            !oldRows.some((o) => o?.id === r.id),
        )
      )
        requirePermission(context, `${module}.create` as Permission);
      if (
        oldRows.some(
          (r) =>
            r &&
            typeof r === "object" &&
            r.id &&
            !newRows.some((o) => o?.id === r.id),
        )
      )
        requirePermission(context, `${module}.archive` as Permission);
      for (const row of newRows)
        if (row && typeof row === "object")
          walk(oldRows.find((o) => o?.id && o.id === row.id) ?? {}, row);
    } else if (b && typeof b === "object") {
      for (const [field, next] of Object.entries(b)) {
        if (
          ["status", "lifecycle"].includes(field) &&
          ["archived", "cancelled"].includes(String(next)) &&
          a?.[field] !== next
        )
          requirePermission(context, `${module}.archive` as Permission);
        if (next && typeof next === "object") walk(a?.[field], next);
      }
    }
  }
  walk(before, after);
}
export function workspaceSecurityEvents(
  key: string,
  oldRaw: string | null,
  newRaw: string | null,
): string[] {
  const before = value(oldRaw),
    after = value(newRaw),
    events: string[] = [];
  if (key.includes("strategy"))
    for (const kr of after.keyResults ?? []) {
      const old = (before.keyResults ?? []).find(
        (r: RecordValue) => r.id === kr.id,
      );
      if (old && !equal(old.targetValue, kr.targetValue))
        events.push("KRTargetChanged");
    }
  if (key.includes("standards"))
    for (const record of after.records ?? []) {
      const old = (before.records ?? []).find(
        (r: RecordValue) => r.processId === record.processId,
      );
      if (record.sop?.status === "approved" && old?.sop?.status !== "approved")
        events.push("SOPApproved");
    }
  if (
    key.includes("scale") &&
    !equal(
      before.readinessData?.decisions ?? [],
      after.readinessData?.decisions ?? [],
    )
  )
    events.push("ScaleDecisionApproved");
  return [...new Set(events)];
}
