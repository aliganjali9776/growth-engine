export const domains = [
  "System",
  "Strategy",
  "Scale",
  "Executive",
  "CrossModule",
] as const;
export type Domain = (typeof domains)[number];
export type Authority = "Observe" | "Recommend" | "Prepare" | "Execute";
export type Risk = "Low" | "Medium" | "High" | "Critical";
export type ApprovalPolicy =
  "NeverRequired" | "Required" | "RequiredForHighRisk" | "AlwaysRequired";
export type ErrorCode =
  | "PermissionDenied"
  | "ApprovalRequired"
  | "EntityNotFound"
  | "InvalidPayload"
  | "StaleProposal"
  | "ExecutionFailed"
  | "UnsupportedCapability";
export interface AgentEntityRef {
  domain: Domain;
  entityType: string;
  entityId: string;
  label?: string;
  route?: string;
}
export interface AgentContext {
  currentModule: Domain;
  route: string;
  activeStrategyCycleId?: string;
  selectedObjectiveId?: string;
  selectedKRId?: string;
  selectedProcessId?: string;
  selectedConstraintId?: string;
  selectedExperimentId?: string;
  selectedCandidateId?: string;
  userIntent: string;
  generatedAt: string;
}
export interface AgentCapability {
  id: string;
  name: string;
  description: string;
  domain: Domain;
  authorityLevel: Authority;
  inputSchema: Record<string, string>;
  outputSchema: string;
  requiredPermissions: string[];
  riskLevel: Risk;
  requiresApproval: boolean;
  approvalPolicy: ApprovalPolicy;
  enabled: boolean;
  entityType?: string;
}
export interface AgentPermission {
  capabilityId: string;
  authority: Authority;
  allowed: boolean;
}
export type EvidenceType =
  | "Metric"
  | "Status"
  | "Trend"
  | "Risk"
  | "HistoricalRecord"
  | "Relationship"
  | "Decision"
  | "Learning"
  | "Capacity"
  | "Constraint"
  | "Process"
  | "Other";
export interface AgentEvidence {
  id: string;
  domain: Domain;
  entityRef?: AgentEntityRef;
  evidenceType: EvidenceType;
  title: string;
  summary: string;
  value?: unknown;
  previousValue?: unknown;
  status?: string;
  timestamp?: string;
  sourceSelector?: string;
  route?: string;
  confidence?: "Low" | "Medium" | "High";
  createdAt: string;
}
export interface AgentObservation {
  id: string;
  domain: Domain;
  type: string;
  statement: string;
  evidenceIds: string[];
  severity?: Risk;
  createdAt: string;
}
export interface AgentRecommendation {
  id: string;
  domain: Domain;
  title: string;
  summary: string;
  rationale: string;
  priority: Risk;
  confidence: "Low" | "Medium" | "High";
  evidenceIds: string[];
  suggestedActions: string[];
  status:
    | "New"
    | "Reviewed"
    | "Accepted"
    | "Dismissed"
    | "ConvertedToAction"
    | "Archived";
  createdAt: string;
}
export interface AgentProposedAction {
  id: string;
  capabilityId: string;
  domain: Domain;
  actionType: string;
  title: string;
  rationale: string;
  payload: Record<string, unknown>;
  affectedEntities: AgentEntityRef[];
  evidenceIds: string[];
  risk: Risk;
  requiresApproval: boolean;
  status:
    | "Draft"
    | "ReadyForApproval"
    | "Approved"
    | "Rejected"
    | "Executed"
    | "Failed"
    | "Cancelled";
  createdAt: string;
  expectedCurrentState: Record<string, unknown>;
  dryRun: true;
}
export interface AgentApprovalRequest {
  id: string;
  proposedActionId: string;
  title: string;
  description: string;
  risk: Risk;
  affectedEntities: AgentEntityRef[];
  changeSummary: string;
  evidenceIds: string[];
  status: "Pending" | "Approved" | "Rejected" | "Expired" | "Executed";
  requestedAt: string;
  expiresAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  binding: string;
}
export interface AgentExecutionResult {
  success: boolean;
  dryRun: true;
  actionId: string;
  summary: string;
  affectedEntities: AgentEntityRef[];
  error?: { code: ErrorCode; message: string };
}
export interface AgentAuditRecord {
  id: string;
  event:
    | "ObservationCreated"
    | "RecommendationCreated"
    | "ActionPrepared"
    | "ApprovalRequested"
    | "ActionApproved"
    | "ActionRejected"
    | "ActionExecuted"
    | "ActionFailed"
    | "AdvisorQuestionAsked"
    | "ContextBuilt"
    | "ModelCalled"
    | "AdvisorResponseCreated"
    | "ModelError";
  timestamp: string;
  summary: string;
  artifactId: string;
  affectedEntities: AgentEntityRef[];
  dryRun: boolean;
  errorCode?: ErrorCode;
}
export interface AgentContextPacket {
  topic: string;
  entities: AgentEntityRef[];
  metrics: AgentEvidence[];
  risks: AgentEvidence[];
  evidence: AgentEvidence[];
  historySummary: string[];
  generatedAt: string;
}
export type SystemProcessContext = AgentContextPacket;
export type StrategyObjectiveContext = AgentContextPacket;
export type StrategyKRContext = AgentContextPacket;
export type ScaleConstraintContext = AgentContextPacket;
export type ScaleExperimentContext = AgentContextPacket;
export type Executive3SContext = AgentContextPacket;
export interface BusinessContextSnapshot {
  generatedAt: string;
  System: {
    health: number | null;
    criticalProcesses: number;
    founderDependency: number;
    ownershipRisks: number;
  };
  Strategy: {
    activeCycleId: string | null;
    health: number | null;
    objectives: number;
    krRisks: number;
    focus: string;
  };
  Scale: {
    health: number | null;
    primaryConstraint: string;
    experiments: number;
    candidates: number;
    capacityRisks: number;
    funnel: string;
  };
}
export interface AgentState {
  version: 1;
  evidence: AgentEvidence[];
  observations: AgentObservation[];
  recommendations: AgentRecommendation[];
  proposals: AgentProposedAction[];
  approvals: AgentApprovalRequest[];
  audit: AgentAuditRecord[];
}
export interface AgentToolResult<T = unknown> {
  success: boolean;
  data?: T;
  evidence: AgentEvidence[];
  warnings: string[];
  error?: { code: ErrorCode; message: string };
}
export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, string>;
  permission: Authority;
  risk: Risk;
  requiresApproval: boolean;
  execute(input: unknown): AgentToolResult;
}
export interface AgentModelProvider {
  generateObservations(
    context: AgentContextPacket,
  ): Promise<AgentObservation[]>;
  generateRecommendations(
    context: AgentContextPacket,
  ): Promise<AgentRecommendation[]>;
  prepareAction(context: AgentContextPacket): Promise<AgentProposedAction>;
}
