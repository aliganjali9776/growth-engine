export type AssessmentDimension = "system" | "strategy" | "scale";
export type AssessmentAnswer = 1 | 2 | 3 | 4 | 5;
export type Answers = Record<string, AssessmentAnswer>;
export interface AssessmentQuestion {
  id: string;
  dimension: AssessmentDimension;
  text: string;
  weight: number;
  issueTitle: string;
  focus: string;
  explanation: string;
}
export interface CompanyProfile {
  name: string;
  industry: string;
  model: string;
  teamSize: string;
  revenue: string;
  stage: string;
}
export type HealthStatus =
  "critical" | "developing" | "healthy" | "strong" | "excellent";
export type FindingSeverity =
  "critical" | "action" | "improvement" | "strength";
export interface HiddenRisk {
  id: string;
  dimension: AssessmentDimension;
  title: string;
  explanation: string;
  evidence: string[];
}
export interface DimensionDiagnostic {
  dimension: AssessmentDimension;
  score: number;
  status: HealthStatus;
  interpretation: string;
  findings: DiagnosticIssue[];
  risks: HiddenRisk[];
  focus: string;
  action: string;
  working: string;
  riskNote: string;
}
export interface DiagnosticIssue {
  id: string;
  title: string;
  dimension: AssessmentDimension;
  severity: FindingSeverity;
  explanation: string;
  answer: AssessmentAnswer;
  critical: boolean;
}
export interface AssessmentResult {
  scores: Record<AssessmentDimension, number>;
  overall: number;
  status: HealthStatus;
  capped: boolean;
  primaryConstraint: AssessmentDimension;
  tiedDimensions: AssessmentDimension[];
  issues: DiagnosticIssue[];
  insights: string[];
  recommendation: { title: string; description: string };
  allStrong: boolean;
  findings: DiagnosticIssue[];
  dimensionDiagnostics: DimensionDiagnostic[];
  hiddenRisks: HiddenRisk[];
  executiveSummary: string[];
  consultationCopy: string;
}
export type Screen =
  "intro" | "profile" | "section" | "question" | "results" | "roadmap";
export interface AssessmentDraft {
  version: 2;
  profile: CompanyProfile;
  answers: Answers;
  screen: Screen;
  questionIndex: number;
  completedAt: string | null;
}
