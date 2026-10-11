import type { AgentDiagnosis } from "../diagnosis/types";
import type {
  PreparedRecommendation,
  TemplateId,
  AgentActionPlan,
  AgentActionOption,
} from "./types";
import type { PreparationContext } from "./context";
import { template } from "./templates";
export function recommendationFor(
  d: AgentDiagnosis,
  c: PreparationContext,
): PreparedRecommendation {
  const quality = d.category === "DataQuality" || d.confidence === "Low",
    capacity =
      ["Capacity", "LeadershipDependency", "SystemConstraint"].includes(
        d.category,
      ) ||
      (d.category !== "Opportunity" &&
        d.sourceFamilies.some((f) =>
          ["founder", "process-readiness", "capacity"].includes(f),
        )),
    opportunity = d.category === "Opportunity";
  let ids: TemplateId[] = quality
    ? ["DecisionNote", "KPI", "StrategyDecision"]
    : capacity
      ? ["SOPChange", "OwnerChange", "Improvement"]
      : opportunity
        ? ["ScalePreparation", "DecisionNote", "Experiment"]
        : d.category === "StrategyExecution"
          ? ["Initiative", "StrategyDecision", "Experiment"]
          : ["Experiment", "Improvement", "DecisionNote"];
  const id = crypto.randomUUID(),
    reason = quality
      ? "شواهد برای تصمیم اجرایی کافی نیست؛ ابتدا کیفیت داده و خط مبنا روشن شود."
      : capacity
        ? "قبل از افزایش جذب، روش کار و مسئولیت روشن شود تا فشار رشد روی فرآیند فعلی بیشتر نشود."
        : opportunity
          ? "فرصت ثبت‌شده با کنترل ظرفیت و ریسک بررسی شود؛ مقیاس‌دهی خودکار مجاز نیست."
          : "مداخله محدود و قابل سنجش را بر اساس شواهد بررسی کنید.";
  const options: AgentActionOption[] = ids.map((key, i) => {
    const t = template(key);
    return {
      id: crypto.randomUUID(),
      recommendationId: id,
      title: t.title,
      description: `${d.title} — ${t.expectedImpact}`,
      capabilityId: t.capabilityId,
      templateId: key,
      domain: t.domain,
      riskLevel: t.risk,
      effort:
        key === "DecisionNote"
          ? "Low"
          : key === "OwnerChange"
            ? "High"
            : "Medium",
      timeHorizon: key === "DecisionNote" ? "Immediate" : "ThisWeek",
      expectedImpact: t.expectedImpact,
      prerequisites: t.prerequisites,
      evidenceIds: [...d.evidenceIds],
      recommended: i === 0,
    };
  });
  return {
    id,
    diagnosisId: d.id,
    domain: d.affectedEntities[0]?.domain ?? "CrossModule",
    title: `گام بعدی برای ${d.title}`,
    summary: reason,
    rationale: d.summary,
    priority: d.severity,
    confidence: d.confidence,
    evidenceIds: [...d.evidenceIds],
    suggestedActions: ids,
    status: "New",
    createdAt: new Date().toISOString(),
    recommendationType: quality
      ? "CollectData"
      : capacity
        ? "Standardize"
        : opportunity
          ? "ScaleOpportunity"
          : "Experiment",
    actionOptions: options,
    primaryReason: reason,
    assumptions: ["ارتباط ثبت‌شده علت قطعی مسئله را اثبات نمی‌کند."],
    risks: ["تأیید پیشنهاد باعث اجرا یا تغییر داده‌های کسب‌وکار نمی‌شود."],
    sourceVersion: c.version,
  };
}
export function actionPlanFor(d: AgentDiagnosis): AgentActionPlan {
  const quality = d.category === "DataQuality" || d.confidence === "Low",
    ids: TemplateId[] = quality
      ? ["DecisionNote", "KPI"]
      : ["SOPChange", "OwnerChange", "Experiment", "Initiative"];
  const steps = ids.map((key, i) => {
    const t = template(key);
    return {
      id: crypto.randomUUID(),
      order: i + 1,
      domain: t.domain,
      title: t.title,
      templateId: key,
      dependencyIds: [] as string[],
      expectedOutcome: t.expectedImpact,
      completionCondition:
        key === "SOPChange"
          ? "روش کار و معیار پذیرش بازبینی شود"
          : key === "OwnerChange"
            ? "مالک معتبر مسئولیت را بپذیرد"
            : key === "Experiment"
              ? "خط مبنا، معیار موفقیت و نتیجه اندازه‌گیری ثبت شود"
              : "اثر اقدام بر KR و ظرفیت بررسی شود",
    };
  });
  const dependencies = steps.slice(1).map((step, i) => ({
    id: crypto.randomUUID(),
    fromStepId: steps[i].id,
    toStepId: step.id,
    condition: steps[i].completionCondition,
    status: "Pending" as const,
  }));
  steps.forEach(
    (step) =>
      (step.dependencyIds = dependencies
        .filter((dep) => dep.toStepId === step.id)
        .map((x) => x.id)),
  );
  return {
    id: crypto.randomUUID(),
    diagnosisId: d.id,
    title: `برنامه مرحله‌ای: ${d.title}`,
    objective: quality
      ? "رفع ابهام داده پیش از مداخله"
      : "استانداردسازی و تفویض پیش از افزایش جذب",
    steps,
    dependencies,
    evidenceIds: [...d.evidenceIds],
    risks: ["هر گام جداگانه بررسی و تأیید می‌شود؛ هیچ اجرای گروهی وجود ندارد."],
    status: "Draft",
    createdAt: new Date().toISOString(),
  };
}
export function validatePlan(plan: AgentActionPlan): string[] {
  const errors: string[] = [];
  const order = new Map(plan.steps.map((s) => [s.id, s.order]));
  if (new Set(plan.steps.map((s) => s.id)).size !== plan.steps.length)
    errors.push("گام تکراری");
  for (const d of plan.dependencies)
    if (
      !order.has(d.fromStepId) ||
      !order.has(d.toStepId) ||
      order.get(d.fromStepId)! >= order.get(d.toStepId)!
    )
      errors.push("چرخه یا ترتیب نامعتبر در پیش‌نیازها");
  return errors;
}
