import type {
  AgentContextPacket,
  AgentEvidence,
  AgentEntityRef,
  AgentModelProvider,
  AgentAuditRecord,
} from "../types";
export const intents = [
  "ExecutiveSummary",
  "SystemDiagnosis",
  "StrategyDiagnosis",
  "ScaleDiagnosis",
  "EntityExplanation",
  "Comparison",
  "RiskAnalysis",
  "PriorityQuestion",
  "DataGapQuestion",
  "GeneralBusinessQuestion",
] as const;
export type AdvisorIntent = (typeof intents)[number];
export const contextTypes = [
  "executive",
  "process",
  "objective",
  "kr",
  "constraint",
  "experiment",
] as const;
export interface AdvisorSelection {
  type: (typeof contextTypes)[number];
  id?: string;
}
export interface AdvisorHistory {
  role: "user" | "advisor";
  content: string;
}
export interface AdvisorRequest {
  requestId: string;
  question: string;
  selection: AdvisorSelection;
  packet: AgentContextPacket;
  capabilityIds: string[];
  history: AdvisorHistory[];
  mode: "answer" | "brief";
  demo: boolean;
}
export interface AdvisorClaim {
  text: string;
  evidenceIds: string[];
}
export interface AdvisorRecommendation extends AdvisorClaim {
  confidence: "Low" | "Medium" | "High";
}
export interface AdvisorSection {
  title: string;
  items: AdvisorClaim[];
}
export interface AdvisorComparison {
  option: string;
  benefits: string;
  risks: string;
  evidenceIds: string[];
}
export interface AdvisorModelOutput {
  answer: string;
  summary: string;
  observations: AdvisorClaim[];
  recommendations: AdvisorClaim[];
  evidenceRefs: string[];
  dataGaps: string[];
  warnings: string[];
  brief: AdvisorSection[];
  comparison: AdvisorComparison[];
}
export interface AgentAdvisorResponse extends Omit<
  AdvisorModelOutput,
  "recommendations" | "evidenceRefs"
> {
  recommendations: AdvisorRecommendation[];
  evidenceRefs: AgentEvidence[];
  confidence: "Low" | "Medium" | "High";
  generatedAt: string;
  provider: string;
  model: string;
  promptVersion: string;
  requestTimestamp: string;
  schemaValidated: true;
  modelCalled: boolean;
  intent: AdvisorIntent;
}
export interface AdvisorProvider extends AgentModelProvider {
  name: string;
  model: string;
  analyze(request: AdvisorRequest, signal?: AbortSignal): Promise<unknown>;
}
export type AdvisorErrorCode =
  | "InvalidContext"
  | "InvalidQuestion"
  | "EntityNotFound"
  | "NoProvider"
  | "MissingKey"
  | "RateLimit"
  | "Timeout"
  | "ProviderError"
  | "NetworkError"
  | "InvalidResponse"
  | "Cancelled"
  | "ReadOnly"
  | "OutOfScope";
export class AdvisorError extends Error {
  constructor(
    public code: AdvisorErrorCode,
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export interface AgentMessage {
  id: string;
  sessionId: string;
  role: "user" | "advisor" | "system-event";
  content: string;
  evidenceRefs: AgentEvidence[];
  generatedAt: string;
  response?: AgentAdvisorResponse;
  providerMetadata?: {
    provider: string;
    model: string;
    promptVersion: string;
    requestTimestamp: string;
  };
  feedback?: "Helpful" | "NotHelpful";
  contextFingerprint?: string;
}
export interface AgentSession {
  activeContext?: import("../workspace").WorkspaceContext;
  activeDiagnosisId?: string;
  activeRecommendationId?: string;
  activeActionId?: string;
  workspaceState?: import("../workspace").WorkspaceMode;
  lastActivityAt?: string;
  id: string;
  createdAt: string;
  updatedAt: string;
  initialContext: AdvisorSelection;
  currentContext: AdvisorSelection;
  status: "active";
  messages: AgentMessage[];
  audit: AgentAuditRecord[];
  lastPacket?: AgentContextPacket;
  lastCapabilities?: string[];
  lastFingerprint?: string;
}
export interface AdvisorLocalStore {
  version: 1;
  session: AgentSession | null;
}
export type AdvisorEntityRef = AgentEntityRef;
