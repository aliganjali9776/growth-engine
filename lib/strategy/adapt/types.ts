import type {
  StrategyCycle,
  StrategyObjective,
  StrategicPriority,
  StrategyRole,
} from "../model";
import type { KeyResult, KRStatus, ObjectiveHealth } from "../kr/types";
import type { StrategicInitiative } from "../initiatives/types";
import type { KRCheckIn, StrategyDecision } from "../weekly/types";
export const adaptationDecisions = {
  continue: "ادامه",
  support: "افزایش حمایت",
  reduce: "کاهش دامنه",
  pause: "توقف موقت",
  stop: "توقف",
  replace: "جایگزینی",
  extend: "تمدید",
  owner: "تغییر مالک",
};
export const decisionTypes = {
  continue: "ادامه",
  change: "تغییر",
  stop: "توقف",
  escalate: "ارجاع به مدیریت",
  resource: "جابه‌جایی منابع",
  owner: "تغییر مالک",
  other: "سایر",
};
export const resourceTypes = {
  budget: "بودجه",
  people: "افراد",
  attention: "توجه مدیریت",
  time: "زمان",
  other: "سایر",
};
export const outcomeLabels = {
  achieved: "محقق‌شده",
  partial: "تاحدی محقق‌شده",
  missed: "محقق‌نشده",
  cancelled: "لغوشده",
};
export const assumptionStatuses = {
  untested: "آزموده‌نشده",
  supported: "تاییدشده",
  weakening: "در حال تضعیف",
  invalidated: "ردشده",
};
export const learningCategories = {
  market: "بازار",
  customer: "مشتری",
  execution: "اجرا",
  team: "تیم",
  product: "محصول",
  channel: "کانال",
  pricing: "قیمت‌گذاری",
  strategy: "استراتژی",
  other: "سایر",
};
export const hypothesisResults = {
  supported: "پشتیبانی‌شده",
  partial: "تاحدی پشتیبانی‌شده",
  unsupported: "پشتیبانی‌نشده",
  inconclusive: "نامشخص",
};
export const priorityReviewLabels = {
  valid: "همچنان معتبر",
  focus: "نیازمند تمرکز بیشتر",
  reduce: "اهمیت کمتر",
  deprioritize: "خروج از تمرکز",
};
export const adaptThresholds = {
  consecutiveWeeks: 3,
  confidenceDrop: 2,
  lowProgress: 30,
};
export type EntityKind =
  "kr" | "objective" | "priority" | "initiative" | "cycle";
export interface StrategyChangeRecord {
  id: string;
  cycleId: string;
  entityId: string;
  entityType: EntityKind;
  fieldChanged: string;
  oldValue: unknown;
  newValue: unknown;
  reason: string;
  reviewId: string;
  changedAt: string;
}
export type KRChangeRecord = StrategyChangeRecord & { entityType: "kr" };
export type ObjectiveChangeRecord = StrategyChangeRecord & {
  entityType: "objective";
};
export interface InitiativeAdaptationDecision {
  id: string;
  initiativeId: string;
  decision: keyof typeof adaptationDecisions;
  rationale: string;
  effectiveDate: string;
  ownerRoleId: string;
  newDueDate: string;
  createdAt: string;
  appliedAt?: string;
}
export interface ResourceShift {
  id: string;
  reviewId: string;
  fromArea: string;
  toArea: string;
  resourceType: keyof typeof resourceTypes;
  description: string;
  rationale: string;
  relatedObjectiveId: string;
  relatedInitiativeId: string;
  createdAt: string;
}
export interface AdaptDecision extends StrategyDecision {
  decisionType: keyof typeof decisionTypes;
  relatedPriorityId: string;
}
export interface PriorityReview {
  priorityId: string;
  decision: keyof typeof priorityReviewLabels;
  rationale: string;
}
export interface StrategicAssumption {
  id: string;
  cycleId: string;
  statement: string;
  status: keyof typeof assumptionStatuses;
  evidence: string;
  relatedPriorityId: string;
  createdAt: string;
  updatedAt: string;
  sourceId?: string;
}
export interface StrategyLearning {
  id: string;
  cycleId: string;
  category: keyof typeof learningCategories;
  statement: string;
  evidence: string;
  relatedObjectiveId: string;
  relatedKRId: string;
  relatedInitiativeId: string;
  createdAt: string;
  sourceId?: string;
}
export interface InitiativeLearning {
  initiativeId: string;
  hypothesisResult: keyof typeof hypothesisResults;
  lesson: string;
  repeatDecision: "repeat" | "stop" | "reconsider";
}
export interface AdaptSignal {
  id: string;
  entityId: string;
  kind: string;
  text: string;
  severity: number;
}
export interface EvidenceSnapshot {
  recordedAt: string;
  cycle: StrategyCycle;
  roles: StrategyRole[];
  objectives: StrategyObjective[];
  priorities: StrategicPriority[];
  keyResults: KeyResult[];
  initiatives: StrategicInitiative[];
  checkIns: KRCheckIn[];
  assumptions: StrategicAssumption[];
  learnings: StrategyLearning[];
  signals: AdaptSignal[];
  objectiveOutcomes: {
    id: string;
    progress: number | null;
    confidence: number | null;
    health: ObjectiveHealth;
    achievedKRs: number;
    missedKRs: number;
  }[];
  overallProgress: number | null;
  averageConfidence: number | null;
  krStatuses: Record<KRStatus | "unknown", number>;
  repeatedBlockers: number;
  stalledKRs: number;
  confidenceDeclines: number;
  activeInitiatives: number;
  blockedInitiatives: number;
  ineffectiveInitiatives: number;
  quality: number;
}
export interface StrategyAdaptReview {
  id: string;
  cycleId: string;
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  status: "draft" | "completed";
  reviewedByRoleId: string;
  progressSummary: string;
  marketChanges: string[];
  internalChanges: string[];
  majorRisks: string[];
  decisions: AdaptDecision[];
  resourceShifts: ResourceShift[];
  priorityChanges: PriorityReview[];
  initiativeChanges: InitiativeAdaptationDecision[];
  objectiveChanges: string[];
  notes: string;
  nextFocus: string[];
  reviewedRiskIds: string[];
  resourcesReviewed: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  overrideReason: string;
  snapshot?: EvidenceSnapshot;
}
export interface StrategyCycleReview {
  id: string;
  cycleId: string;
  status: "draft" | "completed";
  objectiveClassifications: Record<string, keyof typeof outcomeLabels>;
  krClassifications: Record<string, keyof typeof outcomeLabels>;
  keyWins: string[];
  keyMisses: string[];
  lessonsLearned: string[];
  assumptionsValidated: string[];
  assumptionsInvalidated: string[];
  initiativeLearnings: InitiativeLearning[];
  strategicChanges: string[];
  executiveConclusion: string;
  reviewedByRoleId: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  overrideReason: string;
  snapshot?: EvidenceSnapshot;
}
export interface CarryForwardSelection {
  priorityIds: string[];
  objectiveIds: string[];
  krIds: string[];
  initiativeIds: string[];
  learningIds: string[];
  assumptionIds: string[];
}
export interface CycleResetRecord {
  id: string;
  sourceCycleId: string;
  newCycleId: string;
  reviewId: string;
  selection: CarryForwardSelection;
  mappings: { kind: string; oldId: string; newId: string }[];
  createdAt: string;
}
