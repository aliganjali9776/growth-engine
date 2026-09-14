export const directions = {
  increase: "افزایشی",
  decrease: "کاهشی",
  maintain: "حفظ سطح",
  binary: "بله / خیر",
};
export const frequencies = {
  daily: "روزانه",
  weekly: "هفتگی",
  monthly: "ماهانه",
  quarterly: "فصلی",
};
export interface ProcessKPI {
  id: string;
  processId: string;
  name: string;
  description: string;
  ownerRoleId: string;
  unit: string;
  direction: keyof typeof directions;
  baselineValue: number | null;
  targetValue: number | null;
  tolerance: number;
  frequency: keyof typeof frequencies;
  status: "draft" | "active" | "archived";
  weight: number | null;
  createdAt: string;
  updatedAt: string;
}
// Current value is derived from the latest periodDate, never duplicated in storage.
export interface KPIEntry {
  id: string;
  kpiId: string;
  processId: string;
  periodDate: string;
  value: number;
  note: string;
  confidence: "high" | "medium" | "low";
  enteredAt: string;
}
export const improvementSources = {
  analysis: "تحلیل فرآیند",
  "kpi-gap": "شکاف KPI",
  review: "مرور هفتگی",
  founder: "وابستگی بنیان‌گذار",
  pilot: "بازخورد پایلوت",
  adoption: "مسئله پذیرش",
  manual: "دستی",
};
export const improvementStatuses = {
  backlog: "در صف",
  planned: "برنامه‌ریزی‌شده",
  "in-progress": "در حال اجرا",
  blocked: "متوقف‌شده",
  completed: "تکمیل‌شده",
  cancelled: "لغوشده",
};
export interface ImprovementItem {
  id: string;
  processId: string;
  title: string;
  description: string;
  source: keyof typeof improvementSources;
  sourceKey: string;
  relatedStepId: string;
  relatedKpiId: string;
  ownerRoleId: string;
  priority: "critical" | "high" | "medium" | "low";
  status: keyof typeof improvementStatuses;
  dueDate: string;
  expectedImpact: string;
  actualImpact: string;
  createdAt: string;
  completedAt?: string;
  notes: string;
}
export interface ProcessReview {
  id: string;
  processId: string;
  periodStart: string;
  periodEnd: string;
  summary: string;
  wins: string[];
  problems: string[];
  blockers: string[];
  decisions: string[];
  nextActions: string[];
  founderChanges: string;
  reviewedByRoleId: string;
  createdAt: string;
}
export const reviewHasContent = (r: ProcessReview) =>
  !!r.summary.trim() ||
  [
    ...r.wins,
    ...r.problems,
    ...r.blockers,
    ...r.decisions,
    ...r.nextActions,
  ].some((x) => !!x.trim());
export interface MeasurementRecord {
  processId: string;
  kpis: ProcessKPI[];
  entries: KPIEntry[];
  improvements: ImprovementItem[];
  reviews: ProcessReview[];
  measuredAt?: string;
  improvingAt?: string;
}
export interface MeasurementStore {
  version: 1;
  records: MeasurementRecord[];
}
export const emptyMeasurement = (processId: string): MeasurementRecord => ({
  processId,
  kpis: [],
  entries: [],
  improvements: [],
  reviews: [],
});
export const today = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
export const newKPI = (processId: string): ProcessKPI => ({
  id: crypto.randomUUID(),
  processId,
  name: "",
  description: "",
  ownerRoleId: "",
  unit: "",
  direction: "increase",
  baselineValue: null,
  targetValue: null,
  tolerance: 0,
  frequency: "weekly",
  status: "draft",
  weight: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});
export const newImprovement = (processId: string): ImprovementItem => ({
  id: crypto.randomUUID(),
  processId,
  title: "",
  description: "",
  source: "manual",
  sourceKey: "",
  relatedStepId: "",
  relatedKpiId: "",
  ownerRoleId: "",
  priority: "medium",
  status: "backlog",
  dueDate: "",
  expectedImpact: "",
  actualImpact: "",
  createdAt: new Date().toISOString(),
  notes: "",
});
