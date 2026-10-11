import type { Permission } from "../server/permissions";
export const agentActionPermissionMap: Readonly<
  Record<string, readonly Permission[]>
> = Object.freeze({
  "system.createImprovement": ["system.create", "system.improvement.edit"],
  "system.createKPI": ["system.create", "system.kpi.edit"],
  "strategy.createObjective": ["strategy.create", "strategy.objective.edit"],
  "strategy.createKR": ["strategy.create", "strategy.kr.edit"],
  "strategy.createInitiative": ["strategy.create", "strategy.initiative.edit"],
  "scale.createGrowthIdea": ["scale.create", "scale.edit"],
  "scale.createExperiment": ["scale.create", "scale.experiment.edit"],
  "scale.createPreparationItem": ["scale.create", "scale.readiness.edit"],
});
export const agentActionLabels: Record<string, string> = {
  "system.createImprovement": "بهبود فرایند",
  "system.createKPI": "شاخص عملکرد",
  "strategy.createObjective": "هدف استراتژیک",
  "strategy.createKR": "نتیجه کلیدی",
  "strategy.createInitiative": "ابتکار استراتژیک",
  "scale.createGrowthIdea": "ایده رشد",
  "scale.createExperiment": "آزمایش رشد",
  "scale.createPreparationItem": "آماده‌سازی اسکیل",
};
