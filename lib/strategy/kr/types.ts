export const krTypes = {
  increase: "افزایشی",
  decrease: "کاهشی",
  binary: "بله / خیر",
  milestone: "مرحله‌ای",
};
export const krStatuses = {
  notStarted: "شروع نشده",
  onTrack: "در مسیر",
  atRisk: "در معرض ریسک",
  offTrack: "خارج از مسیر",
  achieved: "محقق‌شده",
};
export const objectiveHealthLabels = {
  healthy: "سالم",
  atRisk: "در معرض ریسک",
  offTrack: "خارج از مسیر",
  achieved: "محقق‌شده",
  insufficient: "داده کافی نیست",
};
export const units = [
  "٪",
  "تومان",
  "میلیون تومان",
  "میلیارد تومان",
  "نفر",
  "لید",
  "مشتری",
  "ساعت",
  "روز",
  "تعداد",
  "امتیاز",
];
export type KRStatus = keyof typeof krStatuses;
export type ObjectiveHealth = keyof typeof objectiveHealthLabels;
export interface KRMilestone {
  id: string;
  keyResultId: string;
  title: string;
  weight: number;
  completed: boolean;
  completedAt?: string;
}
export interface KeyResult {
  id: string;
  cycleId: string;
  objectiveId: string;
  code: string;
  title: string;
  description: string;
  ownerRoleId: string;
  type: keyof typeof krTypes;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string;
  weight: number | null;
  confidence: number | null;
  startDate: string;
  deadline: string;
  lastUpdateAt?: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  lifecycle: "active" | "cancelled";
  milestones: KRMilestone[];
}
export interface KRFinding {
  id: string;
  severity: number;
  text: string;
  href: string;
}
