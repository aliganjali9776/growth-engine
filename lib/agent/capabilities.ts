import type {
  AgentCapability,
  AgentPermission,
  Authority,
  Domain,
  Risk,
} from "./types";
const read: Record<string, string[]> = {
  System: [
    "getHealth",
    "getCriticalProcesses",
    "getFounderDependency",
    "getProcess",
    "getProcessKPIs",
  ],
  Strategy: [
    "getHealth",
    "getCurrentCycle",
    "getObjectives",
    "getAtRiskKRs",
    "getKR",
    "getWeeklyTrend",
    "getManagementAttention",
  ],
  Scale: [
    "getHealth",
    "getPrimaryConstraint",
    "getExperiments",
    "getFunnelSummary",
    "getChannelSummary",
    "getScaleCandidates",
    "getCapacityRisks",
  ],
  Executive: ["get3SSummary"],
};
const prepares: Record<string, string[]> = {
  System: [
    "prepareImprovement",
    "prepareSOPChange",
    "prepareOwnerChange",
    "prepareKPI",
  ],
  Strategy: [
    "prepareObjective",
    "prepareKR",
    "prepareInitiative",
    "prepareDecision",
    "prepareKRTargetChange",
    "prepareCancelObjective",
  ],
  Scale: [
    "prepareGrowthIdea",
    "prepareExperiment",
    "prepareConstraint",
    "preparePreparationItem",
  ],
  Executive: ["prepareDecisionNote"],
  CrossModule: ["prepareActionPlan"],
};
const writes: [Domain, string, string, Risk][] = [
  ["System", "createKPI", "process", "Medium"],
  ["Strategy", "createInitiative", "initiative", "Medium"],
  ["Scale", "createGrowthIdea", "idea", "Low"],
  ["Scale", "createPreparationItem", "candidate", "Medium"],
  ["Strategy", "createObjective", "objective", "Medium"],
  ["Strategy", "createKR", "KR", "Medium"],
  ["Strategy", "updateKRTarget", "KR", "High"],
  ["Strategy", "cancelObjective", "objective", "Critical"],
  ["Scale", "createExperiment", "experiment", "Medium"],
  ["Scale", "updatePrimaryConstraint", "constraint", "Critical"],
  ["Scale", "stopExperiment", "experiment", "High"],
  ["Scale", "applyScaleDecision", "candidate", "Critical"],
  ["System", "createImprovement", "process", "Medium"],
  ["System", "updateProcessOwner", "process", "Critical"],
  ["System", "approveSOP", "process", "Critical"],
];
const preparationRisks: Record<string, Risk> = {
  prepareImprovement: "Medium",
  prepareSOPChange: "Medium",
  prepareOwnerChange: "High",
  prepareKPI: "Medium",
  prepareObjective: "Medium",
  prepareKR: "Medium",
  prepareInitiative: "Medium",
  prepareDecision: "Medium",
  prepareGrowthIdea: "Low",
  prepareExperiment: "Medium",
  prepareConstraint: "High",
  preparePreparationItem: "Medium",
  prepareDecisionNote: "Low",
  prepareActionPlan: "Medium",
  prepareKRTargetChange: "High",
  prepareCancelObjective: "Critical",
};
function cap(
  domain: Domain,
  name: string,
  authorityLevel: Authority,
  riskLevel: Risk = "Low",
  entityType?: string,
): AgentCapability {
  const id = `${domain.toLowerCase()}.${name}`;
  return {
    id,
    name,
    domain,
    authorityLevel,
    riskLevel,
    entityType,
    description:
      authorityLevel === "Execute"
        ? "قرارداد نوشتن؛ فقط شبیه‌سازی"
        : authorityLevel === "Prepare"
          ? "پیش‌نویس بدون تغییر داده کسب‌وکار"
          : "خواندن شواهد منتخب از منابع مرجع",
    inputSchema:
      authorityLevel === "Execute"
        ? { entityId: "string", value: "action-specific" }
        : { entityId: "optional string" },
    outputSchema:
      authorityLevel === "Execute"
        ? "AgentExecutionResult (dryRun)"
        : authorityLevel === "Prepare"
          ? "draft"
          : "AgentToolResult",
    requiredPermissions: [`${id}:${authorityLevel}`],
    requiresApproval: authorityLevel === "Execute",
    approvalPolicy:
      authorityLevel === "Execute" ? "AlwaysRequired" : "NeverRequired",
    enabled: true,
  };
}
export const capabilityRegistry: readonly AgentCapability[] = Object.freeze(
  [
    ...Object.entries(read).flatMap(([d, ns]) =>
      ns.map((n) => cap(d as Domain, n, "Observe")),
    ),
    ...Object.entries(prepares).flatMap(([d, ns]) =>
      ns.map((n) => cap(d as Domain, n, "Prepare", preparationRisks[n])),
    ),
    cap("CrossModule", "recommend", "Recommend"),
    ...writes.map(([d, n, e, r]) => cap(d, n, "Execute", r, e)),
  ].map((c) => Object.freeze(c)),
);
export const defaultPermissions: readonly AgentPermission[] = Object.freeze(
  capabilityRegistry.map((c) =>
    Object.freeze({
      capabilityId: c.id,
      authority: c.authorityLevel,
      allowed: true,
    }),
  ),
);
export const findCapability = (id: string) =>
  capabilityRegistry.find((c) => c.id === id);
export const neverAutonomous = Object.freeze([
  "KRTarget",
  "KRBaseline",
  "CancelObjective",
  "PrimaryConstraint",
  "StopExperiment",
  "ScaleDecision",
  "ActiveCycle",
  "Organization",
  "RoleOwnership",
  "SOPApproval",
  "ImportantArchive",
  "NextCycle",
  "Delete",
  "StructuralChange",
]);
export function policyFor(actionType: string) {
  return {
    risk: ["Delete", "StructuralChange"].includes(actionType)
      ? ("Critical" as Risk)
      : ("High" as Risk),
    requiresApproval: true,
    approvalPolicy: "AlwaysRequired" as const,
  };
}
export function permitted(
  c: AgentCapability,
  permissions: readonly AgentPermission[],
) {
  return (
    c.enabled &&
    permissions.some(
      (p) =>
        p.capabilityId === c.id &&
        p.authority === c.authorityLevel &&
        p.allowed,
    )
  );
}
