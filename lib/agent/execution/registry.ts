import type { TemplateId } from "../preparation/types";
export const ExecutableCapabilityRegistry = Object.freeze([
  {
    templateId: "Improvement",
    capabilityId: "system.createImprovement",
    domain: "System",
    entityType: "improvement",
    executionEnabled: true,
    rollbackSupported: false,
  },
  {
    templateId: "KPI",
    capabilityId: "system.createKPI",
    domain: "System",
    entityType: "KPI",
    executionEnabled: true,
    rollbackSupported: false,
  },
  {
    templateId: "Objective",
    capabilityId: "strategy.createObjective",
    domain: "Strategy",
    entityType: "objective",
    executionEnabled: true,
    rollbackSupported: false,
  },
  {
    templateId: "KR",
    capabilityId: "strategy.createKR",
    domain: "Strategy",
    entityType: "KR",
    executionEnabled: true,
    rollbackSupported: false,
  },
  {
    templateId: "Initiative",
    capabilityId: "strategy.createInitiative",
    domain: "Strategy",
    entityType: "initiative",
    executionEnabled: true,
    rollbackSupported: false,
  },
  {
    templateId: "GrowthIdea",
    capabilityId: "scale.createGrowthIdea",
    domain: "Scale",
    entityType: "idea",
    executionEnabled: true,
    rollbackSupported: true,
  },
  {
    templateId: "Experiment",
    capabilityId: "scale.createExperiment",
    domain: "Scale",
    entityType: "experiment",
    executionEnabled: true,
    rollbackSupported: false,
  },
  {
    templateId: "ScalePreparation",
    capabilityId: "scale.createPreparationItem",
    domain: "Scale",
    entityType: "preparation",
    executionEnabled: true,
    rollbackSupported: false,
  },
] as const);
export const executable = (id: TemplateId) =>
  ExecutableCapabilityRegistry.find((x) => x.templateId === id);
