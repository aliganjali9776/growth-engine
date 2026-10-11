import type { KeyResult, KRStatus, ObjectiveHealth } from "../kr/types";
import type { StrategicInitiative } from "../initiatives/types";
export const movementLabels = {
  improved: "بهبود",
  stable: "بدون تغییر معنادار",
  regressed: "پسرفت",
  insufficient: "داده کافی نیست",
};
export type Movement = keyof typeof movementLabels;
export interface KRCheckIn {
  id: string;
  reviewId: string;
  cycleId: string;
  keyResultId: string;
  objectiveId: string;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  previousValue: number | null;
  currentValue: number | null;
  delta: number | null;
  previousProgress: number | null;
  progress: number | null;
  previousConfidence: number | null;
  confidence: number | null;
  confidenceDelta: number | null;
  status: KRStatus | null;
  movement: Movement;
  win: string;
  blocker: string;
  nextAction: string;
  comment: string;
  ownerRoleId: string;
  createdAt: string;
  updatedAt: string;
  krSnapshot: KeyResult;
}
export interface StrategyDecision {
  id: string;
  reviewId: string;
  title: string;
  description: string;
  ownerRoleId: string;
  relatedObjectiveId: string;
  relatedKRId: string;
  relatedInitiativeId: string;
  createdAt: string;
}
export interface StrategyWeeklyReview {
  id: string;
  cycleId: string;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "completed";
  reviewedByRoleId: string;
  executiveSummary: string;
  wins: string[];
  blockers: string[];
  nextWeekFocus: string[];
  reviewedRiskIds: string[];
  blockersReviewed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  reopenedAt?: string;
  revision: number;
  incompleteAcknowledged: boolean;
}
export interface ObjectiveWeeklySnapshot {
  reviewId: string;
  cycleId: string;
  objectiveId: string;
  title: string;
  weekNumber: number;
  progress: number | null;
  confidence: number | null;
  health: ObjectiveHealth;
  recordedAt: string;
  checkedIn: number;
  total: number;
}
export interface WeeklyBlocker {
  entityId: string;
  source: "kr" | "initiative" | "review";
  title: string;
  text: string;
}
export interface StrategyWeeklySnapshot {
  reviewId: string;
  cycleId: string;
  weekNumber: number;
  date: string;
  recordedAt: string;
  overallProgress: number | null;
  objectiveCoverage: number;
  objectiveTotal: number;
  objectiveHealthCounts: Record<ObjectiveHealth, number>;
  krStatusCounts: Record<KRStatus | "unknown", number>;
  averageConfidence: number | null;
  activeInitiatives: number;
  blockedInitiatives: number;
  overdueInitiatives: number;
  checkInCompletion: number;
  checkedIn: number;
  total: number;
  quality: number;
  improved: number;
  regressed: number;
  confidenceDrops: number;
  staleKRIds: string[];
  mainRisk: string;
  blockers: WeeklyBlocker[];
  initiativeContext: StrategicInitiative[];
  signals: string[];
  krContext: KeyResult[];
}
