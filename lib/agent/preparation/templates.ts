import type { Domain, Risk } from "../types";
import type { DraftField, TemplateId } from "./types";
import type { PreparationContext } from "./context";
import { findEntity, choices } from "./context";
import { newImprovement, newKPI } from "../../system/measurement/model";
import { newExperiment, experimentData } from "../../scale/experiments/model";
import { newIdea } from "../../scale/model";
import { newPreparation } from "../../scale/readiness/model";
export interface DraftTemplate {
  id: TemplateId;
  title: string;
  domain: Domain;
  capabilityId: string;
  targetType: string;
  risk: Risk;
  reversibility: "Easy" | "Moderate" | "Difficult" | "Irreversible";
  requiredContext: string[];
  prerequisites: string[];
  expectedImpact: string;
}
const rows: [
  TemplateId,
  string,
  Domain,
  string,
  string,
  Risk,
  DraftTemplate["reversibility"],
][] = [
  [
    "Improvement",
    "بهبود فرآیند",
    "System",
    "prepareImprovement",
    "process",
    "Medium",
    "Easy",
  ],
  [
    "SOPChange",
    "بازنگری دستورالعمل",
    "System",
    "prepareSOPChange",
    "process",
    "Medium",
    "Moderate",
  ],
  [
    "OwnerChange",
    "تغییر مالک فرآیند",
    "System",
    "prepareOwnerChange",
    "process",
    "High",
    "Difficult",
  ],
  [
    "KPI",
    "تعریف شاخص فرآیند",
    "System",
    "prepareKPI",
    "process",
    "Medium",
    "Moderate",
  ],
  [
    "Objective",
    "هدف استراتژیک",
    "Strategy",
    "prepareObjective",
    "cycle",
    "Medium",
    "Easy",
  ],
  [
    "KR",
    "نتیجه کلیدی",
    "Strategy",
    "prepareKR",
    "objective",
    "Medium",
    "Moderate",
  ],
  [
    "Initiative",
    "اقدام استراتژیک",
    "Strategy",
    "prepareInitiative",
    "KR",
    "Medium",
    "Easy",
  ],
  [
    "StrategyDecision",
    "تصمیم استراتژیک",
    "Strategy",
    "prepareDecision",
    "cycle",
    "Medium",
    "Moderate",
  ],
  [
    "GrowthIdea",
    "ایده رشد",
    "Scale",
    "prepareGrowthIdea",
    "constraint",
    "Low",
    "Easy",
  ],
  [
    "Experiment",
    "آزمایش رشد",
    "Scale",
    "prepareExperiment",
    "constraint",
    "Medium",
    "Easy",
  ],
  [
    "ConstraintUpdate",
    "بازنگری گلوگاه",
    "Scale",
    "prepareConstraint",
    "constraint",
    "High",
    "Moderate",
  ],
  [
    "ScalePreparation",
    "آماده‌سازی ظرفیت",
    "Scale",
    "preparePreparationItem",
    "candidate",
    "Medium",
    "Easy",
  ],
  [
    "DecisionNote",
    "یادداشت تصمیم مدیریتی",
    "Executive",
    "prepareDecisionNote",
    "",
    "Low",
    "Easy",
  ],
  [
    "ActionPlan",
    "برنامه میان‌ماژولی",
    "CrossModule",
    "prepareActionPlan",
    "",
    "Medium",
    "Easy",
  ],
  [
    "KRTargetChange",
    "بازنگری هدف عددی KR",
    "Strategy",
    "prepareKRTargetChange",
    "KR",
    "High",
    "Difficult",
  ],
  [
    "CancelObjective",
    "لغو هدف — صرفاً بررسی مفهومی",
    "Strategy",
    "prepareCancelObjective",
    "objective",
    "Critical",
    "Irreversible",
  ],
];
export const AgentDraftTemplateRegistry: readonly DraftTemplate[] =
  Object.freeze(
    rows.map(([id, title, domain, name, targetType, risk, reversibility]) => ({
      id,
      title,
      domain,
      capabilityId: `${domain.toLowerCase()}.${name}`,
      targetType,
      risk,
      reversibility,
      requiredContext: targetType ? [targetType] : [],
      prerequisites:
        id === "Experiment"
          ? ["شاخص معتبر، مالک، خط مبنا و معیار موفقیت"]
          : id === "OwnerChange"
            ? ["دستورالعمل و پذیرش مسئولیت"]
            : id === "ScalePreparation"
              ? ["شواهد ظرفیت پیش از افزایش جذب"]
              : [],
      expectedImpact:
        id === "DecisionNote"
          ? "شفاف‌شدن داده مورد نیاز و تصمیم بعدی"
          : id === "OwnerChange"
            ? "روشن‌شدن مسئولیت و کاهش وابستگی"
            : id === "Experiment"
              ? "یادگیری درباره اثر مداخله با شاخص مشخص"
              : "بررسی تغییر پیشنهادی پیش از تعهد اجرایی",
    })),
  );
export function template(id: TemplateId) {
  const t = AgentDraftTemplateRegistry.find((t) => t.id === id);
  if (!t) throw Error("نوع اقدام پشتیبانی نمی‌شود.");
  return t;
}
export function getField(p: Record<string, unknown>, path: string): unknown {
  let v: unknown = p;
  for (const k of path.split(".")) {
    if (!v || typeof v !== "object") return undefined;
    v = (v as Record<string, unknown>)[k];
  }
  return v;
}
export function putField(p: Record<string, unknown>, path: string, v: unknown) {
  const parts = path.split(".");
  if (parts.some((x) => ["__proto__", "prototype", "constructor"].includes(x)))
    throw Error("فیلد نامعتبر");
  let cursor = p;
  for (const k of parts.slice(0, -1)) {
    if (!cursor[k] || typeof cursor[k] !== "object") cursor[k] = {};
    cursor = cursor[k] as Record<string, unknown>;
  }
  cursor[parts.at(-1)!] = v;
}
export function buildDraft(
  id: TemplateId,
  c: PreparationContext,
  targetId: string,
  reason: string,
  contextLabel?: string,
) {
  const t = template(id),
    entity = findEntity(c, t.targetType, targetId),
    x = entity?.value ?? {},
    label = entity?.ref.label ?? contextLabel ?? "مسئله مدیریتی",
    at = new Date().toISOString();
  const title = `${t.title}: ${label}`,
    base = {
      id: crypto.randomUUID(),
      title,
      description: reason,
      createdAt: at,
      updatedAt: at,
    };
  const owner =
    typeof x.ownerRoleId === "string" &&
    c.system?.roles.some(
      (r) =>
        r.id === x.ownerRoleId &&
        c.system?.people.some(
          (p) => p.id === r.personId && p.status === "active",
        ),
    )
      ? x.ownerRoleId
      : "";
  let payload: Record<string, unknown> = { ...base };
  const fields: DraftField[] = [];
  const f = (
    path: string,
    label: string,
    kind: DraftField["kind"] = "text",
    required = true,
    entityType?: string,
    values?: string[],
  ) =>
    fields.push({
      path,
      label,
      kind,
      required,
      entityType,
      choices: entityType
        ? choices(c, entityType)
        : values?.map((v) => ({ id: v, label: v })),
      state: "NeedsUserInput",
      source: "AgentSuggested",
    });
  const commonOwner = () =>
    f("ownerRoleId", "مالک مسئول", "role", true, "role");
  switch (id) {
    case "Improvement":
      payload = {
        ...newImprovement(targetId),
        title,
        description: reason,
        source: "analysis",
        ownerRoleId: owner,
        expectedImpact: t.expectedImpact,
      };
      commonOwner();
      f("dueDate", "موعد", "date");
      f("expectedImpact", "اثر مورد انتظار");
      break;
    case "KPI":
      payload = {
        ...newKPI(targetId),
        name: title,
        description: reason,
        ownerRoleId: owner,
      };
      commonOwner();
      f("name", "نام شاخص");
      f("unit", "واحد");
      f("direction", "جهت", "select", true, undefined, [
        "increase",
        "decrease",
        "maintain",
        "binary",
      ]);
      f("baselineValue", "خط مبنا", "number");
      f("targetValue", "هدف", "number");
      break;
    case "SOPChange":
      payload = {
        ...base,
        processId: targetId,
        ownerRoleId: owner,
        proposedInstruction: `بازنگری روش انجام «${label}» بر اساس شواهد و ثبت معیار پذیرش`,
        successCriteria: "",
        scope: "",
        changeReason: reason,
      };
      commonOwner();
      f("scope", "دامنه تغییر");
      f("proposedInstruction", "دستور پیشنهادی");
      f("successCriteria", "معیار پذیرش");
      break;
    case "OwnerChange":
      payload = {
        ...base,
        processId: targetId,
        currentOwnerRoleId: x.ownerRoleId ?? "",
        ownerRoleId: "",
        handoverPlan: "",
        sopConfirmed: false,
      };
      commonOwner();
      f("handoverPlan", "برنامه تحویل مسئولیت");
      f(
        "sopConfirmed",
        "آیا دستورالعمل آماده و مسئولیت پذیرفته شده؟",
        "select",
        true,
        undefined,
        ["true", "false"],
      );
      break;
    case "Objective":
      payload = {
        ...base,
        code: `DRAFT-${base.id.slice(0, 8)}`,
        cycleId: targetId,
        ownerRoleId: "",
        relatedPriorityId: "",
        status: "draft",
        startDate: "",
        deadline: "",
      };
      commonOwner();
      f(
        "relatedPriorityId",
        "اولویت منتخب این دوره",
        "select",
        true,
        undefined,
        c.strategy?.priorities
          .filter((p) => p.cycleId === targetId && p.status === "selected")
          .map((p) => p.id),
      );
      f("startDate", "شروع", "date");
      f("deadline", "پایان", "date");
      break;
    case "KR":
      payload = {
        ...base,
        code: `DRAFT-${base.id.slice(0, 8)}`,
        cycleId: x.cycleId ?? "",
        objectiveId: targetId,
        ownerRoleId: owner,
        type: "increase",
        startValue: null,
        targetValue: null,
        currentValue: null,
        unit: "",
        weight: null,
        confidence: null,
        startDate: "",
        deadline: "",
        notes: "",
        lifecycle: "active",
        milestones: [],
      };
      commonOwner();
      f("type", "جهت نتیجه", "select", true, undefined, [
        "increase",
        "decrease",
      ]);
      f("startValue", "خط مبنا", "number");
      f("targetValue", "هدف", "number");
      f("unit", "واحد");
      f("startDate", "شروع", "date");
      f("deadline", "پایان", "date");
      break;
    case "Initiative":
      payload = {
        ...base,
        code: `DRAFT-${base.id.slice(0, 8)}`,
        cycleId: x.cycleId ?? "",
        objectiveId: x.objectiveId ?? "",
        keyResultId: targetId,
        ownerRoleId: owner,
        hypothesis: `بهبود روش اجرا برای حرکت «${label}»؛ اثر نیازمند آزمون است.`,
        expectedImpact: t.expectedImpact,
        actualImpact: "",
        impactType: "qualitative",
        expectedImpactValue: null,
        expectedImpactUnit: "",
        priority: "medium",
        status: "proposed",
        progress: 0,
        effectiveness: "notEvaluated",
        startDate: "",
        dueDate: "",
        blockedReason: "",
        notes: "",
        effort: "unknown",
        impactLevel: "unknown",
      };
      commonOwner();
      f("hypothesis", "فرضیه");
      f("startDate", "شروع", "date");
      f("dueDate", "موعد", "date");
      break;
    case "StrategyDecision":
      payload = {
        ...base,
        cycleId: targetId,
        ownerRoleId: "",
        decision: reason,
        followUp: "",
      };
      commonOwner();
      f("decision", "تصمیم پیشنهادی");
      f("followUp", "شرط بازبینی");
      break;
    case "GrowthIdea":
      payload = {
        ...newIdea(),
        title,
        description: reason,
        constraintId: targetId,
        ownerRoleId: owner,
        rationale: reason,
        intervention: `بررسی مداخله محدود برای «${label}»`,
        evidence: reason,
      };
      f("intervention", "مداخله پیشنهادی");
      f("successMetric", "شاخص موفقیت");
      break;
    case "Experiment": {
      payload = {
        ...(c.scale ? newExperiment(c.scale) : base),
        title,
        description: reason,
        constraintId: targetId,
        ownerRoleId: owner,
        hypothesis: {
          change: `آزمون یک تغییر محدود در پاسخ به «${label}»`,
          audience: "",
          movement: "",
          rationale: reason,
        },
        experimentDesign: {
          change: `آزمون محدود برای «${label}»`,
          audience: "",
          channel: "",
          sample: "",
          comparison: "",
          notes: "",
        },
      };
      // Only a directly linked metric with a measured, dated source supplies a baseline. No numeric estimate or old experiment baseline is recycled.
      const recent = c.scale
        ? experimentData(c.scale)
            .experiments.filter((e) => e.constraintId === targetId)
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        : [];
      if (
        recent[0] &&
        experimentData(c.scale!).metrics.some(
          (m) => m.id === recent[0].primaryMetricId,
        )
      ) {
        payload.primaryMetricId = recent[0].primaryMetricId;
        const measured = experimentData(c.scale!)
          .measurements.filter(
            (m) =>
              m.experimentId === recent[0].id &&
              m.metricId === recent[0].primaryMetricId &&
              m.source.trim(),
          )
          .sort((a, b) =>
            b.measurementDate.localeCompare(a.measurementDate),
          )[0];
        if (measured) {
          payload.baselineValue = measured.value;
          payload.baselinePeriod = measured.measurementDate;
          payload.baselineSource = measured.source;
        }
      }
      commonOwner();
      f("primaryMetricId", "شاخص اصلی", "entity", true, "metric");
      f("baselineValue", "خط مبنا", "number");
      f("baselinePeriod", "دوره خط مبنا");
      f("baselineSource", "منبع خط مبنا");
      f("targetValue", "هدف آزمایش", "number");
      f("hypothesis.change", "تغییر");
      f("hypothesis.audience", "مخاطب");
      f("hypothesis.movement", "اثر قابل سنجش");
      f("hypothesis.rationale", "منطق فرضیه");
      f("experimentDesign.change", "طراحی تغییر");
      f("experimentDesign.audience", "گروه آزمون");
      f("successCriteria", "معیار موفقیت");
      f("startDate", "شروع", "date");
      f("endDate", "پایان", "date");
      break;
    }
    case "ConstraintUpdate":
      payload = {
        ...base,
        constraintId: targetId,
        ownerRoleId: owner,
        proposedDescription: reason,
        reviewCondition: "",
      };
      f("proposedDescription", "شرح گلوگاه پیشنهادی");
      f("reviewCondition", "شرط بازبینی");
      break;
    case "ScalePreparation":
      payload = {
        ...newPreparation(targetId),
        title,
        ownerRoleId: owner,
        notes: reason,
      };
      commonOwner();
      f("dueDate", "موعد", "date");
      f("notes", "اقدام ظرفیت و معیار تکمیل");
      break;
    case "DecisionNote":
      payload = {
        ...base,
        decision: `ابتدا داده‌های مرتبط با «${label}» جمع‌آوری و اعتبارسنجی شوند. ${reason}`,
        followUp: "ثبت منبع معتبر و بازبینی پیش از تغییر هدف یا افزایش جذب",
      };
      f("decision", "یادداشت تصمیم");
      f("followUp", "شرط بازبینی");
      break;
    case "ActionPlan":
      payload = { ...base, objective: reason, completionCondition: "" };
      f("objective", "هدف برنامه");
      f("completionCondition", "شرط تکمیل");
      break;
    case "KRTargetChange":
      payload = {
        ...base,
        keyResultId: targetId,
        currentTarget: x.targetValue ?? null,
        targetValue: null,
        changeReason: "",
        ownerRoleId: owner,
      };
      f("targetValue", "هدف پیشنهادی", "number");
      f("changeReason", "دلیل بازنگری هدف");
      break;
    case "CancelObjective":
      payload = {
        ...base,
        objectiveId: targetId,
        changeReason: "",
        consequences: "",
        conceptOnly: true,
      };
      f("changeReason", "دلیل بررسی لغو");
      f("consequences", "پیامدها و جایگزین");
      break;
  }
  if (id !== "KPI") f("title", "عنوان");
  if (id === "KR") {
    f("cycleId", "دوره مرتبط", "entity", true, "cycle");
    f("currentValue", "مقدار فعلی ثبت‌شده", "number");
    f("confidence", "اطمینان به تحقق نتیجه از یک تا ده", "number");
    f("weight", "وزن نتیجه در حالت وزن سفارشی", "number", false);
  }
  if (id === "Initiative") {
    f("cycleId", "دوره مرتبط", "entity", true, "cycle");
    f("objectiveId", "هدف مرتبط", "entity", true, "objective");
  }
  if (t.targetType)
    f(
      id === "KRTargetChange"
        ? "keyResultId"
        : id === "CancelObjective"
          ? "objectiveId"
          : (
              {
                process: "processId",
                cycle: "cycleId",
                objective: "objectiveId",
                KR: "keyResultId",
                constraint: "constraintId",
                candidate: "candidateId",
              } as Record<string, string>
            )[t.targetType],
      "موضوع تغییر",
      "entity",
      true,
      t.targetType,
    );
  for (const field of fields) {
    const v = getField(payload, field.path);
    field.state =
      v !== null && v !== undefined && v !== "" && v !== false
        ? "Suggested"
        : "NeedsUserInput";
  }
  return { payload, fields };
}
