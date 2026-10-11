export const initiativeStatuses = {
  proposed: "پیشنهادشده",
  planned: "برنامه‌ریزی‌شده",
  inProgress: "در حال اجرا",
  blocked: "متوقف‌شده",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};
export const initiativePriorities = {
  critical: "بحرانی",
  high: "بالا",
  medium: "متوسط",
  low: "پایین",
};
export const effectivenessLabels = {
  notEvaluated: "ارزیابی نشده",
  promising: "امیدبخش",
  effective: "موثر",
  weak: "کم‌اثر",
  ineffective: "بی‌اثر",
};
export const impactTypes = {
  unknown: "نامشخص",
  qualitative: "کیفی",
  numeric: "عددی",
};
export const effortLabels = {
  unknown: "مشخص نشده",
  low: "کم",
  medium: "متوسط",
  high: "زیاد",
};
export interface StrategicInitiative {
  id: string;
  cycleId: string;
  objectiveId: string;
  keyResultId: string;
  code: string;
  title: string;
  description: string;
  ownerRoleId: string;
  hypothesis: string;
  expectedImpact: string;
  actualImpact: string;
  impactType: keyof typeof impactTypes;
  expectedImpactValue: number | null;
  expectedImpactUnit: string;
  priority: keyof typeof initiativePriorities;
  status: keyof typeof initiativeStatuses;
  progress: number;
  effectiveness: keyof typeof effectivenessLabels;
  startDate: string;
  dueDate: string;
  startedAt?: string;
  completedAt?: string;
  blockedReason: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  effort: keyof typeof effortLabels;
  impactLevel: keyof typeof effortLabels;
  linkedSystemProcessId?: string;
  krProgressAtStart?: number | null;
  krValueAtStart?: number | null;
  baselineCapturedAt?: string;
  baselineKeyResultId?: string;
}
export interface InitiativeFinding {
  id: string;
  severity: number;
  text: string;
  href: string;
}
export const initiativeThresholds = {
  perObjective: 3,
  perOwner: 3,
  perCycle: 5,
  dueSoonDays: 7,
  lowExecution: 25,
  highExecution: 70,
  lowKRProgress: 30,
  meaningfulMovement: 1,
  gapAttention: 20,
};
