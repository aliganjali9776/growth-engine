export type RiskSeverity = "critical" | "high" | "medium" | "low";
export interface StrategyRisk {
  id: string;
  type: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  objectiveId?: string;
  keyResultId?: string;
  initiativeId?: string;
  priorityId?: string;
  evidence: string[];
  recommendedManagementAction: string;
  destination: string;
  rankReasons: string[];
  rank: number;
}
export interface ReportFilters {
  cycleId?: string;
  objectiveId?: string;
  ownerRoleId?: string;
  priorityId?: string;
  krStatus?: string;
  initiativeStatus?: string;
  weeks?: number;
}
export interface HealthComponent {
  id: string;
  label: string;
  score: number | null;
  weight: number;
  contribution: number | null;
  availability: string;
  reason: string;
}
export const healthLabels = {
  critical: "بحرانی",
  offTrack: "خارج از مسیر",
  attention: "نیازمند توجه",
  onTrack: "در مسیر",
  strong: "قوی",
  insufficient: "داده کافی نیست",
};
export const severityLabels = {
  critical: "بحرانی",
  high: "بالا",
  medium: "متوسط",
  low: "پایین",
};
export const dashboardRules = {
  healthVersion: "4F.1",
  healthWeights: {
    pace: 35,
    confidence: 20,
    effectiveness: 20,
    discipline: 15,
    alignment: 10,
  },
  minimumHealthCoverage: 60,
  staleDays: 7,
  adaptDays: 30,
  highWeight: 20,
  highExecution: 70,
  lowResult: 30,
};
