import { canonical } from "../actions";
import { defaultPermissions, findCapability, permitted } from "../capabilities";
import type { AgentPermission, AgentEntityRef } from "../types";
import type {
  PreparedAction,
  PreparationState,
  ValidationResult,
} from "./types";
import type { PreparationContext } from "./context";
import { findEntity, sourceSnapshot } from "./context";
import { getField, template, buildDraft } from "./templates";
import { kpiIssues } from "../../system/measurement/kpis";
import type { ProcessKPI } from "../../system/measurement/model";
import { validateSystem } from "../../system/persistence";
import { validateMeasurement } from "../../system/measurement/persistence";
import { emptyMeasurement } from "../../system/measurement/model";
import { validateStrategy } from "../../strategy/model";
import { validateKR } from "../../strategy/kr/validation";
import type { KeyResult } from "../../strategy/kr/types";
import {
  validateInitiative,
  initiativeQuality,
} from "../../strategy/initiatives/validation";
import type { StrategicInitiative } from "../../strategy/initiatives/types";
import { validateScale } from "../../scale/persistence";
import {
  experimentData,
  type GrowthExperiment,
} from "../../scale/experiments/model";
import { experimentReadiness, validDay } from "../../scale/experiments/logic";
import { readinessData } from "../../scale/readiness/model";
export function actionRefs(
  a: PreparedAction,
  c: PreparationContext,
): AgentEntityRef[] {
  const refs: AgentEntityRef[] = [...a.affectedEntities];
  for (const f of a.fields) {
    if (!f.entityType) continue;
    const e = findEntity(
      c,
      f.entityType,
      String(getField(a.payload, f.path) ?? ""),
    );
    if (
      e &&
      !refs.some(
        (r) =>
          r.entityType === e.ref.entityType && r.entityId === e.ref.entityId,
      )
    )
      refs.push(e.ref);
  }
  for (const [type, key] of [
    ["cycle", "cycleId"],
    ["objective", "objectiveId"],
  ] as const) {
    const e = findEntity(c, type, String(a.payload[key] ?? ""));
    if (
      e &&
      !refs.some((r) => r.entityType === type && r.entityId === e.ref.entityId)
    )
      refs.push(e.ref);
  }
  return refs;
}
export function validateAgentProposedAction(
  a: PreparedAction,
  s: PreparationState,
  c: PreparationContext,
  permissions: readonly AgentPermission[] = defaultPermissions,
  at = new Date().toISOString(),
): ValidationResult {
  const missing: string[] = [],
    errors: string[] = [],
    warnings = [...c.notices, ...a.warnings],
    t = template(a.templateId),
    cap = findCapability(a.capabilityId);
  if (
    a.capabilityId !== t.capabilityId ||
    a.domain !== t.domain ||
    a.actionType !== a.templateId ||
    a.riskLevel !== t.risk ||
    a.risk !== t.risk ||
    !a.requiresApproval ||
    a.approvalPolicy !== "AlwaysRequired" ||
    a.dryRun !== true
  )
    errors.push("قرارداد اقدام با قالب سازگار نیست.");
  if (!cap || cap.authorityLevel !== "Prepare" || !permitted(cap, permissions))
    errors.push("قابلیت آماده‌سازی مجاز یا فعال نیست.");
  if (
    !a.evidenceIds.length ||
    a.evidenceIds.some((id) => !s.evidence.some((e) => e.id === id))
  )
    errors.push("شواهد معتبر لازم است.");
  const schema = buildDraft(a.templateId, c, a.targetEntityId, a.rationale);
  if (
    canonical(
      a.fields.map(({ path, kind, required, entityType }) => ({
        path,
        kind,
        required,
        entityType,
      })),
    ) !==
    canonical(
      schema.fields.map(({ path, kind, required, entityType }) => ({
        path,
        kind,
        required,
        entityType,
      })),
    )
  )
    errors.push("فیلدهای پیش‌نویس با قالب مطابقت ندارند.");
  if (Object.keys(a.payload).some((key) => !Object.hasOwn(schema.payload, key)))
    errors.push("فیلد اضافی در داده پیشنهادی مجاز نیست.");
  for (const key of [
    "id",
    "createdAt",
    "updatedAt",
    "status",
    "progress",
    "lifecycle",
    "conceptOnly",
  ])
    if (
      Object.hasOwn(schema.payload, key) &&
      !["id", "createdAt", "updatedAt"].includes(key) &&
      canonical(a.payload[key]) !== canonical(schema.payload[key])
    )
      errors.push("وضعیت دامنه از قالب پیش‌نویس خارج شده است.");
  for (const f of a.fields) {
    const v = getField(a.payload, f.path),
      empty = v === null || v === undefined || v === "" || v === false;
    if (f.required && empty) {
      missing.push(f.label);
      continue;
    }
    if (empty) continue;
    if (f.kind === "number" && (typeof v !== "number" || !Number.isFinite(v)))
      errors.push(f.label + " باید عدد معتبر باشد.");
    if (f.kind === "date" && !validDay(String(v)))
      errors.push(f.label + " تاریخ معتبر نیست.");
    if (typeof v === "string" && v.length > 2000)
      errors.push(f.label + " بیش از حد طولانی است.");
    if (f.entityType && !findEntity(c, f.entityType, String(v)))
      errors.push(f.label + " در داده‌های فعلی وجود ندارد.");
    if (f.kind === "role" && c.system) {
      const r = c.system.roles.find((r) => r.id === v);
      if (
        r &&
        !c.system.people.some(
          (p) => p.id === r.personId && p.status === "active",
        )
      )
        errors.push("نقش مالک باید دارای فرد فعال باشد.");
    }
    if (
      f.kind === "select" &&
      f.choices &&
      !f.choices.some((x) => x.id === String(v))
    )
      errors.push(f.label + " گزینه معتبر نیست.");
  }
  for (const [start, end] of [
    ["startDate", "endDate"],
    ["startDate", "dueDate"],
    ["startDate", "deadline"],
  ])
    if (
      a.payload[start] &&
      a.payload[end] &&
      String(a.payload[start]) > String(a.payload[end])
    )
      errors.push("تاریخ پایان نباید قبل از شروع باشد.");
  const d = a.sourceDiagnosisId
    ? c.diagnosis.diagnoses.find((d) => d.id === a.sourceDiagnosisId)
    : null;
  const recommendation = a.sourceRecommendationId
    ? s.recommendations.find((r) => r.id === a.sourceRecommendationId)
    : null;
  const stale =
    (a.sourceRecommendationId &&
      (!recommendation ||
        recommendation.status === "PotentiallyStale" ||
        recommendation.sourceVersion !== c.version)) ||
    canonical(sourceSnapshot(c, a.affectedEntities)) !==
      canonical(a.expectedCurrentState) ||
    (a.sourceDiagnosisId &&
      (!d || d.needsRefresh || ["Resolved", "Dismissed"].includes(d.status))) ||
    (a.sourceDiagnosisId &&
      c.diagnosis.runs.at(-1)?.contextVersion !== c.version);
  if (stale)
    warnings.push(
      "منبع یا تحلیل تغییر کرده است؛ پیش‌نمایش را بازسازی و تحلیل را تازه کنید.",
    );
  const p = structuredClone(a.payload);
  if (!missing.length && !errors.length)
    try {
      switch (a.templateId) {
        case "Improvement":
        case "KPI": {
          if (!c.system?.processes.some((x) => x.id === p.processId))
            throw Error("فرآیند معتبر لازم است.");
          const r = emptyMeasurement(String(p.processId));
          const key = a.templateId === "KPI" ? "kpis" : "improvements";
          (r[key] as unknown[]).push(p);
          validateMeasurement({ version: 1, records: [r] });
          if (a.templateId === "KPI")
            errors.push(...kpiIssues(p as unknown as ProcessKPI, c.system));
          break;
        }
        case "OwnerChange":
          if (!c.system) throw Error("سیستم قابل خواندن نیست.");
          validateSystem({
            ...c.system,
            processes: c.system.processes.map((x) =>
              x.id === p.processId ? { ...x, ownerRoleId: p.ownerRoleId } : x,
            ),
          });
          if (String(p.sopConfirmed) !== "true")
            missing.push("آمادگی دستورالعمل و پذیرش مسئولیت");
          break;
        case "SOPChange":
          if (!c.system?.processes.some((x) => x.id === p.processId))
            throw Error("فرآیند معتبر لازم است.");
          warnings.push(
            "این پیشنهاد اصلاح SOP است؛ نسخه رسمی SOP یا تأیید عملیاتی ایجاد نمی‌کند.",
          );
          break;
        case "Objective":
          if (!c.strategy) throw Error("استراتژی قابل خواندن نیست.");
          validateStrategy({
            ...c.strategy,
            objectives: [...c.strategy.objectives, p],
          });
          if (
            !c.strategy.priorities.some(
              (x) =>
                x.id === p.relatedPriorityId &&
                x.cycleId === p.cycleId &&
                x.status === "selected",
            )
          )
            throw Error("اولویت منتخب باید متعلق به همین دوره باشد.");
          break;
        case "KR":
        case "KRTargetChange": {
          if (!c.strategy) throw Error("استراتژی قابل خواندن نیست.");
          const kr =
            a.templateId === "KRTargetChange"
              ? {
                  ...c.strategy.keyResults?.find((k) => k.id === p.keyResultId),
                  targetValue: p.targetValue,
                }
              : p;
          const result = validateKR(
            kr as unknown as KeyResult,
            c.strategy,
            c.sources.roles,
            c.strategy.objectives.find((o) => o.id === kr.objectiveId)
              ?.krWeightMode ?? "equal",
          );
          missing.push(...result.missing);
          warnings.push(...result.warnings);
          break;
        }
        case "Initiative":
          if (!c.strategy) throw Error("استراتژی قابل خواندن نیست.");
          errors.push(
            ...validateInitiative(
              p as unknown as StrategicInitiative,
              c.strategy,
            ),
          );
          const q = initiativeQuality(
            p as unknown as StrategicInitiative,
            c.strategy,
            c.sources.roles,
          );
          missing.push(...q.missing);
          warnings.push(...q.warnings);
          validateStrategy({
            ...c.strategy,
            initiatives: [...(c.strategy.initiatives ?? []), p],
          });
          break;
        case "GrowthIdea":
          if (!c.scale) throw Error("رشد قابل خواندن نیست.");
          validateScale({ ...c.scale, ideas: [...c.scale.ideas, p] });
          break;
        case "Experiment": {
          if (!c.scale) throw Error("رشد قابل خواندن نیست.");
          const copy = {
            ...c.scale,
            experimentData: {
              ...experimentData(c.scale),
              experiments: [
                ...experimentData(c.scale).experiments,
                p as unknown as GrowthExperiment,
              ],
            },
          };
          validateScale(copy);
          const r = experimentReadiness(copy, p as unknown as GrowthExperiment);
          missing.push(...r.missing);
          break;
        }
        case "ScalePreparation":
          if (!c.scale) throw Error("رشد قابل خواندن نیست.");
          validateScale({
            ...c.scale,
            readinessData: {
              ...readinessData(c.scale),
              preparation: [...readinessData(c.scale).preparation, p],
            },
          });
          break;
        case "ConstraintUpdate":
          if (!c.scale) throw Error("رشد قابل خواندن نیست.");
          validateScale({
            ...c.scale,
            constraints: c.scale.constraints.map((x) =>
              x.id === p.constraintId
                ? { ...x, description: p.proposedDescription }
                : x,
            ),
          });
          break;
        case "CancelObjective":
          warnings.push(
            "ریسک بحرانی: فقط تأیید مفهومی؛ لغو هدف پشتیبانی اجرایی ندارد.",
          );
          break;
      }
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "اعتبارسنجی دامنه رد شد.");
    }
  if (a.dependencyIds.length) {
    for (const id of a.dependencyIds) {
      const plan = s.plans.find((p) => p.dependencies.some((d) => d.id === id));
      const dep = plan?.dependencies.find((d) => d.id === id);
      const step = plan?.steps.find((x) => x.id === dep?.fromStepId);
      if (
        !dep ||
        !step ||
        !step.proposedActionId ||
        !["Approved", "Executed"].includes(
          s.actions.find((x) => x.id === step.proposedActionId)?.status ?? "",
        )
      )
        missing.push("ابتدا پیش‌نیاز برنامه باید جداگانه تأیید مفهومی شود.");
    }
    warnings.push(
      "تأیید پیش‌نیاز به معنی تکمیل آن در کسب‌وکار نیست؛ شرط تکمیل باید در اجرای آینده دوباره بررسی شود.",
    );
  }
  return {
    status: stale
      ? "Stale"
      : errors.length
        ? "Invalid"
        : missing.length
          ? "NeedsInput"
          : "Valid",
    missing: [...new Set(missing)],
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    completeness: Math.round(
      (100 *
        a.fields.filter(
          (f) =>
            getField(a.payload, f.path) !== "" &&
            getField(a.payload, f.path) !== null &&
            getField(a.payload, f.path) !== undefined,
        ).length) /
        Math.max(1, a.fields.length),
    ),
    validatedAt: at,
  };
}
