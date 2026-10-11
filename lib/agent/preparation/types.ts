import type {
  AgentProposedAction,
  AgentRecommendation,
  AgentApprovalRequest,
  AgentEvidence,
  AgentEntityRef,
  Domain,
  Risk,
} from "../types";
export type ActionStatus =
  | "Draft"
  | "ReadyForApproval"
  | "Approved"
  | "Rejected"
  | "Archived"
  | "NeedsReview"
  | "ReadyToExecute"
  | "Executing"
  | "Executed"
  | "ExecutionFailed"
  | "Stale"
  | "Cancelled";
export type TemplateId =
  | "Improvement"
  | "SOPChange"
  | "OwnerChange"
  | "KPI"
  | "Objective"
  | "KR"
  | "Initiative"
  | "StrategyDecision"
  | "GrowthIdea"
  | "Experiment"
  | "ConstraintUpdate"
  | "ScalePreparation"
  | "DecisionNote"
  | "ActionPlan"
  | "KRTargetChange"
  | "CancelObjective";
export type RecommendationType =
  | "Investigate"
  | "ImproveProcess"
  | "ChangeOwnership"
  | "Standardize"
  | "Experiment"
  | "AdjustStrategy"
  | "CollectData"
  | "PrepareCapacity"
  | "ReduceRisk"
  | "ScaleOpportunity"
  | "Monitor";
export interface AgentActionOption {
  id: string;
  recommendationId: string;
  title: string;
  description: string;
  capabilityId: string;
  templateId: TemplateId;
  domain: Domain;
  riskLevel: Risk;
  effort: "Low" | "Medium" | "High";
  timeHorizon: "Immediate" | "ThisWeek" | "ThisCycle" | "LongerTerm";
  expectedImpact: string;
  prerequisites: string[];
  evidenceIds: string[];
  recommended: boolean;
}
export interface PreparedRecommendation extends Omit<
  AgentRecommendation,
  "status"
> {
  diagnosisId?: string;
  recommendationType: RecommendationType;
  actionOptions: AgentActionOption[];
  assumptions: string[];
  risks: string[];
  primaryReason: string;
  sourceVersion: string;
  status: AgentRecommendation["status"] | "PotentiallyStale";
}
export interface DraftField {
  path: string;
  label: string;
  kind: "text" | "number" | "date" | "role" | "entity" | "select";
  required: boolean;
  choices?: { id: string; label: string }[];
  entityType?: string;
  state: "Resolved" | "Suggested" | "NeedsUserInput" | "Invalid";
  source: "AgentSuggested" | "UserEdited";
}
export interface ValidationResult {
  status: "Valid" | "NeedsInput" | "Stale" | "Invalid";
  missing: string[];
  errors: string[];
  warnings: string[];
  completeness: number;
  validatedAt: string;
}
export interface PreparedAction extends Omit<AgentProposedAction, "status"> {
  approvalPolicy: "AlwaysRequired";
  executionRecordId?: string;
  status: ActionStatus;
  templateId: TemplateId;
  sourceDiagnosisId?: string;
  sourceRecommendationId?: string;
  entityType: string;
  targetEntityId: string;
  currentStateSnapshot: Record<string, unknown>;
  proposedStateSnapshot: Record<string, unknown>;
  riskLevel: Risk;
  reversibility: "Easy" | "Moderate" | "Difficult" | "Irreversible";
  expectedImpact: string;
  assumptions: string[];
  warnings: string[];
  fields: DraftField[];
  validation: ValidationResult;
  revision: number;
  updatedAt: string;
  origin: "Diagnosis" | "AdvisorRequest" | "Manual" | "ExecutiveBrief";
  dedupKey: string;
  dependencyIds: string[];
}
export interface DraftRevision {
  id: string;
  actionId: string;
  revision: number;
  changedFields: string[];
  changedAt: string;
  source: "Agent" | "User";
  payload: Record<string, unknown>;
}
export interface AgentActionDependency {
  id: string;
  fromStepId: string;
  toStepId: string;
  condition: string;
  status: "Pending" | "Satisfied";
}
export interface AgentActionPlan {
  id: string;
  diagnosisId?: string;
  title: string;
  objective: string;
  steps: {
    id: string;
    order: number;
    domain: Domain;
    title: string;
    templateId: TemplateId;
    proposedActionId?: string;
    dependencyIds: string[];
    ownerRoleId?: string;
    expectedOutcome: string;
    completionCondition: string;
  }[];
  dependencies: AgentActionDependency[];
  evidenceIds: string[];
  risks: string[];
  status: "Draft" | "ReadyForReview" | "ApprovedConceptually" | "Archived";
  createdAt: string;
}
export type PreparationEvent =
  | "RecommendationCreated"
  | "ActionOptionSelected"
  | "ActionDraftCreated"
  | "DraftEdited"
  | "DraftValidated"
  | "ApprovalRequested"
  | "ApprovalApproved"
  | "ApprovalRejected"
  | "ActionMarkedStale"
  | "PreviewRebuilt"
  | "ActionArchived";
export interface PreparationState {
  version: 1;
  evidence: AgentEvidence[];
  recommendations: PreparedRecommendation[];
  plans: AgentActionPlan[];
  actions: PreparedAction[];
  revisions: DraftRevision[];
  approvals: AgentApprovalRequest[];
  audit: {
    id: string;
    event: PreparationEvent;
    artifactId: string;
    timestamp: string;
    summary: string;
    affectedEntities: AgentEntityRef[];
    dryRun: true;
  }[];
}
export const emptyPreparation = (): PreparationState => ({
  version: 1,
  evidence: [],
  recommendations: [],
  plans: [],
  actions: [],
  revisions: [],
  approvals: [],
  audit: [],
});
