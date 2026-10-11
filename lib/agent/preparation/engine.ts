import { canonical } from "../actions";
import { validateEvidence } from "../advisor/validation";
import { reviewEvidence } from "../evidence";
import type { AgentPermission, AgentEvidence } from "../types";
import type { PreparationContext } from "./context";
import { findEntity, sourceSnapshot } from "./context";
import type {
  PreparationState,
  PreparedAction,
  TemplateId,
  PreparationEvent,
} from "./types";
import { buildDraft, template, getField, putField } from "./templates";
import {
  recommendationFor,
  actionPlanFor,
  validatePlan,
} from "./recommendations";
import { actionRefs, validateAgentProposedAction } from "./validation";
function audit(
  s: PreparationState,
  event: PreparationEvent,
  a: string,
  summary: string,
) {
  for (const plan of s.plans) {
    if (plan.status === "Archived") continue;
    const actions = plan.steps.map((step) =>
      s.actions.find((a) => a.id === step.proposedActionId),
    );
    plan.status =
      actions.length && actions.every((a) => a?.status === "Approved")
        ? "ApprovedConceptually"
        : actions.length &&
            actions.every(
              (a) =>
                a?.validation.status === "Valid" &&
                !["Rejected", "Archived", "NeedsReview"].includes(a.status),
            )
          ? "ReadyForReview"
          : "Draft";
  }
  s.audit.push({
    id: crypto.randomUUID(),
    event,
    artifactId: a,
    timestamp: new Date().toISOString(),
    summary,
    affectedEntities: s.actions.find((x) => x.id === a)?.affectedEntities ?? [],
    dryRun: true,
  });
}
function freezeEvidence(
  s: PreparationState,
  c: PreparationContext,
  ids: string[],
) {
  for (const id of ids) {
    const e = c.diagnosis.evidence.find((e) => e.id === id);
    if (e && !s.evidence.some((x) => x.id === id))
      s.evidence.push(reviewEvidence(e));
  }
}
export function generateRecommendation(
  s: PreparationState,
  c: PreparationContext,
  diagnosisId: string,
) {
  const d = c.diagnosis.diagnoses.find((d) => d.id === diagnosisId);
  if (
    !d ||
    d.needsRefresh ||
    ["Resolved", "Dismissed"].includes(d.status) ||
    c.diagnosis.runs.at(-1)?.contextVersion !== c.version
  )
    throw Error("ابتدا تحلیل را تازه‌سازی کنید.");
  const existing = s.recommendations.find(
    (r) =>
      r.diagnosisId === diagnosisId &&
      r.sourceVersion === c.version &&
      !["Archived", "PotentiallyStale"].includes(r.status),
  );
  if (existing) return existing;
  const r = recommendationFor(d, c);
  freezeEvidence(s, c, r.evidenceIds);
  s.recommendations.push(r);
  audit(
    s,
    "RecommendationCreated",
    r.id,
    "پیشنهاد دارای گزینه‌های اقدام ایجاد شد.",
  );
  return r;
}
export function createPlan(
  s: PreparationState,
  c: PreparationContext,
  diagnosisId: string,
) {
  const r = generateRecommendation(s, c, diagnosisId),
    d = c.diagnosis.diagnoses.find((d) => d.id === diagnosisId)!;
  const old = s.plans.find(
    (p) => p.diagnosisId === d.id && p.status !== "Archived",
  );
  if (old) return old;
  const plan = actionPlanFor(d);
  const errors = validatePlan(plan);
  if (errors.length) throw Error(errors.join(" "));
  s.plans.push(plan);
  return plan;
}
export interface PrepareInput {
  templateId: TemplateId;
  targetEntityId?: string;
  diagnosisId?: string;
  recommendationId?: string;
  optionId?: string;
  variant?: boolean;
  origin?: PreparedAction["origin"];
  evidence?: AgentEvidence[];
  reason?: string;
  planId?: string;
  stepId?: string;
}
export function prepareDraft(
  s: PreparationState,
  c: PreparationContext,
  input: PrepareInput,
): PreparedAction {
  const t = template(input.templateId);
  let recommendation = input.recommendationId
    ? s.recommendations.find((r) => r.id === input.recommendationId)
    : input.diagnosisId
      ? generateRecommendation(s, c, input.diagnosisId)
      : undefined;
  if (input.recommendationId && !recommendation)
    throw Error("پیشنهاد وجود ندارد.");
  const d = c.diagnosis.diagnoses.find(
    (d) => d.id === (input.diagnosisId ?? recommendation?.diagnosisId),
  );
  if (d && (d.needsRefresh || ["Resolved", "Dismissed"].includes(d.status)))
    throw Error("تحلیل دیگر قابل اقدام نیست.");
  if (
    recommendation &&
    (recommendation.sourceVersion !== c.version ||
      recommendation.status === "PotentiallyStale")
  )
    throw Error("پیشنهاد قدیمی است؛ تحلیل و پیشنهاد را تازه کنید.");
  if (
    input.optionId &&
    !recommendation?.actionOptions.some(
      (o) => o.id === input.optionId && o.templateId === t.id,
    )
  )
    throw Error("گزینه اقدام معتبر نیست.");
  const linked =
    d?.affectedEntities
      .filter((r) => r.entityType === t.targetType)
      .map((r) => r.entityId) ?? [];
  if (!linked.length && d && ["objective", "cycle"].includes(t.targetType)) {
    for (const ref of d.affectedEntities) {
      const value = findEntity(c, ref.entityType, ref.entityId)?.value;
      const key = t.targetType === "objective" ? "objectiveId" : "cycleId";
      if (
        typeof value?.[key] === "string" &&
        findEntity(c, t.targetType, String(value[key]))
      )
        linked.push(String(value[key]));
    }
  }
  const uniqueTargets = [...new Set(linked)];
  const targetId =
    input.targetEntityId ??
    (uniqueTargets.length === 1 ? uniqueTargets[0] : "");
  if (targetId && t.targetType && !findEntity(c, t.targetType, targetId))
    throw Error("موضوع انتخاب‌شده در منبع فعلی وجود ندارد.");
  const dedupKey = canonical([
    d?.id ?? "direct",
    t.capabilityId,
    targetId,
    t.id,
  ]);
  const old = s.actions.find(
    (a) =>
      a.dedupKey === dedupKey && !["Rejected", "Archived"].includes(a.status),
  );
  if (old && !input.variant) {
    if (input.planId) {
      const p = s.plans.find((p) => p.id === input.planId),
        step = p?.steps.find((x) => x.id === input.stepId);
      if (!step || step.templateId !== t.id)
        throw Error("گام برنامه معتبر نیست.");
      step.proposedActionId = old.id;
      old.dependencyIds = [...step.dependencyIds];
      expire(s, old.id);
      old.status = "Draft";
      old.validation = validateAgentProposedAction(old, s, c);
    }
    return old;
  }
  const reason =
      input.reason ??
      d?.summary ??
      "درخواست صریح مدیر برای بررسی تغییر پیشنهادی",
    b = buildDraft(t.id, c, targetId, reason, d?.title);
  let evidenceIds = d?.evidenceIds ?? recommendation?.evidenceIds ?? [];
  freezeEvidence(s, c, evidenceIds);
  if (input.evidence) {
    for (const ev of input.evidence) {
      validateEvidence(ev);
      if (!s.evidence.some((e) => e.id === ev.id))
        s.evidence.push(structuredClone(ev));
    }
    evidenceIds = input.evidence.map((e) => e.id);
  }
  if (!evidenceIds.length) {
    const target = findEntity(c, t.targetType, targetId);
    if (target) {
      const ev: AgentEvidence = {
        id: crypto.randomUUID(),
        domain: t.domain,
        entityRef: target.ref,
        evidenceType: "Status",
        title: target.ref.label ?? t.title,
        summary:
          "وضعیت فعلی منبع انتخاب‌شده برای درخواست صریح مدیر؛ اثر تغییر هنوز آزموده نشده است.",
        value: { status: target.value.status ?? "unknown" },
        createdAt: new Date().toISOString(),
        confidence: "Low",
        route: target.ref.route,
      };
      s.evidence.push(ev);
      evidenceIds = [ev.id];
    }
  }
  const a: PreparedAction = {
    id: crypto.randomUUID(),
    templateId: t.id,
    capabilityId: t.capabilityId,
    domain: t.domain,
    actionType: t.id,
    entityType: t.targetType || "managementNote",
    targetEntityId: targetId,
    title: String(b.payload.title ?? b.payload.name),
    rationale: reason,
    payload: b.payload,
    affectedEntities:
      d?.affectedEntities.filter(
        (r) => !!findEntity(c, r.entityType, r.entityId),
      ) ?? [],
    evidenceIds: [...evidenceIds],
    risk: t.risk,
    riskLevel: t.risk,
    reversibility: t.reversibility,
    requiresApproval: true,
    approvalPolicy: "AlwaysRequired",
    dryRun: true,
    status: "Draft",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    expectedCurrentState: {},
    currentStateSnapshot: {},
    proposedStateSnapshot: structuredClone(b.payload),
    fields: b.fields,
    validation: {
      status: "NeedsInput",
      missing: [],
      errors: [],
      warnings: [],
      completeness: 0,
      validatedAt: new Date().toISOString(),
    },
    expectedImpact: t.expectedImpact,
    assumptions: ["الگوی هم‌زمانی شواهد به معنی رابطه علّی قطعی نیست."],
    warnings:
      t.risk === "Critical"
        ? ["این اقدام صرفاً بررسی مفهومی است؛ اجرا وجود ندارد."]
        : [],
    revision: 1,
    origin: input.origin ?? (d ? "Diagnosis" : "Manual"),
    sourceDiagnosisId: d?.id,
    sourceRecommendationId: recommendation?.id,
    dedupKey,
    dependencyIds: [],
  };
  a.affectedEntities = actionRefs(a, c);
  a.expectedCurrentState = sourceSnapshot(c, a.affectedEntities);
  a.currentStateSnapshot = structuredClone(a.expectedCurrentState);
  if (input.planId) {
    const p = s.plans.find((p) => p.id === input.planId),
      step = p?.steps.find((x) => x.id === input.stepId);
    if (!p || !step || step.templateId !== t.id)
      throw Error("گام برنامه معتبر نیست.");
    step.proposedActionId = a.id;
    a.dependencyIds = [...step.dependencyIds];
  }
  s.actions.push(a);
  s.revisions.push({
    id: crypto.randomUUID(),
    actionId: a.id,
    revision: 1,
    changedFields: a.fields.map((f) => f.path),
    changedAt: a.createdAt,
    source: "Agent",
    payload: structuredClone(a.payload),
  });
  a.validation = validateAgentProposedAction(a, s, c);
  audit(s, "ActionOptionSelected", a.id, "گزینه به درخواست مدیر انتخاب شد.");
  audit(
    s,
    "ActionDraftCreated",
    a.id,
    "پیش‌نویس ایجاد شد؛ داده کسب‌وکار تغییر نکرد.",
  );
  return a;
}
function action(s: PreparationState, id: string) {
  const a = s.actions.find((a) => a.id === id);
  if (!a) throw Error("پیش‌نویس پیدا نشد.");
  return a;
}
function expire(s: PreparationState, id: string) {
  for (const r of s.approvals.filter(
    (r) =>
      r.proposedActionId === id && ["Pending", "Approved"].includes(r.status),
  ))
    r.status = "Expired";
}
export function editDraft(
  s: PreparationState,
  c: PreparationContext,
  id: string,
  changes: Record<string, unknown>,
) {
  const a = action(s, id);
  if (["Rejected", "Archived", "Executed", "Executing", "Cancelled"].includes(a.status))
    throw Error("این پیش‌نویس قابل ویرایش نیست.");
  const effectiveChanges = { ...changes };
  if (
    a.templateId === "Experiment" &&
    ["primaryMetricId", "constraintId"].some(
      (path) =>
        Object.hasOwn(changes, path) &&
        changes[path] !== getField(a.payload, path),
    )
  ) {
    for (const path of ["baselineValue", "baselinePeriod", "baselineSource"]) {
      if (
        !Object.hasOwn(changes, path) &&
        a.fields.find((f) => f.path === path)?.source !== "UserEdited"
      )
        effectiveChanges[path] = path === "baselineValue" ? null : "";
    }
  }
  const paths = Object.keys(effectiveChanges);
  if (!paths.length) return a;
  for (const path of paths) {
    const f = a.fields.find((f) => f.path === path);
    if (!f) throw Error("فیلد قابل ویرایش نیست.");
    const v = effectiveChanges[path];
    if (
      f.kind === "number" &&
      v !== null &&
      (typeof v !== "number" || !Number.isFinite(v))
    )
      throw Error("عدد معتبر لازم است.");
    if (f.kind !== "number" && typeof v !== "string")
      throw Error("متن معتبر لازم است.");
    if (typeof v === "string" && v.length > 2000)
      throw Error("متن بیش از حد طولانی است.");
  }
  for (const path of paths) {
    putField(a.payload, path, effectiveChanges[path]);
    a.fields.find((f) => f.path === path)!.source = Object.hasOwn(changes, path)
      ? "UserEdited"
      : "AgentSuggested";
  }
  a.title = String(a.payload.title ?? a.payload.name);
  a.revision++;
  a.updatedAt = new Date().toISOString();
  a.status = "Draft";
  expire(s, id);
  a.affectedEntities = actionRefs(a, c); // Preserve snapshots for existing refs; new explicit selections are frozen now.
  const current = sourceSnapshot(c, a.affectedEntities);
  for (const key of Object.keys(current))
    if (!Object.hasOwn(a.expectedCurrentState, key))
      a.expectedCurrentState[key] = current[key];
  a.proposedStateSnapshot = structuredClone(a.payload);
  a.validation = validateAgentProposedAction(a, s, c);
  for (const f of a.fields) {
    const value = getField(a.payload, f.path);
    f.state =
      value === "" || value === null || value === undefined
        ? "NeedsUserInput"
        : a.validation.errors.some((e) => e.includes(f.label))
          ? "Invalid"
          : f.source === "UserEdited"
            ? "Resolved"
            : "Suggested";
  }
  s.revisions.push({
    id: crypto.randomUUID(),
    actionId: id,
    revision: a.revision,
    changedFields: paths,
    changedAt: a.updatedAt,
    source: "User",
    payload: structuredClone(a.payload),
  });
  audit(s, "DraftEdited", id, "ویرایش مدیر ثبت و تأیید قبلی باطل شد.");
  return a;
}
export function validateDraft(
  s: PreparationState,
  c: PreparationContext,
  id: string,
  permissions?: AgentPermission[],
) {
  const a = action(s, id);
  if (["Executed", "Executing", "Cancelled"].includes(a.status)) return a.validation;
  a.validation = validateAgentProposedAction(a, s, c, permissions);
  for (const f of a.fields) {
    const v = getField(a.payload, f.path);
    f.state =
      v === "" || v === null || v === undefined
        ? "NeedsUserInput"
        : a.validation.errors.some((e) => e.includes(f.label))
          ? "Invalid"
          : f.source === "UserEdited"
            ? "Resolved"
            : "Suggested";
  }
  if (
    a.validation.status === "Stale" &&
    !["Rejected", "Archived"].includes(a.status)
  ) {
    expire(s, id);
    a.status = "NeedsReview";
    audit(s, "ActionMarkedStale", id, "منبع تغییر کرده؛ بررسی مجدد لازم است.");
  } else if (
    ["ReadyForApproval", "Approved"].includes(a.status) &&
    a.validation.status !== "Valid"
  ) {
    expire(s, id);
    a.status = "Draft";
  }
  audit(s, "DraftValidated", id, a.validation.status);
  return a.validation;
}
export function rebuildPreview(
  s: PreparationState,
  c: PreparationContext,
  id: string,
) {
  const a = action(s, id),
    d = c.diagnosis.diagnoses.find((d) => d.id === a.sourceDiagnosisId);
  if (["Executed", "Executing", "Cancelled"].includes(a.status)) throw Error("سابقه اجرای ثبت‌شده قابل بازسازی نیست.");
  if (
    a.sourceDiagnosisId &&
    (!d ||
      ["Resolved", "Dismissed"].includes(d.status) ||
      d.needsRefresh ||
      c.diagnosis.runs.at(-1)?.contextVersion !== c.version)
  )
    throw Error("ابتدا تحلیل را تازه کنید؛ تحلیل حل‌شده قابل بازسازی نیست.");
  a.affectedEntities = actionRefs(a, c);
  a.expectedCurrentState = sourceSnapshot(c, a.affectedEntities);
  a.currentStateSnapshot = structuredClone(a.expectedCurrentState);
  a.proposedStateSnapshot = structuredClone(a.payload);
  if (d) {
    const recommendation = generateRecommendation(s, c, d.id);
    a.sourceRecommendationId = recommendation.id;
    a.evidenceIds = [...d.evidenceIds];
    freezeEvidence(s, c, a.evidenceIds);
  }
  a.status = "Draft";
  expire(s, id);
  a.revision++;
  a.updatedAt = new Date().toISOString();
  s.revisions.push({
    id: crypto.randomUUID(),
    actionId: id,
    revision: a.revision,
    changedFields: ["currentStateSnapshot"],
    changedAt: a.updatedAt,
    source: "Agent",
    payload: structuredClone(a.payload),
  });
  validateDraft(s, c, id);
  audit(
    s,
    "PreviewRebuilt",
    id,
    "پیش‌نمایش بازسازی شد؛ ویرایش‌های مدیر حفظ شدند.",
  );
  return a;
}
export function approvalBinding(a: PreparedAction, s: PreparationState) {
  return canonical({
    action: a.id,
    capabilityId: a.capabilityId,
    templateId: a.templateId,
    risk: a.risk,
    payload: a.payload,
    revision: a.revision,
    expected: a.expectedCurrentState,
    refs: a.affectedEntities,
    evidence: a.evidenceIds.map((id) => s.evidence.find((e) => e.id === id)),
    diagnosis: a.sourceDiagnosisId,
    dependencies: a.dependencyIds,
  });
}
export function requestApproval(
  s: PreparationState,
  c: PreparationContext,
  id: string,
  permissions?: AgentPermission[],
) {
  const a = action(s, id);
  if (["Approved", "Rejected", "Archived", "Executed", "Executing", "Cancelled"].includes(a.status))
    throw Error("وضعیت اقدام اجازه درخواست تأیید نمی‌دهد.");
  const v = validateDraft(s, c, id, permissions);
  if (v.status !== "Valid")
    throw Error(
      "پیش‌نویس هنوز قابل تأیید نیست: " +
        [...v.missing, ...v.errors, ...v.warnings].join(" · "),
    );
  const existing = s.approvals.find(
    (r) => r.proposedActionId === id && r.status === "Pending",
  );
  if (existing) return existing;
  const at = new Date();
  const approval = {
    id: crypto.randomUUID(),
    proposedActionId: id,
    title: a.title,
    description: a.rationale,
    risk: a.risk,
    affectedEntities: a.affectedEntities,
    changeSummary: a.expectedImpact,
    evidenceIds: a.evidenceIds,
    status: "Pending" as const,
    requestedAt: at.toISOString(),
    expiresAt: new Date(at.getTime() + 24 * 60 * 60 * 1000).toISOString(),
    binding: approvalBinding(a, s),
  };
  s.approvals.push(approval);
  a.status = "ReadyForApproval";
  audit(
    s,
    "ApprovalRequested",
    id,
    "درخواست تأیید مفهومی آماده شد؛ هیچ اجرا انجام نمی‌شود.",
  );
  return approval;
}
export function approveDraft(
  s: PreparationState,
  c: PreparationContext,
  id: string,
  permissions?: AgentPermission[],
) {
  const a = action(s, id),
    r = s.approvals.find(
      (r) => r.proposedActionId === id && r.status === "Pending",
    );
  if (!r || a.status !== "ReadyForApproval")
    throw Error("درخواست تأیید معتبر لازم است.");
  const v = validateDraft(s, c, id, permissions);
  if (
    v.status !== "Valid" ||
    r.binding !== approvalBinding(a, s) ||
    Date.parse(r.expiresAt) < Date.now()
  ) {
    r.status = "Expired";
    a.status = "NeedsReview";
    throw Error("درخواست قدیمی یا پیش‌نویس تغییرکرده است.");
  }
  r.status = "Approved";
  r.approvedAt = new Date().toISOString();
  a.status = "Approved";
  audit(
    s,
    "ApprovalApproved",
    id,
    "این اقدام تأیید شده اما هنوز اجرا نشده است.",
  );
  return a;
}
export function rejectDraft(s: PreparationState, id: string, reason: string) {
  const a = action(s, id);
  if (!reason.trim()) throw Error("دلیل رد لازم است.");
  if (["Archived", "Rejected", "Executed", "Executing", "Cancelled"].includes(a.status))
    throw Error("وضعیت قابل رد نیست.");
  expire(s, id);
  const at = new Date().toISOString();
  s.approvals.push({
    id: crypto.randomUUID(),
    proposedActionId: id,
    title: a.title,
    description: a.rationale,
    risk: a.risk,
    affectedEntities: a.affectedEntities,
    changeSummary: a.expectedImpact,
    evidenceIds: a.evidenceIds,
    status: "Rejected",
    requestedAt: at,
    expiresAt: at,
    rejectedAt: at,
    rejectionReason: reason,
    binding: approvalBinding(a, s),
  });
  a.status = "Rejected";
  audit(s, "ApprovalRejected", id, reason);
  return a;
}
export function archiveDraft(s: PreparationState, id: string) {
  const a = action(s, id);
  if (["Executed", "Executing", "Cancelled"].includes(a.status)) throw Error("سابقه اجرای ثبت‌شده قابل آرشیو نیست.");
  expire(s, id);
  a.status = "Archived";
  audit(s, "ActionArchived", id, "آرشیو پیشنهاد؛ بدون تغییر کسب‌وکار.");
}
export function markRecommendations(
  s: PreparationState,
  c: PreparationContext,
) {
  for (const r of s.recommendations) {
    const d = c.diagnosis.diagnoses.find((d) => d.id === r.diagnosisId);
    if (
      r.sourceVersion !== c.version ||
      (!!r.diagnosisId && (!d || d.needsRefresh || ["Resolved", "Dismissed"].includes(d.status)))
    )
      r.status = "PotentiallyStale";
  }
}
export function preparationIntent(text: string): TemplateId | null {
  if (
    text.length > 2000 ||
    /حذف|اجرا کن|ثبت کن|delete|execute|ignore|نادیده|\b\d{2,}\b/i.test(text)
  )
    return null;
  if (!/آماده|پیشنهادی|prepare|draft/i.test(text)) return null;
  if (/آزمایش|experiment/i.test(text)) return "Experiment";
  if (/initiative|اقدام استراتژیک/i.test(text)) return "Initiative";
  if (/improvement|بهبود|فرآیند/i.test(text)) return "Improvement";
  return null;
}
