import type {
  AgentEntityRef,
  AgentEvidence,
  AgentRecommendation,
  Domain,
  Risk,
} from "../types";
export type Confidence = "Low" | "Medium" | "High";
export type SignalType =
  | "Performance"
  | "Trend"
  | "Risk"
  | "Capacity"
  | "Alignment"
  | "Execution"
  | "Confidence"
  | "DataQuality"
  | "Dependency"
  | "RepeatedIssue"
  | "Opportunity"
  | "Contradiction";
export interface AgentSignal {
  id: string;
  type: SignalType;
  domain: Domain;
  title: string;
  description: string;
  severity: Risk;
  entityRefs: AgentEntityRef[];
  evidenceIds: string[];
  detectedAt: string;
  lastSeenAt: string;
  fingerprint: string;
  status: "Active" | "Resolved" | "Suppressed" | "Stale";
  sourceKey: string;
  sourceFamily: string;
  confidence: Confidence;
}
export type PatternType =
  | "CrossModuleConstraint"
  | "ExecutionResultMismatch"
  | "StrategyCapacityMismatch"
  | "GrowthCapacityMismatch"
  | "RepeatedManagementBlocker"
  | "FounderDependencyImpact"
  | "ExperimentToSystemConflict"
  | "DataQualityRisk"
  | "ResourceOverload"
  | "AlignmentConflict"
  | "EmergingOpportunity";
export interface AgentPattern {
  id: string;
  type: PatternType;
  title: string;
  description: string;
  signalIds: string[];
  evidenceIds: string[];
  entityRefs: AgentEntityRef[];
  strength: "Weak" | "Moderate" | "Strong";
  firstDetectedAt: string;
  lastDetectedAt: string;
  status: "Active" | "Resolved" | "Stale";
  ruleId: string;
  fingerprint: string;
  primaryKey: string;
}
export type DiagnosisStatus =
  "New" | "Reviewed" | "Monitoring" | "Resolved" | "Dismissed";
export interface AgentDiagnosis {
  id: string;
  fingerprint: string;
  title: string;
  summary: string;
  category:
    | "SystemConstraint"
    | "StrategyExecution"
    | "GrowthConstraint"
    | "Capacity"
    | "Alignment"
    | "LeadershipDependency"
    | "DataQuality"
    | "Opportunity"
    | "CrossModule";
  severity: Risk;
  confidence: Confidence;
  patternIds: string[];
  evidenceIds: string[];
  affectedEntities: AgentEntityRef[];
  businessImpact: "Localized" | "Material" | "CrossFunctional" | "Strategic";
  managementQuestion: string;
  status: DiagnosisStatus;
  firstDetectedAt: string;
  lastUpdatedAt: string;
  lastSeenAt: string;
  needsRefresh: boolean;
  sourceFamilies: string[];
  recurrenceCount: number;
  deadlineRisk?: boolean;
  recommendations: (AgentRecommendation & {
    recommendationType:
      | "Investigate"
      | "Prioritize"
      | "Monitor"
      | "Reduce"
      | "Improve"
      | "Validate"
      | "CollectData";
  })[];
}
export interface AgentPriorityIssue {
  id: string;
  diagnosisId: string;
  rank: number;
  priority: Risk;
  reason: string;
  managementFocus: string;
  evidenceIds: string[];
  generatedAt: string;
  factors: {
    severity: Risk;
    confidence: Confidence;
    reach: number;
    persistence: boolean;
    capacity: boolean;
    strategic: boolean;
    deadline: boolean;
  };
}
export interface DiagnosisRun {
  id: string;
  startedAt: string;
  completedAt: string;
  scope: "Executive3S";
  contextVersion: string;
  signalsFound: number;
  patternsFound: number;
  diagnosesCreated: number;
  status: "Completed";
  mode: "DeterministicOnly" | "Hybrid";
  modelUsed?: string;
  promptVersion?: string;
}
export interface DiagnosisHistoryEvent {
  id: string;
  diagnosisId: string;
  event:
    | "Created"
    | "Updated"
    | "Reviewed"
    | "Monitoring"
    | "Dismissed"
    | "Resolved"
    | "Reopened";
  timestamp: string;
  summary: string;
  evidenceIds: string[];
}
export interface DiagnosisState {
  version: 1;
  evidence: AgentEvidence[];
  signals: AgentSignal[];
  patterns: AgentPattern[];
  diagnoses: AgentDiagnosis[];
  priorities: AgentPriorityIssue[];
  runs: DiagnosisRun[];
  history: DiagnosisHistoryEvent[];
}
export interface SignalInput {
  evidence: AgentEvidence[];
  signals: AgentSignal[];
  signature: string;
  availableKeys: string[];
  notices: string[];
}
export const emptyDiagnosisState = (): DiagnosisState => ({
  version: 1,
  evidence: [],
  signals: [],
  patterns: [],
  diagnoses: [],
  priorities: [],
  runs: [],
  history: [],
});
